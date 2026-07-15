using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BIS.Domain.Entities;
using Microsoft.IdentityModel.Tokens;

namespace BIS.Api.Services;

/// <summary>
/// Gera JWT Bearer Tokens assinados com HMAC-SHA256.
/// Configurável via appsettings.json secção "Jwt".
/// </summary>
public class JwtService : IJwtService
{
    private readonly string _secret;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int    _expirationMinutes;

    public JwtService(IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection("Jwt");
        _secret   = jwtSection["Secret"]   ?? throw new InvalidOperationException("Jwt:Secret em falta em appsettings.json");
        _issuer   = jwtSection["Issuer"]   ?? "BIS.Api";
        _audience = jwtSection["Audience"] ?? "BIS.Clients";
        _expirationMinutes = int.TryParse(jwtSection["ExpirationMinutes"], out var m) ? m : 480;  // 8h por defeito

        if (_secret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret deve ter pelo menos 32 caracteres.");
    }

    public (string Token, DateTime ExpiresAt) GenerateToken(Utilizador utilizador)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   utilizador.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new(ClaimTypes.Name,               utilizador.Nome),
            new(ClaimTypes.Role,               utilizador.Perfil.ToString()),
            new("loja_id",                     utilizador.LojaBaseId.ToString())
        };

        if (!string.IsNullOrEmpty(utilizador.Email))
            claims.Add(new Claim(JwtRegisteredClaimNames.Email, utilizador.Email));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddMinutes(_expirationMinutes);

        var token = new JwtSecurityToken(
            issuer:              _issuer,
            audience:            _audience,
            claims:              claims,
            notBefore:           DateTime.UtcNow,
            expires:             expiresAt,
            signingCredentials:  creds
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return (tokenString, expiresAt);
    }
}
