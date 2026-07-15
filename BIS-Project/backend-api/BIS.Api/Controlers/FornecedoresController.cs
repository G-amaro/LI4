using System;
using System.Linq;
using System.Threading.Tasks;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BIS.Api.Controllers;

/// <summary>
/// CRUD de Fornecedores — gestão exclusiva pelo backoffice (Sede).
/// </summary>
[ApiController]
[Route("api/fornecedores")]

public class FornecedoresController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public FornecedoresController(ApplicationDbContext db)
    {
        _db = db;
    }

    // ─── GET /api/fornecedores ────────────────────────────────────
    [HttpGet]
    public async Task<ActionResult<List<FornecedorDto>>> Listar(
        [FromQuery] bool? ativo = null)
    {
        var query = _db.Fornecedores
            .AsNoTracking()
            .Include(f => f.Rececoes!).ThenInclude(r => r.Linhas)
            .AsQueryable();

        if (ativo.HasValue)
            query = query.Where(f => f.Ativo == ativo.Value);

        var fornecedores = await query
            .OrderBy(f => f.Nome)
            .Select(f => new FornecedorDto
            {
                Id           = f.Id,
                Nome         = f.Nome,
                Nif          = f.Nif,
                Telefone     = f.Telefone,
                Email        = f.Email,
                Morada       = f.Morada,
                Observacoes  = f.Observacoes,
                Ativo        = f.Ativo,
                CriadoEm     = f.CriadoEm,
                AtualizadoEm = f.AtualizadoEm,
                NumRececoes  = f.Rececoes!.Count,
                TotalGasto   = f.Rececoes!.SelectMany(r => r.Linhas!).Sum(l => l.PrecoCusto * l.Quantidade)
            })
            .ToListAsync();

        return Ok(fornecedores);
    }

    // ─── GET /api/fornecedores/{id} ───────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FornecedorDto>> Obter(int id)
    {
        var f = await _db.Fornecedores
            .AsNoTracking()
            .Include(x => x.Rececoes!).ThenInclude(r => r.Linhas)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (f is null)
            return NotFound(new { message = $"Fornecedor {id} não encontrado." });

        return Ok(new FornecedorDto
        {
            Id           = f.Id,
            Nome         = f.Nome,
            Nif          = f.Nif,
            Telefone     = f.Telefone,
            Email        = f.Email,
            Morada       = f.Morada,
            Observacoes  = f.Observacoes,
            Ativo        = f.Ativo,
            CriadoEm     = f.CriadoEm,
            AtualizadoEm = f.AtualizadoEm,
            NumRececoes  = f.Rececoes?.Count ?? 0,
            TotalGasto   = f.Rececoes?.SelectMany(r => r.Linhas!).Sum(l => l.PrecoCusto * l.Quantidade) ?? 0
        });
    }

    // ─── POST /api/fornecedores ───────────────────────────────────
    [HttpPost]
    public async Task<ActionResult<FornecedorDto>> Criar([FromBody] CriarFornecedorDto dto)
    {
        // Validação adicional: NIF único (se preenchido)
        if (!string.IsNullOrWhiteSpace(dto.Nif))
        {
            var existeNif = await _db.Fornecedores.AnyAsync(f => f.Nif == dto.Nif);
            if (existeNif)
                return Conflict(new { message = $"Já existe um fornecedor com NIF {dto.Nif}." });
        }

        var f = new Fornecedor
        {
            Nome         = dto.Nome.Trim(),
            Nif          = string.IsNullOrWhiteSpace(dto.Nif) ? null : dto.Nif.Trim(),
            Telefone     = string.IsNullOrWhiteSpace(dto.Telefone) ? null : dto.Telefone.Trim(),
            Email        = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
            Morada       = string.IsNullOrWhiteSpace(dto.Morada) ? null : dto.Morada.Trim(),
            Observacoes  = string.IsNullOrWhiteSpace(dto.Observacoes) ? null : dto.Observacoes.Trim(),
            Ativo        = true,
            CriadoEm     = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        _db.Fornecedores.Add(f);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Obter), new { id = f.Id }, new FornecedorDto
        {
            Id           = f.Id,
            Nome         = f.Nome,
            Nif          = f.Nif,
            Telefone     = f.Telefone,
            Email        = f.Email,
            Morada       = f.Morada,
            Observacoes  = f.Observacoes,
            Ativo        = f.Ativo,
            CriadoEm     = f.CriadoEm,
            AtualizadoEm = f.AtualizadoEm,
            NumRececoes  = 0,
            TotalGasto   = 0
        });
    }

    // ─── PUT /api/fornecedores/{id} ───────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarFornecedorDto dto)
    {
        var f = await _db.Fornecedores.FirstOrDefaultAsync(x => x.Id == id);
        if (f is null)
            return NotFound(new { message = $"Fornecedor {id} não encontrado." });

        // NIF único (se alterado)
        if (!string.IsNullOrWhiteSpace(dto.Nif) && dto.Nif != f.Nif)
        {
            var existeNif = await _db.Fornecedores.AnyAsync(x => x.Nif == dto.Nif && x.Id != id);
            if (existeNif)
                return Conflict(new { message = $"Já existe outro fornecedor com NIF {dto.Nif}." });
        }

        f.Nome         = dto.Nome.Trim();
        f.Nif          = string.IsNullOrWhiteSpace(dto.Nif) ? null : dto.Nif.Trim();
        f.Telefone     = string.IsNullOrWhiteSpace(dto.Telefone) ? null : dto.Telefone.Trim();
        f.Email        = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        f.Morada       = string.IsNullOrWhiteSpace(dto.Morada) ? null : dto.Morada.Trim();
        f.Observacoes  = string.IsNullOrWhiteSpace(dto.Observacoes) ? null : dto.Observacoes.Trim();
        f.Ativo        = dto.Ativo;
        f.AtualizadoEm = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── DELETE /api/fornecedores/{id} ────────────────────────────
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var f = await _db.Fornecedores
            .Include(x => x.Rececoes)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (f is null)
            return NotFound(new { message = $"Fornecedor {id} não encontrado." });

        var temRececoes = f.Rececoes != null && f.Rececoes.Count > 0;
        if (temRececoes)
        {
            return Conflict(new
            {
                message  = $"Fornecedor '{f.Nome}' tem {f.Rececoes!.Count} receção(ões) associadas. Marque como inactivo em vez de eliminar.",
                solucao  = "Use PUT com Ativo=false para desactivar."
            });
        }

        _db.Fornecedores.Remove(f);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
