using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// DTO de sincronização de uma receção do POS para a Sede.
/// Inclui campos da Fase 2 (Lote/Validade) e Fase 4 (Fornecedor + PrecoCusto).
/// </summary>
public class SyncRececaoDto
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataRececao { get; set; }

    [MaxLength(100)]
    public string? DocumentoReferencia { get; set; }

    /// <summary>
    /// Fase 4: ID do fornecedor.
    /// Nullable para compatibilidade com receções antigas (sem fornecedor).
    /// Em receções novas (após Fase 4) o POS preenche sempre.
    /// </summary>
    public int? FornecedorId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncLinhaRececaoDto> Linhas { get; set; } = new();
}

public class SyncLinhaRececaoDto
{
    [Required]
    [Range(1, int.MaxValue)]
    public int ProdutoId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int Quantidade { get; set; }

    [MaxLength(50)]
    public string? Lote { get; set; }

    public DateTime? DataValidade { get; set; }

    /// <summary>
    /// Fase 4: Preço de custo pago naquela receção específica (€/unidade).
    /// Default 0 para compatibilidade com receções antigas.
    /// </summary>
    [Range(0, 999999.99)]
    public decimal PrecoCusto { get; set; } = 0;
}

// ───────────────────────────────────────────────────────────────────

public class SyncRececoesRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1)]
    public List<SyncRececaoDto> Rececoes { get; set; } = new();
}

public class SyncRececoesResponse
{
    public DateTime ProcessadoEm    { get; set; }
    public int TotalRecebidas       { get; set; }
    public int TotalInseridas       { get; set; }
    public int TotalDuplicadas      { get; set; }
    public List<SyncItemErro> Erros { get; set; } = new();
    public bool Sucesso             => !Erros.Any();
}
