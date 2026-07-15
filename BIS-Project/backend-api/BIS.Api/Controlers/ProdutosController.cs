using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BIS.Api.Controllers;

/// <summary>
/// Gestão do catálogo de produtos (UC06).
///
/// GET  /api/produtos       — todos os produtos (POS usa para sync do catálogo)
/// GET  /api/produtos/{id}  — produto por ID
/// POST /api/produtos       — criar produto (Administrador/GerenteSede)
/// </summary>
[ApiController]
[Route("api/produtos")]
[Authorize]
public class ProdutosController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ProdutosController> _logger;

    public ProdutosController(ApplicationDbContext db, ILogger<ProdutosController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────
    /// <summary>
    /// Lista todos os produtos do catálogo.
    /// Acessível a qualquer perfil autenticado.
    ///
    /// Os Terminais POS chamam este endpoint no arranque ou após sincronização
    /// para actualizar o catálogo local SQLite.
    ///
    /// PrecoCusto só é retornado a perfis de gestão (Administrador / GerenteSede).
    /// Operadores recebem 0.00 nesse campo para não expor margens.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProdutoDto>>> GetAll()
    {
        var perfil   = GetPerfil();
        var podVerCusto = perfil is PerfilUtilizador.Administrador
                                  or PerfilUtilizador.GerenteSede
                                  or PerfilUtilizador.GerenteLoja;

        var produtos = await _db.Produtos
            .AsNoTracking()
            .OrderBy(p => p.Categoria)
            .ThenBy(p => p.Artigo)
            .Select(p => new ProdutoDto
            {
                Id         = p.Id,
                EAN        = p.EAN,
                Artigo     = p.Artigo,
                Categoria  = p.Categoria,
                PrecoCusto = p.PrecoCusto,
                PVP        = p.PVP,
                Perecivel  = p.Perecivel,
                TaxaIVA    = p.TaxaIVA,
                ImagemUrl  = p.ImagemUrl
            })
            .ToListAsync();

        return Ok(produtos);
    }

    // ─────────────────────────────────────────────────────────
    /// <summary>Retorna um produto por ID.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProdutoDto>> GetById(int id)
    {
        var perfil      = GetPerfil();
        var podVerCusto = perfil is PerfilUtilizador.Administrador
                                  or PerfilUtilizador.GerenteSede
                                  or PerfilUtilizador.GerenteLoja;

        var p = await _db.Produtos
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (p is null)
            return NotFound(new { message = $"Produto {id} não encontrado." });

        return Ok(new ProdutoDto
        {
            Id         = p.Id,
            EAN        = p.EAN,
            Artigo     = p.Artigo,
            Categoria  = p.Categoria,
            PrecoCusto = p.PrecoCusto,
            PVP        = p.PVP,
            Perecivel  = p.Perecivel,
            TaxaIVA    = p.TaxaIVA,
            ImagemUrl  = p.ImagemUrl
        });
    }

    // ─────────────────────────────────────────────────────────
    /// <summary>
    /// Cria um novo produto no catálogo central.
    /// Restrito a Administrador e GerenteSede.
    /// Após criação, o produto será propagado aos POS no próximo ciclo de sync.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Administrador,GerenteSede")]
    public async Task<ActionResult<ProdutoDto>> Create([FromBody] CreateProdutoRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // EAN duplicado?
        var existe = await _db.Produtos
            .AsNoTracking()
            .AnyAsync(p => p.EAN == request.EAN);

        if (existe)
            return Conflict(new { message = $"Já existe um produto com o EAN {request.EAN}." });

        // PVP >= PrecoCusto (regra de negócio básica)
        if (request.PVP < request.PrecoCusto)
            return BadRequest(new { message = "O PVP não pode ser inferior ao preço de custo." });

        var produto = new Produto
        {
            EAN        = request.EAN,
            Artigo     = request.Artigo,
            Categoria  = request.Categoria,
            PrecoCusto = request.PrecoCusto,
            PVP        = request.PVP,
            Perecivel  = request.Perecivel,
            TaxaIVA    = request.TaxaIVA,
            ImagemUrl  = request.ImagemUrl
        };

        _db.Produtos.Add(produto);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Produto {Id} ({EAN}) criado por {User}",
            produto.Id, produto.EAN, User.FindFirstValue(ClaimTypes.Name));

        return CreatedAtAction(nameof(GetById), new { id = produto.Id }, new ProdutoDto
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

    // ─────────────────────────────────────────────────────────
    private PerfilUtilizador? GetPerfil()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        return Enum.TryParse<PerfilUtilizador>(role, out var p) ? p : null;
    }
}
