using System.ComponentModel.DataAnnotations;
using BIS.Domain.Enums;

namespace BIS.Api.DTOs;

/// <summary>
/// DTO de leitura de utilizador — listado no Backoffice (UC11).
///
/// ⚠️ Nota de segurança (MVP académico):
///   Este DTO inclui o PIN em texto plano para permitir visualização
///   no Backoffice, conforme pedido pelos mockups. Em produção, esta
///   funcionalidade seria removida e o PIN seria armazenado via hash
///   irreversível (PBKDF2/Argon2) — nunca devolvido ao frontend.
///   Está declarado como débito técnico na secção "Trabalho Futuro".
/// </summary>
public class UtilizadorDto
{
    public int    Id        { get; set; }
    public string Nome      { get; set; } = string.Empty;
    public string NIF       { get; set; } = string.Empty;
    public string? Email    { get; set; }
    public string Perfil    { get; set; } = string.Empty;   // nome do enum
    public string PinPOS       { get; set; } = string.Empty;
    public bool   Ativo     { get; set; }
    public int    LojaBaseId   { get; set; }
    public string LojaBaseNome { get; set; } = string.Empty;
}

/// <summary>
/// DTO de criação — enviado pelo POST /api/utilizadores.
/// </summary>
public class CriarUtilizadorDto
{
    [Required(ErrorMessage = "O nome é obrigatório.")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 150 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "O NIF é obrigatório.")]
    [RegularExpression(@"^\d{9}$", ErrorMessage = "O NIF deve ter exactamente 9 dígitos.")]
    public string NIF { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Email inválido.")]
    public string? Email { get; set; }

    [Required(ErrorMessage = "O perfil é obrigatório.")]
    public PerfilUtilizador Perfil { get; set; }

    [Required(ErrorMessage = "O PIN é obrigatório.")]
    [RegularExpression(@"^\d{4}$", ErrorMessage = "O PIN deve ter exactamente 4 dígitos.")]
    public string PinPOS { get; set; } = string.Empty;

    [Required(ErrorMessage = "A loja base é obrigatória.")]
    [Range(1, int.MaxValue)]
    public int LojaBaseId { get; set; }
}
