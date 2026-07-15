using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Devolução de artigo (UC02) — reembolso ao cliente com reposição de stock.
///
/// Imutabilidade: após sincronização, uma devolução não pode ser alterada
/// (apenas "estornada" com outra operação, se necessário — fora do scope).
///
/// FK para Venda: vincula-se à venda original para rastreabilidade fiscal
/// (alinhamento com notas de crédito AT).
/// </summary>
public class Devolucao
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>ID da venda original — GUID gerado no POS.</summary>
    [Required]
    public Guid VendaOriginalId { get; set; }

    [Required]
    public int LojaId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataDevolucao { get; set; }

    [Required]
    public decimal ValorReembolsado { get; set; }

    [MaxLength(500)]
    public string? Motivo { get; set; }

    public DateTime? DataSincronizacao { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Venda?      VendaOriginal { get; set; }
    public Loja?       Loja          { get; set; }
    public Utilizador? Operador      { get; set; }

    public ICollection<LinhaDevolucao> Linhas { get; set; } = new List<LinhaDevolucao>();
}
