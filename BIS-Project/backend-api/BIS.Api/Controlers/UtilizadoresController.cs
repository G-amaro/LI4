using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de gestão de utilizadores (UC11 — Kill Switch).
/// Consumido pelo Backoffice Web da Sede.
///
/// Nota de segurança:
///   Para o MVP este controlador está aberto para facilitar o
///   desenvolvimento do frontend. Em produção deve ser protegido
///   com [Authorize(Roles = "Administrador,GerenteSede")].
/// </summary>
[ApiController]
[Route("api/utilizadores")]
[Authorize(Roles = "Administrador")]
public class UtilizadoresController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<UtilizadoresController> _logger;

    public UtilizadoresController(
        ApplicationDbContext db,
        ILogger<UtilizadoresController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ─── GET /api/utilizadores ───────────────────────────────────

    /// <summary>
    /// Lista todos os utilizadores do sistema.
    /// Inclui o nome da loja base para facilitar visualização.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UtilizadorDto>>> GetAll()
    {
        var utilizadores = await _db.Utilizadores
            .AsNoTracking()
            .Include(u => u.LojaBase)
            .OrderBy(u => u.Nome)
            .Select(u => new UtilizadorDto
            {
                Id           = u.Id,
                Nome         = u.Nome,
                NIF          = u.NIF,
                Email        = u.Email,
                Perfil       = u.Perfil.ToString(),
                PinPOS          = u.PinPOS,  // ver nota de segurança no DTO
                Ativo        = u.EstadoConta == EstadoConta.Ativo,
                LojaBaseId   = u.LojaBaseId,
                LojaBaseNome = u.LojaBase != null ? u.LojaBase.Nome : string.Empty
            })
            .ToListAsync();

        return Ok(utilizadores);
    }

    // ─── POST /api/utilizadores ──────────────────────────────────

    [HttpPost]
    public async Task<ActionResult<UtilizadorDto>> Criar([FromBody] CriarUtilizadorDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Regra: NIF único
        var nifExiste = await _db.Utilizadores
            .AsNoTracking()
            .AnyAsync(u => u.NIF == dto.NIF);

        if (nifExiste)
            return Conflict(new { message = $"Já existe um utilizador com o NIF {dto.NIF}." });

        // Regra: email único (quando fornecido)
        if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            var emailExiste = await _db.Utilizadores
                .AsNoTracking()
                .AnyAsync(u => u.Email == dto.Email);

            if (emailExiste)
                return Conflict(new { message = $"Já existe um utilizador com o email {dto.Email}." });
        }

        // Regra: LojaBase tem de existir
        var lojaExiste = await _db.Lojas.AsNoTracking().AnyAsync(l => l.Id == dto.LojaBaseId);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {dto.LojaBaseId} não existe." });

        var utilizador = new Utilizador
        {
            Nome        = dto.Nome.Trim(),
            NIF         = dto.NIF,
            Email       = dto.Email?.Trim(),
            Perfil      = dto.Perfil,
            PinPOS    = dto.PinPOS,       // MVP: ainda em plaintext — débito técnico
            PasswordHash = string.Empty, // só Admin/Gerentes precisam (login web)
            EstadoConta = EstadoConta.Ativo,
            LojaBaseId  = dto.LojaBaseId
        };

        try
        {
            _db.Utilizadores.Add(utilizador);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Erro ao criar utilizador {Nif}", dto.NIF);
            return StatusCode(500, new { message = "Erro interno ao gravar o utilizador." });
        }

        // Recarregar com a loja para devolver DTO completo
        await _db.Entry(utilizador).Reference(u => u.LojaBase).LoadAsync();

        var resultado = new UtilizadorDto
        {
            Id           = utilizador.Id,
            Nome         = utilizador.Nome,
            NIF          = utilizador.NIF,
            Email        = utilizador.Email,
            Perfil       = utilizador.Perfil.ToString(),
            PinPOS          = utilizador.PinPOS,
            Ativo        = true,
            LojaBaseId   = utilizador.LojaBaseId,
            LojaBaseNome = utilizador.LojaBase?.Nome ?? string.Empty
        };

        _logger.LogInformation("Utilizador criado: {Id} — {Nome}", utilizador.Id, utilizador.Nome);
        return CreatedAtAction(nameof(GetAll), new { id = utilizador.Id }, resultado);
    }

    // ─── PUT /api/utilizadores/{id}/toggle-status ────────────────

    /// <summary>
    /// Kill Switch — alterna o estado Ativo ↔ Inativo.
    ///
    /// Regra de negócio: não alteramos contas com estado 'Bloqueado'
    /// (reservado para lock automático após tentativas falhadas) — essas
    /// exigem desbloqueio explícito por outro endpoint (futuro trabalho).
    /// </summary>
    [HttpPut("{id:int}/toggle-status")]
    public async Task<ActionResult<UtilizadorDto>> ToggleStatus(int id)
    {
        var utilizador = await _db.Utilizadores
            .Include(u => u.LojaBase)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (utilizador is null)
            return NotFound(new { message = $"Utilizador {id} não encontrado." });

        if (utilizador.EstadoConta == EstadoConta.Bloqueado)
        {
            return BadRequest(new
            {
                message = "Contas bloqueadas não podem ser alternadas. " +
                          "Desbloqueie a conta antes de alterar o estado."
            });
        }

        var estadoAnterior = utilizador.EstadoConta;
        utilizador.EstadoConta = estadoAnterior == EstadoConta.Ativo
            ? EstadoConta.Inativo
            : EstadoConta.Ativo;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Erro ao toggle utilizador {Id}", id);
            return StatusCode(500, new { message = "Erro interno ao alterar estado." });
        }

        _logger.LogInformation(
            "Kill Switch: utilizador {Id} ({Nome}) {Antes} → {Depois}",
            utilizador.Id, utilizador.Nome, estadoAnterior, utilizador.EstadoConta);

        return Ok(new UtilizadorDto
        {
            Id           = utilizador.Id,
            Nome         = utilizador.Nome,
            NIF          = utilizador.NIF,
            Email        = utilizador.Email,
            Perfil       = utilizador.Perfil.ToString(),
            PinPOS          = utilizador.PinPOS,
            Ativo        = utilizador.EstadoConta == EstadoConta.Ativo,
            LojaBaseId   = utilizador.LojaBaseId,
            LojaBaseNome = utilizador.LojaBase?.Nome ?? string.Empty
        });
    }
}
