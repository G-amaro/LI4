using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BIS.Infrastructure.Data;

namespace BIS.Api.Controllers;

/// <summary>
/// Compras — receções com fornecedor e custo para o backoffice.
/// Fase 4.3: listagem filtrada + KPIs mensais.
/// </summary>
[ApiController]
[Route("api/compras")]

public class ComprasController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ComprasController(ApplicationDbContext db)
    {
        _db = db;
    }

    // ─── GET /api/compras ─────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> Listar(
        [FromQuery] int?    lojaId = null,
        [FromQuery] int?    fornecedorId = null,
        [FromQuery] string? de = null,
        [FromQuery] string? ate = null)
    {
        var query = _db.Rececoes
            .AsNoTracking()
            .Include(r => r.Loja)
            .Include(r => r.Operador)
            .Include(r => r.Fornecedor)
            .Include(r => r.Linhas!).ThenInclude(l => l.Produto)
            .AsQueryable();

        if (lojaId.HasValue)
            query = query.Where(r => r.LojaId == lojaId.Value);

        if (fornecedorId.HasValue)
            query = query.Where(r => r.FornecedorId == fornecedorId.Value);

        if (DateTime.TryParse(de, out var dataInicio))
            query = query.Where(r => r.DataRececao >= dataInicio);

        if (DateTime.TryParse(ate, out var dataFim))
            query = query.Where(r => r.DataRececao <= dataFim.AddDays(1));

        var rececoes = await query
            .OrderByDescending(r => r.DataRececao)
            .ToListAsync();

        var resultado = rececoes.Select(r => new
        {
            id                  = r.Id,
            dataRececao         = r.DataRececao,
            documentoReferencia = r.DocumentoReferencia,
            lojaId              = r.LojaId,
            lojaNome            = r.Loja?.Nome ?? $"Loja #{r.LojaId}",
            operadorNome        = r.Operador?.Nome ?? "—",
            fornecedorId        = r.FornecedorId,
            fornecedorNome      = r.Fornecedor?.Nome,
            numeroLinhas        = r.Linhas?.Count ?? 0,
            totalUnidades       = r.TotalUnidades,
            custoTotal          = r.Linhas?.Sum(l => l.PrecoCusto * l.Quantidade) ?? 0,
            linhas              = r.Linhas?.Select(l => new
            {
                produtoId    = l.ProdutoId,
                ean          = l.Produto?.EAN ?? "",
                artigo       = l.Produto?.Artigo ?? "—",
                categoria    = l.Produto?.Categoria ?? "—",
                quantidade   = l.Quantidade,
                precoCusto   = l.PrecoCusto,
                subtotal     = l.PrecoCusto * l.Quantidade,
                lote         = l.Lote,
                dataValidade = l.DataValidade
            }).ToList()
        });

        return Ok(resultado);
    }

    // ─── GET /api/compras/kpis ────────────────────────────────────
    [HttpGet("kpis")]
    public async Task<IActionResult> Kpis()
    {
        var inicioMes = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

        var rececoesMes = await _db.Rececoes
            .AsNoTracking()
            .Include(r => r.Linhas)
            .Include(r => r.Fornecedor)
            .Where(r => r.DataRececao >= inicioMes)
            .ToListAsync();

        var totalGastoMes  = rececoesMes.Sum(r => r.Linhas?.Sum(l => l.PrecoCusto * l.Quantidade) ?? 0);
        var numRececoesMes = rececoesMes.Count;

        // Fornecedor com maior gasto este mês
        var fornecedorTop = rececoesMes
            .Where(r => r.FornecedorId.HasValue)
            .GroupBy(r => new { r.FornecedorId, Nome = r.Fornecedor?.Nome ?? "—" })
            .Select(g => new
            {
                g.Key.Nome,
                TotalGasto = g.Sum(r => r.Linhas?.Sum(l => l.PrecoCusto * l.Quantidade) ?? 0)
            })
            .OrderByDescending(x => x.TotalGasto)
            .FirstOrDefault();

        return Ok(new
        {
            totalGastoMes,
            numRececoesMes,
            fornecedorTopNome  = fornecedorTop?.Nome,
            fornecedorTopGasto = fornecedorTop?.TotalGasto ?? 0
        });
    }
}
