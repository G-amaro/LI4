using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Linha de uma Devolução — produto + quantidade + preço original.
/// O preço unitário é o da venda original (imutável).
/// </summary>
public class LinhaDevolucao
{
    [Key]
    public int Id { get; set; }

    [Required]
    public Guid DevolucaoId { get; set; }

    [Required]
    public int ProdutoId { get; set; }

    [Required]
    public int Quantidade { get; set; }

    [Required]
    public decimal PrecoUnitario { get; set; }

    [Required]
    public decimal Subtotal { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Devolucao? Devolucao { get; set; }
    public Produto?   Produto   { get; set; }
}
