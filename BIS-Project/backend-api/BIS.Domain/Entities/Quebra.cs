using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Registo de abate de inventário por motivo não-transacional (UC08).
///
/// CHAVE: Guid gerado localmente no POS (igual a Venda).
/// IMUTABILIDADE: uma quebra submetida não pode ser editada ou apagada;
/// correções fazem-se por novo registo de acerto.
/// </summary>
public class Quebra
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public int LojaId { get; set; }

    [Required]
    public int OperadorId { get; set; }

    [Required]
    public int ProdutoId { get; set; }

    public int Quantidade { get; set; }

    /// <summary>Valor = Quantidade * PrecoCusto do Produto no momento do abate.</summary>
    public decimal ValorPerdido { get; set; }

    public MotivoQuebra Motivo { get; set; }

    [Required]
    public DateTime DataRegisto { get; set; }

    /// <summary>Timestamp da receção na Sede. NULL significa "pendente de sincronização".</summary>
    public DateTime? DataSincronizacao { get; set; }

    // Navigation
    public Loja?       Loja     { get; set; }
    public Utilizador? Operador { get; set; }
    public Produto?    Produto  { get; set; }
}
