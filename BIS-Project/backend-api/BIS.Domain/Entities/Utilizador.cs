using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Domain.Entities;

/// <summary>
/// Utilizador do sistema (operador, gerente ou administrador).
/// Entidade de catálogo — PK int identity.
///
/// Autenticação:
/// - POS: PIN de 4-6 dígitos (hash em PinPOS)
/// - Backoffice: email + password (hash em PasswordHash)
/// </summary>
public class Utilizador
{
    [Key]
    public int Id { get; set; }

    /// <summary>Loja atribuída. Admins e Gerentes de Sede podem apontar para loja "Sede" lógica.</summary>
    [Required]
    public int LojaBaseId { get; set; }

    [Required]
    [MaxLength(150)]
    public string Nome { get; set; } = string.Empty;

    [Required]
    [MaxLength(9)]
    public string NIF { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? Email { get; set; }

    /// <summary>Hash BCrypt da password para login no Backoffice. Null para operadores de loja.</summary>
    [MaxLength(256)]
    public string? PasswordHash { get; set; }

    /// <summary>Hash BCrypt do PIN numérico para login no POS. Obrigatório para todos os perfis operacionais.</summary>
    [Required]
    [MaxLength(256)]
    public string PinPOS { get; set; } = string.Empty;

    public PerfilUtilizador Perfil { get; set; } = PerfilUtilizador.Funcionario;

    public EstadoConta EstadoConta { get; set; } = EstadoConta.Ativo;

    public DateTime? UltimoLogin { get; set; }

    // Navigation
    public Loja? LojaBase { get; set; }
}
