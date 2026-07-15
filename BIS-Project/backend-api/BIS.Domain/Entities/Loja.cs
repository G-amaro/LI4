using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Loja física da cadeia BragaConvenience.
///
/// TemPOS = true  → loja operacional com terminal POS (Fraião, Centro, Gualtar)
/// TemPOS = false → unidade administrativa sem POS (Sede — só backoffice)
/// </summary>
public class Loja
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Localidade { get; set; }

    public EstadoRede EstadoRede { get; set; } = EstadoRede.Offline;

    public DateTime? UltimaSincronizacao { get; set; }

    /// <summary>
    /// true  = loja com POS (Fraião, Centro, Gualtar) — aceita sync, aparece em selectors
    /// false = unidade sem POS (Sede) — só backoffice, excluída de toda a operação POS
    /// </summary>
    public bool TemPOS { get; set; } = true;

    // ─── Navigation ──────────────────────────────────────────────
    public ICollection<Utilizador>    Utilizadores           { get; set; } = new List<Utilizador>();
    public ICollection<Venda>         Vendas                 { get; set; } = new List<Venda>();
    public ICollection<Quebra>        Quebras                { get; set; } = new List<Quebra>();
    public ICollection<FechoCaixa>    Fechos                 { get; set; } = new List<FechoCaixa>();
    public ICollection<Transferencia> TransferenciasEnviadas  { get; set; } = new List<Transferencia>();
    public ICollection<Transferencia> TransferenciasRecebidas { get; set; } = new List<Transferencia>();
}
