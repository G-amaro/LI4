using BIS.Api.DTOs;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de inventário consolidado para o Backoffice.
///
/// Stock calculado a partir das transações sincronizadas:
///   Stock = Receções + Devoluções + Transferências Recebidas
///         − Vendas − Quebras − Transferências Enviadas
///
/// O stock reflecte o estado conhecido pela Sede —
/// pode ter atraso face ao POS se este estiver offline.
/// Lojas sem TemPOS (Sede) são automaticamente excluídas.
/// </summary>
[ApiController]
[Route("api/inventario")]
[Authorize(Roles = "Administrador,GerenteSede,GerenteLoja")]
public class InventarioController : ControllerBase
{
    private const int LIMIAR_ALERTA = 5;

    private readonly ApplicationDbContext _db;
    private readonly ILogger<InventarioController> _logger;

    public InventarioController(ApplicationDbContext db, ILogger<InventarioController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<InventarioConsolidadoDto>> ObterInventario()
    {
        // 1. Lojas operacionais (TemPOS = true — exclui Sede automaticamente)
        var lojas = await _db.Lojas
            .AsNoTracking()
            .Where(l => l.TemPOS)
            .OrderBy(l => l.Id)
            .Select(l => new InventarioLojaDto { Id = l.Id, Nome = l.Nome })
            .ToListAsync();

        // 2. Produtos do catálogo
        var produtos = await _db.Produtos
            .AsNoTracking()
            .OrderBy(p => p.Artigo)
            .Select(p => new { p.Id, p.EAN, p.Artigo, p.Categoria })
            .ToListAsync();

        // 3. Receções (ENTRADA +)
        var rececoes = await _db.LinhasRececao
            .AsNoTracking()
            .Join(_db.Rececoes, lr => lr.RececaoId, r => r.Id,
                (lr, r) => new { r.LojaId, lr.ProdutoId, lr.Quantidade })
            .GroupBy(x => new { x.LojaId, x.ProdutoId })
            .Select(g => new { g.Key.LojaId, g.Key.ProdutoId, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // 4. Vendas (SAÍDA −)
        var vendas = await _db.LinhasVenda
            .AsNoTracking()
            .Join(_db.Vendas, lv => lv.VendaId, v => v.Id,
                (lv, v) => new { v.LojaId, lv.ProdutoId, lv.Quantidade })
            .GroupBy(x => new { x.LojaId, x.ProdutoId })
            .Select(g => new { g.Key.LojaId, g.Key.ProdutoId, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // 5. Quebras (SAÍDA −)
        var quebras = await _db.Quebras
            .AsNoTracking()
            .GroupBy(q => new { q.LojaId, q.ProdutoId })
            .Select(g => new { g.Key.LojaId, g.Key.ProdutoId, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // 6. Devoluções (ENTRADA +)
        var devolucoes = await _db.LinhasDevolucao
            .AsNoTracking()
            .Join(_db.Devolucoes, ld => ld.DevolucaoId, d => d.Id,
                (ld, d) => new { d.LojaId, ld.ProdutoId, ld.Quantidade })
            .GroupBy(x => new { x.LojaId, x.ProdutoId })
            .Select(g => new { g.Key.LojaId, g.Key.ProdutoId, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // 7. Transferências (ENVIO − origem | RECEPÇÃO + destino)
        //    Só contabiliza RECEPÇÕEs confirmadas para evitar stock duplo
        var transferencias = await _db.LinhasTransferencia
            .AsNoTracking()
            .Include(l => l.Transferencia)
            .Select(l => new
            {
                l.Transferencia!.TipoMovimento,
                l.Transferencia!.LojaOrigemId,
                l.Transferencia!.LojaDestinoId,
                l.ProdutoId,
                l.Quantidade
            })
            .ToListAsync();

        // ── Matriz produto × loja ──────────────────────────────────
        var matriz = new Dictionary<(int produto, int loja), int>();

        // Entradas
        foreach (var r in rececoes)
            Acumular(matriz, r.ProdutoId, r.LojaId, +r.Total);

        foreach (var d in devolucoes)
            Acumular(matriz, d.ProdutoId, d.LojaId, +d.Total);

        // Saídas
        foreach (var v in vendas)
            Acumular(matriz, v.ProdutoId, v.LojaId, -(int)v.Total);

        foreach (var q in quebras)
            Acumular(matriz, q.ProdutoId, q.LojaId, -(int)q.Total);

        // Transferências
        foreach (var t in transferencias)
        {
            if (t.TipoMovimento == TipoMovimentoTransferencia.Envio)
                Acumular(matriz, t.ProdutoId, t.LojaOrigemId,  -t.Quantidade); // saiu da origem
            else
                Acumular(matriz, t.ProdutoId, t.LojaDestinoId, +t.Quantidade); // entrou no destino
        }

        // ── Construir DTOs por artigo ─────────────────────────────
        var artigos = produtos.Select(p =>
        {
            var stockPorLoja = lojas.ToDictionary(
                l => l.Id,
                l => matriz.TryGetValue((p.Id, l.Id), out var v) ? Math.Max(0, v) : 0
            );

            var totalStock = stockPorLoja.Values.Sum();

            var estado = totalStock == 0      ? "Critico"
                       : totalStock < LIMIAR_ALERTA ? "Alerta"
                       : "OK";

            return new InventarioArtigoDto
            {
                Id           = p.Id,
                EAN          = p.EAN,
                Artigo       = p.Artigo,
                Categoria    = p.Categoria,
                Total        = totalStock,
                MinimoGlobal = LIMIAR_ALERTA,
                Estado       = estado,
                StockPorLoja = stockPorLoja
            };
        }).ToList();

        // ── KPIs ───────────────────────────────────────────────────
        var kpis = new InventarioKpisDto
        {
            TotalArtigos = artigos.Count,
            Criticos     = artigos.Count(a => a.Estado == "Critico"),
            Alertas      = artigos.Count(a => a.Estado == "Alerta"),
            Ok           = artigos.Count(a => a.Estado == "OK")
        };

        // ── Sync status por loja ──────────────────────────────────
        var sincStatus = await ObterSyncStatusPorLoja(lojas.Select(l => l.Id).ToList());

        return Ok(new InventarioConsolidadoDto
        {
            Lojas      = lojas,
            Artigos    = artigos,
            Kpis       = kpis,
            SyncStatus = sincStatus,
            GeradoEm   = DateTime.UtcNow
        });
    }

    // ─── Lotes por produto ────────────────────────────────────────────

    [HttpGet("lotes/{produtoId:int}")]
    public async Task<ActionResult<LotesProdutoDto>> ObterLotesProduto(int produtoId)
    {
        var produto = await _db.Produtos
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == produtoId);

        if (produto is null)
            return NotFound(new { message = $"Produto {produtoId} não encontrado." });

        var recepcoes = await _db.LinhasRececao
            .AsNoTracking()
            .Include(l => l.Rececao)!.ThenInclude(r => r!.Loja)
            .Include(l => l.Rececao)!.ThenInclude(r => r!.Operador)
            .Where(l => l.ProdutoId == produtoId)
            .OrderByDescending(l => l.Rececao!.DataRececao)
            .Select(l => new
            {
                RececaoId    = l.Rececao!.Id,
                DataRececao  = l.Rececao.DataRececao,
                Lote         = l.Lote,
                DataValidade = l.DataValidade,
                Quantidade   = l.Quantidade,
                LojaId       = l.Rececao.LojaId,
                LojaNome     = l.Rececao.Loja!.Nome,
                Documento    = l.Rececao.DocumentoReferencia,
                OperadorNome = l.Rececao.Operador!.Nome
            })
            .ToListAsync();

        var hoje = DateTime.UtcNow.Date;

        var dtos = recepcoes.Select(r =>
        {
            int? dias = null;
            string estado = "SemValidade";

            if (r.DataValidade.HasValue)
            {
                dias = (r.DataValidade.Value.Date - hoje).Days;
                estado = dias < 0 ? "Vencido"
                       : dias <= 7 ? "Critico"
                       : dias <= 30 ? "Alerta"
                       : "OK";
            }

            return new RecepcaoLoteDto
            {
                RececaoId      = r.RececaoId,
                DataRececao    = r.DataRececao,
                Lote           = r.Lote,
                DataValidade   = r.DataValidade,
                Quantidade     = r.Quantidade,
                LojaId         = r.LojaId,
                LojaNome       = r.LojaNome,
                Documento      = r.Documento,
                OperadorNome   = r.OperadorNome,
                EstadoValidade = estado,
                DiasAteExpirar = dias
            };
        }).ToList();

        return Ok(new LotesProdutoDto
        {
            ProdutoId     = produto.Id,
            EAN           = produto.EAN,
            Artigo        = produto.Artigo,
            Categoria     = produto.Categoria,
            Perecivel     = produto.Perecivel,
            Recepcoes     = dtos,
            TotalRecebido = dtos.Sum(d => d.Quantidade),
            NumRecepcoes  = dtos.Count
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private static void Acumular(
        Dictionary<(int produto, int loja), int> matriz,
        int produtoId, int lojaId, int qtd)
    {
        var key = (produtoId, lojaId);
        matriz[key] = matriz.TryGetValue(key, out var atual) ? atual + qtd : qtd;
    }

    private async Task<Dictionary<int, DateTime?>> ObterSyncStatusPorLoja(List<int> lojaIds)
    {
        var resultado = new Dictionary<int, DateTime?>();
        foreach (var lojaId in lojaIds)
        {
            var datas = new[]
            {
                await _db.Vendas    .Where(v => v.LojaId == lojaId).MaxAsync(v => (DateTime?)v.DataSincronizacao),
                await _db.Quebras   .Where(q => q.LojaId == lojaId).MaxAsync(q => (DateTime?)q.DataSincronizacao),
                await _db.Rececoes  .Where(r => r.LojaId == lojaId).MaxAsync(r => (DateTime?)r.DataSincronizacao),
                await _db.Devolucoes.Where(d => d.LojaId == lojaId).MaxAsync(d => (DateTime?)d.DataSincronizacao)
            };
            resultado[lojaId] = datas.Where(d => d.HasValue).Max();
        }
        return resultado;
    }
}
