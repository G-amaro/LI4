using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Transferência entre lojas (UC10).
///
/// Modelo: cada EVENTO (ENVIO ou RECECAO) é uma linha nesta tabela.
/// Um ENVIO gerado pela Loja A e a RECECAO gerada pela Loja B são
/// duas entradas ligadas por TransferenciaEnvioId.
///
/// CHAVE: Guid gerado localmente no POS (igual a Venda, Quebra, Fecho).
/// IMUTABILIDADE: após sincronização, um movimento não pode ser alterado.
///
/// Garante idempotência via UNIQUE(TipoMovimento, TransferenciaEnvioId) —
/// previne duplicação se a mesma RECECAO for sincronizada 2x.
/// </summary>
public class Transferencia
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public TipoMovimentoTransferencia TipoMovimento { get; set; }

    [Required]
    public int LojaOrigemId { get; set; }

    [Required]
    public int LojaDestinoId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataMovimento { get; set; }

    /// <summary>
    /// FK para o ENVIO original. NULL em registos de ENVIO, preenchido em RECECAO.
    /// </summary>
    public Guid? TransferenciaEnvioId { get; set; }

    [MaxLength(100)]
    public string? DocumentoReferencia { get; set; }

    [MaxLength(500)]
    public string? Observacoes { get; set; }

    public int NumeroLinhas  { get; set; }
    public int TotalUnidades { get; set; }

    /// <summary>Timestamp da recepção na Sede.</summary>
    public DateTime? DataSincronizacao { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Loja?       LojaOrigem   { get; set; }
    public Loja?       LojaDestino  { get; set; }
    public Utilizador? Operador     { get; set; }

    /// <summary>Self-reference: a RECECAO aponta para o ENVIO original.</summary>
    public Transferencia? Envio { get; set; }

    public ICollection<LinhaTransferencia> Linhas { get; set; } = new List<LinhaTransferencia>();
}
