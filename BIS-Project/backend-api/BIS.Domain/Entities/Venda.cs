using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Registo transacional de uma venda no POS (UC01).
///
/// CHAVE: Guid gerado localmente no POS antes da sincronização (RNF1 Offline-First).
/// Previne colisões quando múltiplas lojas enviam transações simultaneamente.
/// </summary>
public class Venda
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public int LojaId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    /// <summary>Momento em que a venda foi concluída no POS local (hora da loja).</summary>
    [Required]
    public DateTime DataTransacao { get; set; }

    /// <summary>Valor total pago pelo cliente (com IVA incluído).</summary>
    public decimal ValorTotal { get; set; }

    public MetodoPagamento MetodoPagamento { get; set; }

    /// <summary>NIF do cliente se solicitou fatura com NIF. Validado pelo algoritmo PT antes de persistir.</summary>
    [MaxLength(9)]
    public string? NifCliente { get; set; }

    /// <summary>
    /// Timestamp da receção na Sede. NULL significa "ainda não sincronizada".
    /// Preenchido pelo endpoint POST /sync/vendas no servidor central.
    /// </summary>
    public DateTime? DataSincronizacao { get; set; }

    // Navigation
    public Loja?        Loja     { get; set; }
    public Utilizador?  Operador { get; set; }
    public ICollection<LinhaVenda> Linhas { get; set; } = new List<LinhaVenda>();
}
