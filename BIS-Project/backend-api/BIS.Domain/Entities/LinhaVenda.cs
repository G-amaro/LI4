using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Linha individual de uma Venda (um produto + quantidade + preço).
///
/// NOTA DE DESIGN: A PK é Id sintético (int auto-increment), NÃO (VendaId, ProdutoId).
/// Razão: permite adicionar o mesmo produto em linhas separadas sem violação de unicidade
/// (ex: operador adiciona 2 iogurtes e depois mais 1 numa linha nova).
/// O schema do relatório tinha PK composta mas isso é um bug operacional.
/// </summary>
public class LinhaVenda
{
    [Key]
    public int Id { get; set; }

    [Required]
    public Guid VendaId { get; set; }

    [Required]
    public int ProdutoId { get; set; }

    /// <summary>Quantidade. Decimal para suportar produtos pesados (ex: 0.200 kg de queijo).</summary>
    public decimal Quantidade { get; set; }

    /// <summary>Preço unitário no momento da venda (snapshot). Crítico para devoluções corretas.</summary>
    public decimal PrecoUnitario { get; set; }

    /// <summary>Subtotal = Quantidade * PrecoUnitario (persistido para evitar recálculos em relatórios).</summary>
    public decimal Subtotal { get; set; }

    // Navigation
    public Venda?   Venda   { get; set; }
    public Produto? Produto { get; set; }
}
