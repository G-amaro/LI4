using BIS.Domain.Entities;

namespace BIS.Api.Services;

/// <summary>
/// Abstração da geração de JWT para permitir testes e substituição fácil.
/// </summary>
public interface IJwtService
{
    /// <summary>
    /// Gera um JWT para o utilizador especificado, incluindo claims de perfil e loja.
    /// </summary>
    /// <param name="utilizador">Utilizador autenticado.</param>
    /// <returns>Tuplo com o token serializado e o instante de expiração UTC.</returns>
    (string Token, DateTime ExpiresAt) GenerateToken(Utilizador utilizador);
}
