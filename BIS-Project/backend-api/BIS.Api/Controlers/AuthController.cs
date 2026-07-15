using BIS.Api.DTOs;
using BIS.Api.Services;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de autenticação para Backoffice Web e Terminais POS.
/// Gera JWT Bearer Tokens após validação de credenciais.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IJwtService _jwt;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ApplicationDbContext db,
        IJwtService jwt,
        ILogger<AuthController> logger)
    {
        _db     = db;
        _jwt    = jwt;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────
    /// <summary>
    /// Login para o Backoffice Web (email + password).
    /// Só utilizadores com Email e PasswordHash definidos podem usar este endpoint
    /// (i.e. perfis Administrador e GerenteSede).
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> LoginBackoffice([FromBody] LoginBackofficeRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var utilizador = await _db.Utilizadores
            .Include(u => u.LojaBase)
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        // Mensagem genérica para não revelar se o email existe (segurança).
        if (utilizador is null || string.IsNullOrEmpty(utilizador.PasswordHash))
        {
            _logger.LogWarning("Tentativa de login falhada para email {Email}", request.Email);
            return Unauthorized(new { message = "Credenciais inválidas." });
        }

        if (utilizador.EstadoConta != EstadoConta.Ativo)
        {
            _logger.LogWarning("Login bloqueado — conta {UserId} em estado {Estado}",
                utilizador.Id, utilizador.EstadoConta);
            return Unauthorized(new { message = "Conta inativa ou bloqueada." });
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, utilizador.PasswordHash))
        {
            _logger.LogWarning("Password inválida para utilizador {UserId}", utilizador.Id);
            return Unauthorized(new { message = "Credenciais inválidas." });
        }

        // Backoffice é para Administrador e GerenteSede apenas.
        if (utilizador.Perfil != PerfilUtilizador.Administrador &&
            utilizador.Perfil != PerfilUtilizador.GerenteSede)
        {
            return StatusCode(403, new { message = "Acesso ao Backoffice reservado a perfis de administração." });
        }

        utilizador.UltimoLogin = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildResponse(utilizador));
    }

    // ─────────────────────────────────────────────────────────
    /// <summary>
    /// Login para Terminal POS (NIF + PIN).
    /// Autentica qualquer operador ativo associado à loja especificada.
    /// </summary>
    [HttpPost("pos-login")]
    public async Task<ActionResult<LoginResponse>> LoginPos([FromBody] LoginPosRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var utilizador = await _db.Utilizadores
            .Include(u => u.LojaBase)
            .FirstOrDefaultAsync(u => u.NIF == request.NIF);

        if (utilizador is null)
        {
            _logger.LogWarning("POS login — NIF {Nif} não encontrado", request.NIF);
            return Unauthorized(new { message = "NIF ou PIN inválidos." });
        }

        if (utilizador.EstadoConta != EstadoConta.Ativo)
            return Unauthorized(new { message = "Conta inativa ou bloqueada." });

        if (!BCrypt.Net.BCrypt.Verify(request.Pin, utilizador.PinPOS))
        {
            _logger.LogWarning("POS login — PIN inválido para utilizador {UserId}", utilizador.Id);
            return Unauthorized(new { message = "NIF ou PIN inválidos." });
        }

        // Restrição de terminal: operador só pode logar na sua loja base
        // (admins e gerentes de sede podem aceder a qualquer loja — relax quando implementarmos).
        var isAdmin = utilizador.Perfil == PerfilUtilizador.Administrador ||
                      utilizador.Perfil == PerfilUtilizador.GerenteSede;
        if (!isAdmin && utilizador.LojaBaseId != request.LojaId)
        {
            _logger.LogWarning("POS login — user {UserId} (loja {Base}) tentou aceder à loja {Target}",
                utilizador.Id, utilizador.LojaBaseId, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para operar neste terminal." });
        }

        utilizador.UltimoLogin = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildResponse(utilizador));
    }

    // ─────────────────────────────────────────────────────────
    private LoginResponse BuildResponse(Domain.Entities.Utilizador u)
    {
        var (token, expiresAt) = _jwt.GenerateToken(u);

        return new LoginResponse
        {
            Token      = token,
            ExpiresAt  = expiresAt,
            Utilizador = new UtilizadorDto
            {
                Id           = u.Id,
                Nome         = u.Nome,
                NIF          = u.NIF,
                Email        = u.Email,
                Perfil       = u.Perfil.ToString(),
                LojaBaseId   = u.LojaBaseId,
                LojaBaseNome = u.LojaBase?.Nome ?? string.Empty
            }
        };
    }
}
