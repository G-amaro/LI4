using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Api.DTOs;

/// <summary>
/// Quebra de stock enviada pelo POS para sincronização.
/// Guid gerado localmente no POS (idempotência por chave primária).
/// </summary>
public class SyncQuebraDto
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int OperadorId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int ProdutoId { get; set; }

    [Range(1, int.MaxValue)]
    public int Quantidade { get; set; }

    [Range(0, double.MaxValue)]
    public decimal ValorPerdido { get; set; }

    [Required]
    public MotivoQuebra Motivo { get; set; }

    [Required]
    public DateTime DataRegisto { get; set; }
}

public class SyncQuebrasRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncQuebraDto> Quebras { get; set; } = new();
}

public class SyncQuebrasResponse
{
    public DateTime ProcessadoEm    { get; set; }
    public int TotalRecebidas       { get; set; }
    public int TotalInseridas       { get; set; }
    public int TotalDuplicadas      { get; set; }
    public List<SyncItemErro> Erros { get; set; } = new();
    public bool Sucesso             => !Erros.Any();
}
