using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// Devolução enviada pelo POS para sincronização.
/// GUID gerado localmente (idempotência por Id).
/// </summary>
public class SyncDevolucaoDto
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    public Guid VendaOriginalId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataDevolucao { get; set; }

    [Required]
    [Range(0.01, 9_999_999.99)]
    public decimal ValorReembolsado { get; set; }

    [MaxLength(500)]
    public string? Motivo { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncLinhaDevolucaoDto> Linhas { get; set; } = new();
}

public class SyncLinhaDevolucaoDto
{
    [Required]
    [Range(1, int.MaxValue)]
    public int ProdutoId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int Quantidade { get; set; }

    [Required]
    [Range(0.01, 9_999_999.99)]
    public decimal PrecoUnitario { get; set; }

    [Required]
    [Range(0.01, 9_999_999.99)]
    public decimal Subtotal { get; set; }
}

// ───────────────────────────────────────────────────────────────────

public class SyncDevolucoesRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncDevolucaoDto> Devolucoes { get; set; } = new();
}

public class SyncDevolucoesResponse
{
    public DateTime ProcessadoEm    { get; set; }
    public int TotalRecebidas       { get; set; }
    public int TotalInseridas       { get; set; }
    public int TotalDuplicadas      { get; set; }
    public List<SyncItemErro> Erros { get; set; } = new();
    public bool Sucesso             => !Erros.Any();
}
