using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Receção de mercadoria (UC09) — entrada de stock numa loja.
///
/// Imutabilidade: após sincronização, uma receção não pode ser alterada.
/// Correções fazem-se por nova receção com quantidades correctivas.
/// </summary>
public class Rececao
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public int LojaId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataRececao { get; set; }

    [MaxLength(100)]
    public string? DocumentoReferencia { get; set; }

    public int NumeroLinhas  { get; set; }
    public int TotalUnidades { get; set; }

    public DateTime? DataSincronizacao { get; set; }

    // ─── Navigation ──────────────────────────────────────────────
    public Loja?       Loja     { get; set; }
    public Utilizador? Operador { get; set; }
    public int? FornecedorId { get; set; }    // nullable: receções antigas ficam sem fornecedor
    public Fornecedor? Fornecedor { get; set; }
    public ICollection<LinhaRececao> Linhas { get; set; } = new List<LinhaRececao>();
}
