using BIS.Api.DTOs;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de relatórios financeiros — agora com dados reais (UC12).
///
/// Todas as queries usam AsNoTracking() porque são leituras para dashboard
/// (não precisam de change tracking do EF) e projectam directamente para DTO
/// via .Select() para não carregar campos desnecessários.
///
/// Notas importantes:
///   - O campo "OperadorTurno" é calculado a partir da hora do fecho/quebra:
///     T1 = antes das 14:00, T2 = depois das 14:00. Não há campo 'Turno'
///     na BD porque os turnos são inferidos por padrão operacional.
///   - As queries ordenam por data descendente para o último dia aparecer no topo.
/// </summary>
[ApiController]
[Route("api/relatorios")]
[Authorize(Roles = "Administrador,GerenteSede")]
public class RelatoriosController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<RelatoriosController> _logger;

    public RelatoriosController(
        ApplicationDbContext db,
        ILogger<RelatoriosController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ─── GET /api/relatorios/resumo ──────────────────────────────

    [HttpGet("resumo")]
    public async Task<ActionResult<ResumoFinanceiroDto>> GetResumo()
    {
        // Soma de todas as discrepâncias (pode ser negativo se há faltas)
        var totalDiscrep = await _db.FechosCaixa
            .AsNoTracking()
            .SumAsync(f => (decimal?)f.Discrepancia) ?? 0m;

        // Valor total perdido em quebras (sempre positivo)
        var totalQuebras = await _db.Quebras
            .AsNoTracking()
            .SumAsync(q => (decimal?)q.ValorPerdido) ?? 0m;

        var numFechos  = await _db.FechosCaixa.AsNoTracking().CountAsync();
        var numQuebras = await _db.Quebras.AsNoTracking().CountAsync();

        var resumo = new ResumoFinanceiroDto
        {
            TotalDiscrepancias = Math.Round(totalDiscrep, 2),
            TotalQuebras       = Math.Round(totalQuebras, 2),
            NumeroFechos       = numFechos,
            NumeroQuebras      = numQuebras
        };

        _logger.LogInformation(
            "Resumo financeiro: {F} fechos ({D}€ discrep), {Q} quebras ({V}€ perda)",
            numFechos, totalDiscrep, numQuebras, totalQuebras);

        return Ok(resumo);
    }

    // ─── GET /api/relatorios/fechos ──────────────────────────────

    [HttpGet("fechos")]
    public async Task<ActionResult<IEnumerable<FechoCaixaDto>>> GetFechos()
    {
        // Projecção directa: não carrega entidades completas — só o necessário
        var fechos = await _db.FechosCaixa
            .AsNoTracking()
            .Include(f => f.Loja)
            .Include(f => f.Operador)
            .OrderByDescending(f => f.DataFecho)
            .Select(f => new
            {
                f.DataFecho,
                LojaNome      = f.Loja != null ? f.Loja.Nome : "—",
                OperadorNome  = f.Operador != null ? f.Operador.Nome : "—",
                f.TeoricoTotal,
                f.ContadoTotal,
                f.Discrepancia
            })
            .ToListAsync();

        // Mapeamento final no cliente (.NET) — aqui podemos usar helpers como Turno()
        var resultado = fechos.Select(f => new FechoCaixaDto
        {
            Data           = f.DataFecho.ToLocalTime().ToString("dd/MM/yyyy"),
            Loja           = f.LojaNome,
            OperadorTurno  = $"{f.OperadorNome} ({Turno(f.DataFecho)})",
            ValorTeorico   = Math.Round(f.TeoricoTotal, 2),
            ValorDeclarado = Math.Round(f.ContadoTotal, 2),
            Discrepancia   = Math.Round(f.Discrepancia, 2)
        }).ToList();

        return Ok(resultado);
    }

    // ─── GET /api/relatorios/quebras ─────────────────────────────

    [HttpGet("quebras")]
    public async Task<ActionResult<IEnumerable<QuebraRelatorioDto>>> GetQuebras()
    {
        var quebras = await _db.Quebras
            .AsNoTracking()
            .Include(q => q.Loja)
            .Include(q => q.Operador)
            .Include(q => q.Produto)
            .OrderByDescending(q => q.DataRegisto)
            .Select(q => new
            {
                q.DataRegisto,
                LojaNome      = q.Loja != null ? q.Loja.Nome : "—",
                ProdutoArtigo = q.Produto != null ? q.Produto.Artigo : "—",
                PrecoCustoUnitario = q.Produto != null ? q.Produto.PrecoCusto : 0m,
                q.Quantidade,
                q.ValorPerdido,
                q.Motivo,
                OperadorNome = q.Operador != null ? q.Operador.Nome : "—"
            })
            .ToListAsync();

        var resultado = quebras.Select(q => new QuebraRelatorioDto
        {
            Data          = q.DataRegisto.ToLocalTime().ToString("dd/MM/yyyy"),
            Loja          = q.LojaNome,
            Artigo        = q.ProdutoArtigo,
            Quantidade    = q.Quantidade,
            PrecoCusto    = Math.Round(q.PrecoCustoUnitario, 2),
            PerdaTotal    = Math.Round(q.ValorPerdido, 2),
            Motivo        = FormatarMotivo(q.Motivo),
            OperadorTurno = $"{q.OperadorNome} ({Turno(q.DataRegisto)})"
        }).ToList();

        return Ok(resultado);
    }

    // ─── Helpers privados ────────────────────────────────────────

    /// <summary>
    /// Infere o turno a partir da hora (convenção operacional):
    /// T1 até às 14:00, T2 depois.
    /// </summary>
    private static string Turno(DateTime utc)
    {
        var local = utc.ToLocalTime();
        return local.Hour < 14 ? "T1" : "T2";
    }

    /// <summary>
    /// Converte o enum MotivoQuebra no label esperado pelo frontend
    /// (o MotivoBadge do React tem mapa para estas strings exactas).
    /// </summary>
    private static string FormatarMotivo(MotivoQuebra motivo) => motivo switch
    {
        MotivoQuebra.ValidadeExpirada     => "Validade",
        MotivoQuebra.DanoQuebraFisica     => "Dano Físico",
        MotivoQuebra.FurtoDesaparecimento => "Furto",
        _                                 => motivo.ToString()
    };
}
