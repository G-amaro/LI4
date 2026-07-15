using BIS.Api.DTOs;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de relatórios de transferências entre lojas (UC10) para o Backoffice.
/// Acesso restrito a Administrador e GerenteSede.
/// </summary>
[ApiController]
[Route("api/relatorios/transferencias")]
public class RelatorioTransferenciasController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<RelatorioTransferenciasController> _logger;

    public RelatorioTransferenciasController(
        ApplicationDbContext db,
        ILogger<RelatorioTransferenciasController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────
    /// <summary>
    /// Lista transferências agregadas (1 linha por envio + recepção opcional).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TransferenciaRelatorioDto>>> Listar(
        [FromQuery] DateTime? dataInicio,
        [FromQuery] DateTime? dataFim,
        [FromQuery] int?     lojaOrigemId,
        [FromQuery] int?     lojaDestinoId,
        [FromQuery] string?  status)
    {
        // Subquery: recepções por envio (key = TransferenciaEnvioId)
        var recepcoes = _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue);

        var query = _db.Transferencias
            .AsNoTracking()
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Envio);

        // ── Filtros ────────────────────────────────────────────────
        if (dataInicio.HasValue)
        {
            var inicio = DateTime.SpecifyKind(dataInicio.Value.Date, DateTimeKind.Utc);
            query = query.Where(t => t.DataMovimento >= inicio);
        }
        if (dataFim.HasValue)
        {
            var fim = DateTime.SpecifyKind(dataFim.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(t => t.DataMovimento < fim);
        }
        if (lojaOrigemId.HasValue && lojaOrigemId.Value > 0)
            query = query.Where(t => t.LojaOrigemId == lojaOrigemId.Value);
        if (lojaDestinoId.HasValue && lojaDestinoId.Value > 0)
            query = query.Where(t => t.LojaDestinoId == lojaDestinoId.Value);

        // ── Materializar com JOIN para recepção correspondente ────
        var envios = await query
            .Include(t => t.LojaOrigem)
            .Include(t => t.LojaDestino)
            .OrderByDescending(t => t.DataMovimento)
            .Select(t => new
            {
                Envio = t,
                Rec   = recepcoes.FirstOrDefault(r => r.TransferenciaEnvioId == t.Id)
            })
            .ToListAsync();

        var resultado = envios.Select(x =>
        {
            var statusReal = "EmTransito";
            int? unidadesRec = null;
            int diferenca = 0;

            if (x.Rec != null)
            {
                unidadesRec = x.Rec.TotalUnidades;
                diferenca   = x.Envio.TotalUnidades - x.Rec.TotalUnidades;
                statusReal  = diferenca == 0 ? "Recebida" : "Divergencia";
            }

            return new TransferenciaRelatorioDto
            {
                EnvioId             = x.Envio.Id,
                DataEnvio           = x.Envio.DataMovimento,
                LojaOrigemId        = x.Envio.LojaOrigemId,
                LojaOrigemNome      = x.Envio.LojaOrigem?.Nome ?? $"Loja #{x.Envio.LojaOrigemId}",
                LojaDestinoId       = x.Envio.LojaDestinoId,
                LojaDestinoNome     = x.Envio.LojaDestino?.Nome ?? $"Loja #{x.Envio.LojaDestinoId}",
                DocumentoReferencia = x.Envio.DocumentoReferencia,
                NumeroLinhas        = x.Envio.NumeroLinhas,
                UnidadesEnviadas    = x.Envio.TotalUnidades,
                Status              = statusReal,
                RececaoId           = x.Rec?.Id,
                DataRececao         = x.Rec?.DataMovimento,
                UnidadesRecebidas   = unidadesRec,
                DiferencaUnidades   = diferenca
            };
        }).ToList();

        // ── Filtro de status (aplicado após o cálculo) ───────────
        if (!string.IsNullOrWhiteSpace(status) && status != "Todos")
        {
            resultado = resultado.Where(r => r.Status == status).ToList();
        }

        return Ok(resultado);
    }

    // ─────────────────────────────────────────────────────────────────
    /// <summary>
    /// KPIs agregados — para o cabeçalho da página.
    /// </summary>
    [HttpGet("kpis")]
    public async Task<ActionResult<TransferenciasKpisDto>> Kpis(
        [FromQuery] DateTime? dataInicio,
        [FromQuery] DateTime? dataFim)
    {
        var recepcoes = _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue);

        var enviosQuery = _db.Transferencias
            .AsNoTracking()
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Envio);

        if (dataInicio.HasValue)
        {
            var inicio = DateTime.SpecifyKind(dataInicio.Value.Date, DateTimeKind.Utc);
            enviosQuery = enviosQuery.Where(t => t.DataMovimento >= inicio);
        }
        if (dataFim.HasValue)
        {
            var fim = DateTime.SpecifyKind(dataFim.Value.Date.AddDays(1), DateTimeKind.Utc);
            enviosQuery = enviosQuery.Where(t => t.DataMovimento < fim);
        }

        var lista = await enviosQuery
            .Select(e => new
            {
                e.Id,
                e.TotalUnidades,
                UnidadesRec = recepcoes
                    .Where(r => r.TransferenciaEnvioId == e.Id)
                    .Select(r => (int?)r.TotalUnidades)
                    .FirstOrDefault()
            })
            .ToListAsync();

        var kpis = new TransferenciasKpisDto
        {
            Total          = lista.Count,
            EmTransito     = lista.Count(x => x.UnidadesRec == null),
            Recebidas      = lista.Count(x => x.UnidadesRec != null && x.UnidadesRec == x.TotalUnidades),
            ComDivergencia = lista.Count(x => x.UnidadesRec != null && x.UnidadesRec != x.TotalUnidades),
            UnidadesTotais = lista.Sum(x => x.TotalUnidades)
        };

        return Ok(kpis);
    }

    // ─────────────────────────────────────────────────────────────────
    /// <summary>
    /// Detalhe completo de uma transferência, com linhas comparativas
    /// envio vs recepção. Usado no modal de detalhe do backoffice.
    /// </summary>
    [HttpGet("{envioId:guid}")]
    public async Task<ActionResult<TransferenciaDetalheDto>> Detalhe(Guid envioId)
    {
        var envio = await _db.Transferencias
            .AsNoTracking()
            .Where(t => t.Id == envioId && t.TipoMovimento == TipoMovimentoTransferencia.Envio)
            .Include(t => t.LojaOrigem)
            .Include(t => t.LojaDestino)
            .Include(t => t.Operador)
            .Include(t => t.Linhas).ThenInclude(l => l.Produto)
            .FirstOrDefaultAsync();

        if (envio == null)
            return NotFound(new { message = $"Envio {envioId} não encontrado." });

        var rececao = await _db.Transferencias
            .AsNoTracking()
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId == envioId)
            .Include(t => t.Operador)
            .Include(t => t.Linhas)
            .FirstOrDefaultAsync();

        // ── Construir mapa produto → recebido ────────────────────
        var recebidoPorProduto = new Dictionary<int, int>();
        if (rececao != null)
        {
            foreach (var l in rececao.Linhas)
            {
                if (recebidoPorProduto.ContainsKey(l.ProdutoId))
                    recebidoPorProduto[l.ProdutoId] += l.Quantidade;
                else
                    recebidoPorProduto[l.ProdutoId] = l.Quantidade;
            }
        }

        // ── Status ───────────────────────────────────────────────
        var status = "EmTransito";
        if (rececao != null)
        {
            var diferencaTotal = envio.TotalUnidades - rececao.TotalUnidades;
            status = diferencaTotal == 0 ? "Recebida" : "Divergencia";
        }

        // ── Linhas comparativas ─────────────────────────────────
        var linhas = envio.Linhas.Select(l =>
        {
            int? recebido = recebidoPorProduto.TryGetValue(l.ProdutoId, out var v) ? v : (int?)null;
            return new TransferenciaLinhaComparativaDto
            {
                ProdutoId          = l.ProdutoId,
                EAN                = l.Produto?.EAN       ?? string.Empty,
                Artigo             = l.Produto?.Artigo    ?? "—",
                Categoria          = l.Produto?.Categoria ?? "—",
                QuantidadeEnviada  = l.Quantidade,
                QuantidadeRecebida = recebido,
                Diferenca          = (recebido ?? 0) > 0
                    ? l.Quantidade - (recebido ?? 0)
                    : (rececao == null ? 0 : l.Quantidade)
            };
        }).ToList();

        return Ok(new TransferenciaDetalheDto
        {
            EnvioId             = envio.Id,
            DataEnvio           = envio.DataMovimento,
            LojaOrigemNome      = envio.LojaOrigem?.Nome ?? $"Loja #{envio.LojaOrigemId}",
            LojaDestinoNome     = envio.LojaDestino?.Nome ?? $"Loja #{envio.LojaDestinoId}",
            OperadorEnvioNome   = envio.Operador?.Nome,
            DocumentoReferencia = envio.DocumentoReferencia,
            ObservacoesEnvio    = envio.Observacoes,

            RececaoId           = rececao?.Id,
            DataRececao         = rececao?.DataMovimento,
            OperadorRececaoNome = rececao?.Operador?.Nome,
            ObservacoesRececao  = rececao?.Observacoes,

            Status              = status,
            Linhas              = linhas
        });
    }
}
