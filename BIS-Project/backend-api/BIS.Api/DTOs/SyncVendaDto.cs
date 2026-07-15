using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Api.DTOs;

/// <summary>
/// Representação de uma Venda gerada offline no POS e enviada para a Sede.
///
/// O Guid <see cref="Id"/> é gerado pelo POS no momento da transação e é
/// o mecanismo central de idempotência: se a rede cair após a Sede persistir
/// mas antes de o POS receber o 200 OK, o próximo envio é ignorado na Sede
/// porque o Guid já existe.
/// </summary>
public class SyncVendaDto
{
    /// <summary>UUID gerado pelo POS offline. Chave de idempotência.</summary>
    [Required]
    public Guid Id { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int LojaId { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int OperadorId { get; set; }

    [Required]
    public DateTime DataTransacao { get; set; }

    [Range(0.01, 99999.99)]
    public decimal ValorTotal { get; set; }

    [Required]
    public MetodoPagamento MetodoPagamento { get; set; }

    [MaxLength(9)]
    [RegularExpression(@"^\d{9}$", ErrorMessage = "NIF deve ter 9 dígitos.")]
    public string? NifCliente { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Uma venda tem de ter pelo menos uma linha.")]
    public List<SyncLinhaVendaDto> Linhas { get; set; } = new();
}
