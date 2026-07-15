using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Linha de uma Receção — produto + quantidade recebida.
/// </summary>
public class LinhaRececao
{
    [Key]
    public int Id { get; set; }

    [Required]
    public Guid RececaoId { get; set; }

    [Required]
    public int ProdutoId { get; set; }

    [Required]
    public int Quantidade { get; set; }


    /// <summary>
    /// Identificação do lote do fornecedor. Obrigatório para produtos
    /// perecíveis (Produto.Perecivel = true). Opcional para os restantes.
    /// </summary>
    [MaxLength(50)]
    public string? Lote { get; set; }

    /// <summary>
    /// Data de validade. Obrigatória para produtos perecíveis.
    /// </summary>
    public DateTime? DataValidade { get; set; }
    
    public decimal PrecoCusto { get; set; } = 0;
    
    // ─── Navigation ──────────────────────────────────────────────
    public Rececao? Rececao { get; set; }
    public Produto? Produto { get; set; }
}
