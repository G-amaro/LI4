using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>Uma linha de produto dentro de uma venda enviada pelo POS.</summary>
public class SyncLinhaVendaDto
{
    /// <summary>
    /// ID do produto (int, gerado na Sede) que o POS recebeu aquando do download do catálogo.
    /// O POS trabalha com estes IDs localmente — não usa EAN para FK.
    /// </summary>
    [Required]
    [Range(1, int.MaxValue)]
    public int ProdutoId { get; set; }

    [Range(0.001, 99999.999, ErrorMessage = "Quantidade deve ser positiva.")]
    public decimal Quantidade { get; set; }

    [Range(0.01, 99999.99, ErrorMessage = "Preço unitário deve ser positivo.")]
    public decimal PrecoUnitario { get; set; }

    public decimal Subtotal { get; set; }
}
