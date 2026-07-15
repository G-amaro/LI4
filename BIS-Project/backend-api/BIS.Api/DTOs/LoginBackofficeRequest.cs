using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>Payload de login para o Backoffice Web (email + password).</summary>
public class LoginBackofficeRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}
