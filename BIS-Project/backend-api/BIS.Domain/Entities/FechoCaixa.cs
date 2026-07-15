using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Fecho de Caixa Cego (UC03) — registo de reconciliação de turno.
///
/// Persistido na Sede quando o POS sincroniza via POST /api/sync/fechos.
/// Os campos teórico/contado por método de pagamento permitem auditoria
/// detalhada no Backoffice (relatórios financeiros).
///
/// CHAVE: Guid gerado localmente no POS (mesma estratégia de Venda e Quebra).
/// IMUTABILIDADE: após submissão, um fecho não pode ser editado.
/// </summary>
public class FechoCaixa
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public int LojaId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataFecho { get; set; }

    // ─── Valores teóricos (calculados pelo sistema) ───────────────
    public decimal TeoricoNumerario  { get; set; }
    public decimal TeoricoMultibanco { get; set; }
    public decimal TeoricoMbway      { get; set; }
    public decimal TeoricoTotal      { get; set; }

    // ─── Valores declarados pelo operador ─────────────────────────
    public decimal ContadoNumerario  { get; set; }
    public decimal ContadoMultibanco { get; set; }
    public decimal ContadoMbway      { get; set; }
    public decimal ContadoTotal      { get; set; }

    // ─── Resultado da reconciliação ───────────────────────────────

    /// <summary>Contado - Teórico. Positivo = excedente; Negativo = falta.</summary>
    public decimal Discrepancia { get; set; }

    public bool TemDiscrepancia { get; set; }

    /// <summary>Obrigatória se |Discrepancia| > 2€ (validado no POS).</summary>
    [MaxLength(1000)]
    public string? Justificacao { get; set; }

    /// <summary>Timestamp da receção na Sede.</summary>
    public DateTime? DataSincronizacao { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Loja?       Loja     { get; set; }
    public Utilizador? Operador { get; set; }
}
