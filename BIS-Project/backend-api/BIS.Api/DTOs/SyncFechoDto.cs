using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// Fecho de caixa enviado pelo POS para sincronização.
/// Inclui valores teóricos e contados para auditoria na Sede.
/// </summary>
public class SyncFechoDto
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
    public DateTime DataFecho { get; set; }

    // Valores teóricos (calculados pelo sistema)
    public decimal TeoricoNumerario  { get; set; }
    public decimal TeoricoMultibanco { get; set; }
    public decimal TeoricoMbway      { get; set; }
    public decimal TeoricoTotal      { get; set; }

    // Valores declarados pelo operador
    public decimal ContadoNumerario  { get; set; }
    public decimal ContadoMultibanco { get; set; }
    public decimal ContadoMbway      { get; set; }
    public decimal ContadoTotal      { get; set; }

    public decimal Discrepancia      { get; set; }
    public bool    TemDiscrepancia   { get; set; }

    [MaxLength(1000)]
    public string? Justificacao      { get; set; }
}

public class SyncFechosRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncFechoDto> Fechos { get; set; } = new();
}

public class SyncFechosResponse
{
    public DateTime ProcessadoEm    { get; set; }
    public int TotalRecebidas       { get; set; }
    public int TotalInseridas       { get; set; }
    public int TotalDuplicadas      { get; set; }
    public List<SyncItemErro> Erros { get; set; } = new();
    public bool Sucesso             => !Erros.Any();
}
