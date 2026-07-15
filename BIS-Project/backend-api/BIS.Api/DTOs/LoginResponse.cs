namespace BIS.Api.DTOs;

/// <summary>Resposta de login (backoffice ou POS).</summary>
public class LoginResponse
{
    /// <summary>JWT Bearer Token. A incluir no header Authorization das requests seguintes.</summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>Instante de expiração do token (UTC).</summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>Dados do utilizador autenticado para a UI pré-carregar contexto.</summary>
    public UtilizadorDto Utilizador { get; set; } = null!;
}
