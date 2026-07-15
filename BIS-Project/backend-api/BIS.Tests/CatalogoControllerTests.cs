using BIS.Api.Controllers;
using BIS.Api.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes unitários do CatalogoController.
/// Requisito coberto: RF03 — gestão do catálogo de produtos.
/// </summary>
public class CatalogoControllerTests : BisTestBase
{
    private readonly CatalogoController _controller;

    public CatalogoControllerTests()
    {
        _controller = new CatalogoController(Db, NullLogger<CatalogoController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET — listar produtos
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "GetAll devolve lista com produto do seed")]
    public async Task GetAll_ComProdutoNoSeed_DevolveLista()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.GetAll();

        // ── Assert ────────────────────────────────────────────────────────
        var ok      = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista   = Assert.IsAssignableFrom<IEnumerable<ProdutoDto>>(ok.Value);
        Assert.Single(lista);
        Assert.Equal("Água Luso 1,5L", lista.First().Artigo);
    }

    [Fact(DisplayName = "GetAll com BD vazia devolve lista vazia")]
    public async Task GetAll_BDVazia_DevolvListaVazia()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        Db.Produtos.RemoveRange(Db.Produtos);
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.GetAll();

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<ProdutoDto>>(ok.Value);
        Assert.Empty(lista);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST — criar produto
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Criar produto válido devolve 201 Created")]
    public async Task Criar_ProdutoValido_Devolve201()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarProdutoDto
        {
            EAN        = "5601111222334",
            Artigo     = "Coca-Cola Zero 33cl",
            Categoria  = "Bebidas",
            PrecoCusto = 0.45m,
            PVP        = 0.89m,
            Perecivel  = false
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var created  = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var produto  = Assert.IsType<ProdutoDto>(created.Value);
        Assert.Equal("Coca-Cola Zero 33cl", produto.Artigo);
        Assert.Equal("5601111222334",       produto.EAN);
        Assert.Equal(2, Db.Produtos.Count()); // seed + novo
    }

    [Fact(DisplayName = "Criar produto com EAN duplicado devolve 409 Conflict")]
    public async Task Criar_EANDuplicado_Devolve409()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarProdutoDto
        {
            EAN        = "5601234567890", // EAN já existe no seed
            Artigo     = "Produto Duplicado",
            Categoria  = "Bebidas",
            PrecoCusto = 0.50m,
            PVP        = 1.00m,
            Perecivel  = false
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var conflict = resultado.Result as ObjectResult;
        Assert.NotNull(conflict);
        Assert.Equal(409, conflict!.StatusCode);
        Assert.Equal(1, Db.Produtos.Count()); // não duplicou
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUT — editar produto
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Update produto existente actualiza os campos")]
    public async Task Update_ProdutoExistente_ActualizaCampos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarProdutoDto
        {
            EAN        = "5601234567890",
            Artigo     = "Água Luso 1,5L — ACTUALIZADO",
            Categoria  = "Bebidas",
            PrecoCusto = 0.35m,
            PVP        = 0.75m,
            Perecivel  = false
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Update(ProdutoId, dto);

        // ── Assert ────────────────────────────────────────────────────────
        var ok      = Assert.IsType<OkObjectResult>(resultado.Result);
        var produto = Assert.IsType<ProdutoDto>(ok.Value);
        Assert.Equal("Água Luso 1,5L — ACTUALIZADO", produto.Artigo);
        Assert.Equal(0.75m, produto.PVP);
    }

    [Fact(DisplayName = "Update produto inexistente devolve 404")]
    public async Task Update_ProdutoInexistente_Devolve404()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarProdutoDto
        {
            EAN = "5601234567890", Artigo = "X", Categoria = "X",
            PrecoCusto = 1m, PVP = 2m, Perecivel = false
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Update(9999, dto);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }
}
