using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// Envelope que o POS envia ao chamar POST /api/sync/vendas.
/// Pode conter uma ou mais vendas acumuladas offline.
/// </summary>
public class SyncVendasRequest
{
    /// <summary>
    /// ID da loja que está a fazer sync (validado contra o JWT claim loja_id).
    /// </summary>
    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "O batch deve conter pelo menos uma venda.")]
    public List<SyncVendaDto> Vendas { get; set; } = new();
}
