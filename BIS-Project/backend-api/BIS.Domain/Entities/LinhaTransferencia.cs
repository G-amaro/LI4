using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Linha de uma Transferência — produto + quantidade.
/// Uma Transferência tem 1..N linhas.
/// </summary>
public class LinhaTransferencia
{
    [Key]
    public int Id { get; set; }

    [Required]
    public Guid TransferenciaId { get; set; }

    [Required]
    public int ProdutoId { get; set; }

    [Required]
    public int Quantidade { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Transferencia? Transferencia { get; set; }
    public Produto?       Produto       { get; set; }
}
