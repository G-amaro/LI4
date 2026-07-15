using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// DTO para criação de um novo produto no catálogo (UC06).
/// Enviado pelo Backoffice Web via POST /api/catalogo.
/// </summary>
public class CriarProdutoDto
{
    /// <summary>Código de barras EAN-13 (13 dígitos) — único no sistema.</summary>
    [Required(ErrorMessage = "O código EAN é obrigatório.")]
    [RegularExpression(@"^\d{13}$", ErrorMessage = "O código EAN deve ter exactamente 13 dígitos.")]
    public string EAN { get; set; } = string.Empty;

    /// <summary>Nome/descrição do artigo exibido no POS.</summary>
    [Required(ErrorMessage = "O nome do artigo é obrigatório.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 200 caracteres.")]
    public string Artigo { get; set; } = string.Empty;

    /// <summary>Categoria do produto (ex: "Bebidas", "Mercearia").</summary>
    [Required(ErrorMessage = "A categoria é obrigatória.")]
    [StringLength(100, MinimumLength = 2)]
    public string Categoria { get; set; } = string.Empty;

    /// <summary>Preço de custo (o que a BragaConvenience paga ao fornecedor).</summary>
    [Range(0.01, 10000, ErrorMessage = "O preço de custo deve estar entre 0,01€ e 10.000€.")]
    public decimal PrecoCusto { get; set; }

    /// <summary>Preço de venda ao público (inclui IVA e margem).</summary>
    [Range(0.01, 10000, ErrorMessage = "O PVP deve estar entre 0,01€ e 10.000€.")]
    public decimal PVP { get; set; }

    /// <summary>Indica se o produto tem prazo de validade (afecta lógica de quebras).</summary>
    public bool Perecivel { get; set; }

    /// <summary>Taxa de IVA aplicável (%). Ex: 23.00, 13.00, 6.00</summary>
    [Range(0, 100, ErrorMessage = "A taxa de IVA deve estar entre 0 e 100.")]
    public decimal TaxaIVA { get; set; } = 23.00m;

    /// <summary>URL de imagem do produto (opcional).</summary>
    [StringLength(500)]
    public string? ImagemUrl { get; set; }
}

