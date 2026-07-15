using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Api.DTOs;

/// <summary>
/// Transferência (envio ou recepção) enviada pelo POS para sincronização.
/// Guid gerado localmente.
/// </summary>
public class SyncTransferenciaDto
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    public TipoMovimentoTransferencia TipoMovimento { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int LojaOrigemId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int LojaDestinoId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataMovimento { get; set; }

    /// <summary>NULL em ENVIO, obrigatório em RECECAO.</summary>
    public Guid? TransferenciaEnvioId { get; set; }

    [MaxLength(100)]
    public string? DocumentoReferencia { get; set; }

    [MaxLength(500)]
    public string? Observacoes { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncLinhaTransferenciaDto> Linhas { get; set; } = new();
}

public class SyncLinhaTransferenciaDto
{
    [Required]
    [Range(1, int.MaxValue)]
    public int ProdutoId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int Quantidade { get; set; }
}

// ═══════════════════════════════════════════════════════════════════
// REQUESTS / RESPONSES
// ═══════════════════════════════════════════════════════════════════

public class SyncTransferenciasRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncTransferenciaDto> Transferencias { get; set; } = new();
}

public class SyncTransferenciasResponse
{
    public DateTime ProcessadoEm    { get; set; }
    public int TotalRecebidas       { get; set; }
    public int TotalInseridas       { get; set; }
    public int TotalDuplicadas      { get; set; }
    public List<SyncItemErro> Erros { get; set; } = new();
    public bool Sucesso             => !Erros.Any();
}

// ═══════════════════════════════════════════════════════════════════
// RESPOSTA DO GET /api/sync/transferencias/pendentes
// ═══════════════════════════════════════════════════════════════════

/// <summary>
/// Guia de envio a devolver à Loja destino — para gravar na sua BD local
/// e permitir registo de recepção offline.
/// </summary>
public class GuiaTransferenciaPendenteDto
{
    public Guid      Id                  { get; set; }
    public int       LojaOrigemId        { get; set; }
    public string    LojaOrigemNome      { get; set; } = string.Empty;
    public int       LojaDestinoId       { get; set; }
    public DateTime  DataMovimento       { get; set; }
    public string?   DocumentoReferencia { get; set; }
    public string?   Observacoes         { get; set; }

    public List<GuiaLinhaDto> Linhas { get; set; } = new();
}

public class GuiaLinhaDto
{
    public int    ProdutoId  { get; set; }
    public string EAN        { get; set; } = string.Empty;
    public string Artigo     { get; set; } = string.Empty;
    public string Categoria  { get; set; } = string.Empty;
    public int    Quantidade { get; set; }
}
