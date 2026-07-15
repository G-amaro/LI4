using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BIS.Infrastructure.Data;
using BIS.Domain.Enums;

namespace BIS.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Administrador,GerenteSede")]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public DashboardController(ApplicationDbContext db) { _db = db; }

    [HttpGet("resumo")]
    public async Task<IActionResult> Resumo()
    {
        var agora         = DateTime.UtcNow;
        var hoje          = agora.Date;
        var ontem         = hoje.AddDays(-1);
        var seteDiasAtras = hoje.AddDays(-7);
        var limiteOnline  = agora.AddMinutes(-15);

        // ── Vendas hoje vs ontem ─────────────────────────────────
        var vendasHoje  = (double)(await _db.Vendas
            .Where(v => v.DataTransacao >= hoje)
            .SumAsync(v => (decimal?)v.ValorTotal) ?? 0);

        var vendasOntem = (double)(await _db.Vendas
            .Where(v => v.DataTransacao >= ontem && v.DataTransacao < hoje)
            .SumAsync(v => (decimal?)v.ValorTotal) ?? 0);

        var percentVariacao = vendasOntem > 0
            ? Math.Round((vendasHoje - vendasOntem) / vendasOntem * 100, 1)
            : 0.0;

        // ── Lojas ────────────────────────────────────────────────
        var lojas       = await _db.Lojas.AsNoTracking().Where(l => l.TemPOS).ToListAsync();
        var lojasOnline = lojas.Count(l =>
            l.UltimaSincronizacao.HasValue && l.UltimaSincronizacao > limiteOnline);

        // ── Transferências pendentes ─────────────────────────────
        var envioIdsRecebidos = _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue)
            .Select(t => t.TransferenciaEnvioId!.Value);

        var transferenciasPendentes = await _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Envio
                     && !envioIdsRecebidos.Contains(t.Id))
            .CountAsync();

        // ── Quebras e discrepâncias ──────────────────────────────
        var totalQuebras = (double)(await _db.Quebras
            .SumAsync(q => (decimal?)q.ValorPerdido) ?? 0);

        var totalDiscrepancias = (double)(await _db.FechosCaixa
            .Where(f => f.TemDiscrepancia)
            .SumAsync(f => (decimal?)f.Discrepancia) ?? 0);

        // ── Vendas por dia ───────────────────────────────────────
        var vendasPorDia = await _db.Vendas
            .Where(v => v.DataTransacao >= seteDiasAtras)
            .GroupBy(v => v.DataTransacao.Date)
            .Select(g => new {
                data         = g.Key,
                valor        = (double)g.Sum(v => v.ValorTotal),
                numeroVendas = g.Count()
            })
            .OrderBy(x => x.data)
            .ToListAsync();

        // ── Vendas por loja e dia ────────────────────────────────
        var vendasPorLojaEDia = await _db.Vendas
            .Where(v => v.DataTransacao >= seteDiasAtras)
            .Include(v => v.Loja)
            .GroupBy(v => new { v.LojaId, NomeLoja = v.Loja!.Nome, Dia = v.DataTransacao.Date })
            .Select(g => new {
                lojaId   = g.Key.LojaId,
                lojaNome = g.Key.NomeLoja,
                data     = g.Key.Dia,
                valor    = (double)g.Sum(v => v.ValorTotal)
            })
            .OrderBy(x => x.data)
            .ToListAsync();

        // ── Top lojas ────────────────────────────────────────────
        var topLojas = await _db.Vendas
            .Include(v => v.Loja)
            .GroupBy(v => new { v.LojaId, NomeLoja = v.Loja!.Nome })
            .Select(g => new {
                id           = g.Key.LojaId,
                nome         = g.Key.NomeLoja,
                receita      = (double)g.Sum(v => v.ValorTotal),
                numeroVendas = g.Count()
            })
            .OrderByDescending(x => x.receita)
            .Take(5)
            .ToListAsync();

        // ── Últimas transferências ───────────────────────────────
        var envioIdsRecebidosSet = (await _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue)
            .Select(t => t.TransferenciaEnvioId!.Value)
            .ToListAsync())
            .ToHashSet();

        var ultimasTransferencias = await _db.Transferencias
            .AsNoTracking()
            .Include(t => t.LojaOrigem)
            .Include(t => t.LojaDestino)
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Envio)
            .OrderByDescending(t => t.DataMovimento)
            .Take(10)
            .ToListAsync();

        return Ok(new
        {
            // Cards
            totalVendasHoje         = vendasHoje,
            totalVendasOntem        = vendasOntem,
            percentVariacaoVendas   = percentVariacao,
            lojasOnline,
            lojasTotal              = lojas.Count,
            transferenciasPendentes,
            totalQuebras,
            totalDiscrepancias,

            // Contagens
            numeroLojas      = lojas.Count,
            numeroProdutos   = await _db.Produtos.CountAsync(),
            numeroOperadores = await _db.Utilizadores.CountAsync(),

            // Gráfico
            vendasPorDia = vendasPorDia.Select(v => new {
                data         = v.data.ToString("yyyy-MM-dd"),
                v.valor,
                v.numeroVendas
            }),
            vendasPorLojaEDia = vendasPorLojaEDia.Select(v => new {
                v.lojaId,
                v.lojaNome,
                data  = v.data.ToString("yyyy-MM-dd"),
                v.valor
            }),

            topLojas,

            // Tabela transferências
            ultimasTransferencias = ultimasTransferencias.Select(t => new {
                id              = t.Id.ToString()[..8] + "...",
                lojaOrigemNome  = t.LojaOrigem?.Nome  ?? $"Loja #{t.LojaOrigemId}",
                lojaDestinoNome = t.LojaDestino?.Nome ?? $"Loja #{t.LojaDestinoId}",
                dataMovimento   = t.DataMovimento,
                documentoRef    = t.DocumentoReferencia,
                totalUnidades   = t.TotalUnidades,
                estado          = envioIdsRecebidosSet.Contains(t.Id) ? "Concluída" : "Em Trânsito"
            })
        });
    }
}
