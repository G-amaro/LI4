using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Produto do catálogo central.
/// Propagado para os terminais POS via sincronização (RF3/UC06).
/// </summary>
public class Produto
{
    [Key]
    public int Id { get; set; }

    /// <summary>Código de barras (EAN-13). Único em toda a cadeia.</summary>
    [Required]
    [MaxLength(13)]
    public string EAN { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Artigo { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Categoria { get; set; } = string.Empty;

    /// <summary>Preço pago ao fornecedor. Usado no cálculo de Margem Bruta e custo de quebras.</summary>
    public decimal PrecoCusto { get; set; }

    /// <summary>Preço de Venda ao Público (com IVA incluído).</summary>
    public decimal PVP { get; set; }

    /// <summary>
    /// Se true, o POS exige registo de Lote e Validade na receção (UC04/FE1).
    /// Funcionalidade completa de lotes deferida — flag mantida por compatibilidade.
    /// </summary>
    public bool Perecivel { get; set; } = false;

    /// <summary>Taxa de IVA aplicável (%). Ex: 23.00, 13.00, 6.00</summary>
    public decimal TaxaIVA { get; set; } = 23.00m;

    /// <summary>URL de imagem do produto (opcional). Se preenchido, o POS usa este URL.</summary>
    public string? ImagemUrl { get; set; }
}
