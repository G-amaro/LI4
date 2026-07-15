using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>Payload para criar um novo produto no catálogo central (UC06).</summary>
public class CreateProdutoRequest
{
    [Required]
    [RegularExpression(@"^\d{8,13}$", ErrorMessage = "EAN deve ter entre 8 e 13 dígitos.")]
    public string EAN { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Artigo { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Categoria { get; set; } = string.Empty;

    [Range(0.01, 99999.99, ErrorMessage = "Preço de custo deve ser positivo.")]
    public decimal PrecoCusto { get; set; }

    [Range(0.01, 99999.99, ErrorMessage = "PVP deve ser positivo.")]
    public decimal PVP { get; set; }

    public bool Perecivel { get; set; } = false;

    [Range(0, 100, ErrorMessage = "TaxaIVA deve estar entre 0 e 100.")]
    public decimal TaxaIVA { get; set; } = 23.00m;

    [MaxLength(500)]
    public string? ImagemUrl { get; set; }
}
