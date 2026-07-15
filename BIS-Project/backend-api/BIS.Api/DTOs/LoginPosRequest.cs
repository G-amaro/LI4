using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// Payload de login no Terminal POS.
///
/// Usa NIF + PIN em vez de email+password porque:
///   - O PIN é introduzido num Numpad tátil (4-6 dígitos numéricos)
///   - Os operadores de loja podem não ter email registado
///   - O NIF é garantidamente único e memorizável pelos utilizadores
/// </summary>
public class LoginPosRequest
{
    [Required]
    [RegularExpression(@"^\d{9}$", ErrorMessage = "NIF deve conter exatamente 9 dígitos.")]
    public string NIF { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN deve ter entre 4 e 6 dígitos.")]
    public string Pin { get; set; } = string.Empty;

    /// <summary>
    /// ID da loja onde o POS está instalado. Impede que um operador de Fraião
    /// abra sessão acidentalmente no terminal do Centro.
    /// </summary>
    [Required]
    public int LojaId { get; set; }
}
