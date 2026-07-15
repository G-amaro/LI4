using BIS.Api.DTOs;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints para a página de Lojas no Backoffice.
///
/// Devolve cards resumidos (vista geral) e detalhe completo por loja.
/// Os cálculos de stock seguem o mesmo padrão do InventarioController.
/// </summary>
[ApiController]
[Route("api/lojas")]
public class LojasController : ControllerBase
{
    private const int LIMIAR_ALERTA = 5;
    private const int LOJA_SEDE_ID  = 1;

    private readonly ApplicationDbContext _db;
    private readonly ILogger<LojasController> _logger;

    public LojasController(ApplicationDbContext db, ILogger<LojasController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─── Listagem (cards) ──────────────────────────────────────────

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LojaCardDto>>> Listar()
    {
        var lojas = await _db.Lojas
    .Where(l => l.TemPOS)
    .Select(l => new { l.Id, l.Nome, l.Localidade })
    .ToListAsync();

        var hoje      = DateTime.UtcNow.Date;
        var amanha    = hoje.AddDays(1);

        var cards = new List<LojaCardDto>();

        foreach (var loja in lojas)
        {
            // Operadores activos
            var numOperadores = await _db.Utilizadores
                .CountAsync(u => u.LojaBaseId == loja.Id && u.EstadoConta == EstadoConta.Ativo);

            // Produtos no catálogo
            var numProdutos = await _db.Produtos.CountAsync();

            // Vendas hoje
            var vendasHoje = await _db.Vendas
                .Where(v => v.LojaId == loja.Id
                         && v.DataTransacao >= hoje
                         && v.DataTransacao <  amanha)
                .ToListAsync();

            // Última sincronização (maior data entre tabelas)
            var ultimaSync = await ObterUltimaSincronizacao(loja.Id);

            // Stock crítico/alerta (calculado igual ao InventarioController)
            var stocks = await CalcularStockDaLoja(loja.Id);
            var criticos = stocks.Count(s => s.Value == 0);
            var alertas  = stocks.Count(s => s.Value > 0 && s.Value < LIMIAR_ALERTA);

            cards.Add(new LojaCardDto
            {
                Id                     = loja.Id,
                Nome                   = loja.Nome,
                Localidade             = loja.Localidade,
                IsSede                 = loja.Id == LOJA_SEDE_ID,
                NumeroOperadores       = numOperadores,
                NumeroProdutosCatalogo = numProdutos,
                VendasHoje             = vendasHoje.Sum(v => v.ValorTotal),
                TransacoesHoje         = vendasHoje.Count,
                UltimaSincronizacao    = ultimaSync,
                ProdutosCriticos       = criticos,
                ProdutosEmAlerta       = alertas
            });
        }

        return Ok(cards);
    }

    // ─── Detalhe ────────────────────────────────────────────────────

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LojaDetalheDto>> Detalhe(int id)
    {
        var loja = await _db.Lojas.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id);
        if (loja == null)
            return NotFound(new { message = $"Loja {id} não encontrada." });

        var hoje    = DateTime.UtcNow.Date;
        var amanha  = hoje.AddDays(1);
        var seteDiasAtras = hoje.AddDays(-7);

        // KPIs
        var vendasHoje = await _db.Vendas
            .Where(v => v.LojaId == id && v.DataTransacao >= hoje && v.DataTransacao < amanha)
            .ToListAsync();

        var vendasSemana = await _db.Vendas
            .Where(v => v.LojaId == id && v.DataTransacao >= seteDiasAtras && v.DataTransacao < amanha)
            .ToListAsync();

        var unidadesSemana = await _db.LinhasVenda
            .Include(l => l.Venda)
            .Where(l => l.Venda!.LojaId == id
                     && l.Venda!.DataTransacao >= seteDiasAtras
                     && l.Venda!.DataTransacao <  amanha)
            .SumAsync(l => (int?)l.Quantidade) ?? 0;

        var quebras7d = await _db.Quebras
            .Where(q => q.LojaId == id && q.DataRegisto >= seteDiasAtras)
            .CountAsync();

        var ticketMedio = vendasSemana.Count > 0
            ? vendasSemana.Sum(v => v.ValorTotal) / vendasSemana.Count
            : 0m;

        var kpis = new LojaKpisDto
        {
            VendasHoje         = vendasHoje.Sum(v => v.ValorTotal),
            TransacoesHoje     = vendasHoje.Count,
            VendasSemana       = vendasSemana.Sum(v => v.ValorTotal),
            TransacoesSemana   = vendasSemana.Count,
            TicketMedio        = Math.Round(ticketMedio, 2),
            UnidadesVendidas7d = unidadesSemana,
            QuebrasUltimos7d   = quebras7d
        };

        // Operadores
        var operadores = await _db.Utilizadores
            .AsNoTracking()
            .Where(u => u.LojaBaseId == id)
            .OrderBy(u => u.Nome)
            .Select(u => new LojaOperadorDto
            {
                Id          = u.Id,
                Nome        = u.Nome,
                NIF         = u.NIF,
                Perfil      = u.Perfil.ToString(),
                EstadoConta = u.EstadoConta.ToString(),
                UltimoLogin = u.UltimoLogin
            })
            .ToListAsync();

        // Top 5 produtos vendidos (últimos 7 dias)
        var topProdutos = await _db.LinhasVenda
            .AsNoTracking()
            .Include(l => l.Venda)
            .Include(l => l.Produto)
            .Where(l => l.Venda!.LojaId == id
                     && l.Venda!.DataTransacao >= seteDiasAtras
                     && l.Venda!.DataTransacao <  amanha)
            .GroupBy(l => new { l.ProdutoId, l.Produto!.Artigo })
            .Select(g => new LojaTopProdutoDto
            {
                ProdutoId        = g.Key.ProdutoId,
                Artigo           = g.Key.Artigo,
                UnidadesVendidas = (int)g.Sum(x => x.Quantidade),
                Receita          = g.Sum(x => x.Subtotal)
            })
            .OrderByDescending(x => x.UnidadesVendidas)
            .Take(5)
            .ToListAsync();

        // Stock crítico/alerta
        var stocks = await CalcularStockDaLoja(id);
        var produtos = await _db.Produtos.AsNoTracking().ToListAsync();

        var stockCritico = produtos
            .Select(p =>
            {
                var stock = stocks.TryGetValue(p.Id, out var v) ? v : 0;
                return new LojaStockCriticoDto
                {
                    ProdutoId = p.Id,
                    Artigo    = p.Artigo,
                    Categoria = p.Categoria,
                    Stock     = stock,
                    Estado    = stock == 0 ? "Critico" : "Alerta"
                };
            })
            .Where(s => s.Stock < LIMIAR_ALERTA)
            .OrderBy(s => s.Stock)
            .ThenBy(s => s.Artigo)
            .ToList();

        // Actividade últimos 7 dias (vendas por dia)
        var actividade = new List<LojaActividadeDiariaDto>();
        for (int i = 6; i >= 0; i--)
        {
            var dia       = hoje.AddDays(-i);
            var diaInicio = dia;
            var diaFim    = dia.AddDays(1);

            var vendasDia = vendasSemana
                .Where(v => v.DataTransacao >= diaInicio && v.DataTransacao < diaFim)
                .ToList();

            actividade.Add(new LojaActividadeDiariaDto
            {
                Dia        = dia,
                Vendas     = vendasDia.Sum(v => v.ValorTotal),
                Transacoes = vendasDia.Count
            });
        }

        var ultimaSync = await ObterUltimaSincronizacao(id);

        return Ok(new LojaDetalheDto
        {
            Id                  = loja.Id,
            Nome                = loja.Nome,
            Localidade          = loja.Localidade,
            IsSede              = loja.Id == LOJA_SEDE_ID,
            UltimaSincronizacao = ultimaSync,
            Kpis                = kpis,
            Operadores          = operadores,
            TopProdutos         = topProdutos,
            StockCritico        = stockCritico,
            Actividade7Dias     = actividade
        });
    }

    // ─── Helpers privados ──────────────────────────────────────────

    /// <summary>
    /// Calcula stock por produto para uma loja específica.
    /// Mesma lógica do InventarioController, mas filtrada a uma loja.
    /// </summary>
    private async Task<Dictionary<int, int>> CalcularStockDaLoja(int lojaId)
    {
        // Recepções
        var rececoes = await _db.LinhasRececao
            .Include(l => l.Rececao)
            .Where(l => l.Rececao!.LojaId == lojaId)
            .GroupBy(l => l.ProdutoId)
            .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // Vendas
        var vendas = await _db.LinhasVenda
            .Include(l => l.Venda)
            .Where(l => l.Venda!.LojaId == lojaId)
            .GroupBy(l => l.ProdutoId)
            .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // Quebras
        var quebras = await _db.Quebras
            .Where(q => q.LojaId == lojaId)
            .GroupBy(q => q.ProdutoId)
            .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // Devoluções
        var devolucoes = await _db.LinhasDevolucao
            .Include(l => l.Devolucao)
            .Where(l => l.Devolucao!.LojaId == lojaId)
            .GroupBy(l => l.ProdutoId)
            .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
            .ToListAsync();

        // Transferências (envio = saída se origem; recepção = entrada se destino)
        var transferencias = await _db.LinhasTransferencia
            .Include(l => l.Transferencia)
            .Where(l => l.Transferencia!.LojaOrigemId == lojaId
                     || l.Transferencia!.LojaDestinoId == lojaId)
            .Select(l => new
            {
                l.Transferencia!.TipoMovimento,
                l.Transferencia!.LojaOrigemId,
                l.Transferencia!.LojaDestinoId,
                l.ProdutoId,
                l.Quantidade
            })
            .ToListAsync();

        var stock = new Dictionary<int, int>();

        foreach (var r in rececoes)
            stock[r.Key] = stock.GetValueOrDefault(r.Key) + (int)r.Total;

        foreach (var v in vendas)
            stock[v.Key] = stock.GetValueOrDefault(v.Key) - (int)v.Total;

        foreach (var q in quebras)
            stock[q.Key] = stock.GetValueOrDefault(q.Key) - (int)q.Total;

        foreach (var d in devolucoes)
            stock[d.Key] = stock.GetValueOrDefault(d.Key) + (int)d.Total;

        foreach (var t in transferencias)
        {
            var qtd = (int)t.Quantidade;
            if (t.TipoMovimento == TipoMovimentoTransferencia.Envio && t.LojaOrigemId == lojaId)
                stock[t.ProdutoId] = stock.GetValueOrDefault(t.ProdutoId) - qtd;
            else if (t.TipoMovimento == TipoMovimentoTransferencia.Rececao && t.LojaDestinoId == lojaId)
                stock[t.ProdutoId] = stock.GetValueOrDefault(t.ProdutoId) + qtd;
        }

        // Garantir que todos os produtos existem no map (com 0 se não houver movimentos)
        var todosProdutos = await _db.Produtos.AsNoTracking().Select(p => p.Id).ToListAsync();
        foreach (var pid in todosProdutos)
            if (!stock.ContainsKey(pid))
                stock[pid] = 0;

        // Defensivo: nada abaixo de 0
        return stock.ToDictionary(kv => kv.Key, kv => Math.Max(0, kv.Value));
    }

    private async Task<DateTime?> ObterUltimaSincronizacao(int lojaId)
    {
        var ultimaVenda     = await _db.Vendas    .Where(v => v.LojaId == lojaId).MaxAsync(v => (DateTime?)v.DataSincronizacao);
        var ultimaQuebra    = await _db.Quebras   .Where(q => q.LojaId == lojaId).MaxAsync(q => (DateTime?)q.DataSincronizacao);
        var ultimaRececao   = await _db.Rececoes  .Where(r => r.LojaId == lojaId).MaxAsync(r => (DateTime?)r.DataSincronizacao);
        var ultimaDevolucao = await _db.Devolucoes.Where(d => d.LojaId == lojaId).MaxAsync(d => (DateTime?)d.DataSincronizacao);

        return new[] { ultimaVenda, ultimaQuebra, ultimaRececao, ultimaDevolucao }
            .Where(d => d.HasValue)
            .Max();
    }
}
