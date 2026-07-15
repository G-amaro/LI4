using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BIS.Infrastructure.Data; 
namespace BIS.Api.Controllers;

/// <summary>
/// Endpoints de gestão do catálogo de produtos (UC06).
/// Consumido pelo Backoffice Web da Sede.
///
/// Nota: existe também um ProdutosController com GET /api/produtos
/// usado pelo POS para sincronização. Este controlador é separado
/// porque as regras e DTOs são diferentes (CRUD completo vs read-only).
///
/// Nota de segurança:
///   Para o MVP este controlador está aberto para facilitar o
///   desenvolvimento do frontend. Em produção deve ser protegido
///   com [Authorize(Roles = "Administrador,GerenteSede")].
/// </summary>
[ApiController]
[Route("api/catalogo")]
[Authorize(Roles = "Administrador,GerenteSede")]
public class CatalogoController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CatalogoController> _logger;

    public CatalogoController(ApplicationDbContext db, ILogger<CatalogoController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ─── GET /api/catalogo ───────────────────────────────────────

    /// <summary>
    /// Lista todos os produtos do catálogo central, ordenados por categoria e nome.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProdutoDto>>> GetAll()
    {
        var produtos = await _db.Produtos
            .AsNoTracking()
            .OrderBy(p => p.Categoria)
            .ThenBy(p => p.Artigo)
            .Select(p => new ProdutoDto
            {
                Id = p.Id,
                EAN = p.EAN,
                Artigo = p.Artigo,
                Categoria = p.Categoria,
                PrecoCusto = p.PrecoCusto,
                PVP = p.PVP,
                Perecivel  = p.Perecivel,
                TaxaIVA    = p.TaxaIVA,
                ImagemUrl  = p.ImagemUrl
            })
            .ToListAsync();

        return Ok(produtos);
    }

    // ─── POST /api/catalogo ──────────────────────────────────────

    /// <summary>
    /// Cria um novo produto no catálogo central.
    /// Será propagado para os POS na próxima sincronização.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProdutoDto>> Criar([FromBody] CriarProdutoDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Regra de negócio: PVP tem de ser maior ou igual ao preço de custo
        // (não faz sentido vender abaixo do custo na criação — pode ser alterado depois)
        if (dto.PVP < dto.PrecoCusto)
        {
            return BadRequest(new
            {
                message = $"O PVP ({dto.PVP:F2}€) não pode ser inferior ao preço de custo ({dto.PrecoCusto:F2}€)."
            });
        }

        // Regra de negócio: EAN tem de ser único
        var eanExiste = await _db.Produtos
            .AsNoTracking()
            .AnyAsync(p => p.EAN == dto.EAN);

        if (eanExiste)
        {
            return Conflict(new
            {
                message = $"Já existe um produto com o código EAN {dto.EAN}."
            });
        }

        var produto = new Produto
        {
            EAN = dto.EAN,
            Artigo = dto.Artigo.Trim(),
            Categoria = dto.Categoria.Trim(),
            PrecoCusto = dto.PrecoCusto,
            PVP = dto.PVP,
            Perecivel  = dto.Perecivel,
            TaxaIVA    = dto.TaxaIVA,
            ImagemUrl  = dto.ImagemUrl
        };

        try
        {
            _db.Produtos.Add(produto);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Erro ao criar produto {EAN}", dto.EAN);
            return StatusCode(500, new { message = "Erro interno ao gravar o produto." });
        }

        _logger.LogInformation("Produto criado: {Id} — {Artigo} (EAN {EAN})",
            produto.Id, produto.Artigo, produto.EAN);

        var resultado = new ProdutoDto
        {
            Id = produto.Id,
            EAN = produto.EAN,
            Artigo = produto.Artigo,
            Categoria = produto.Categoria,
            PrecoCusto = produto.PrecoCusto,
            PVP = produto.PVP,
            Perecivel = produto.Perecivel
        };

        return CreatedAtAction(nameof(GetAll), new { id = produto.Id }, resultado);
    }
    
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ProdutoDto>> Update(int id, [FromBody] CriarProdutoDto dto)
    {
    var produto = await _db.Produtos.FindAsync(id);
    if (produto is null)
        return NotFound(new { message = $"Produto {id} não encontrado." });
 
    // EAN não é editável — ignorar qualquer alteração ao EAN
    produto.Artigo     = dto.Artigo.Trim();
    produto.Categoria  = dto.Categoria.Trim();
    produto.PrecoCusto = dto.PrecoCusto;
    produto.PVP        = dto.PVP;
    produto.Perecivel  = dto.Perecivel;
    produto.TaxaIVA    = dto.TaxaIVA;
    produto.ImagemUrl  = dto.ImagemUrl;
 
    try
    {
        await _db.SaveChangesAsync();
        _logger.LogInformation("Produto {Id} ({Artigo}) actualizado", produto.Id, produto.Artigo);
 
        return Ok(new ProdutoDto
        {
            Id         = produto.Id,
            EAN        = produto.EAN,
            Artigo     = produto.Artigo,
            Categoria  = produto.Categoria,
            PrecoCusto = produto.PrecoCusto,
            PVP        = produto.PVP,
            Perecivel  = produto.Perecivel,
            TaxaIVA    = produto.TaxaIVA,
            ImagemUrl  = produto.ImagemUrl
        });
    }
    catch (DbUpdateException ex)
    {
        _logger.LogError(ex, "Erro ao actualizar produto {Id}", id);
        return StatusCode(500, new { message = "Erro ao actualizar o produto." });
    }
}

}
