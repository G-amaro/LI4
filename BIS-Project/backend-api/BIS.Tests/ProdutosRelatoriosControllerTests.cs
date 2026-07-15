using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

// ═══════════════════════════════════════════════════════════════════════════
// ProdutosController — catálogo para POS (sync)
// ═══════════════════════════════════════════════════════════════════════════
public class ProdutosControllerTests : BisTestBase
{
    private readonly ProdutosController _controller;

    public ProdutosControllerTests()
    {
        _controller = new ProdutosController(Db, NullLogger<ProdutosController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    [Fact(DisplayName = "GetAll devolve lista de produtos")]
    public async Task GetAll_DevolveLista()
    {
        var resultado = await _controller.GetAll();
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<ProdutoDto>>(ok.Value);
        Assert.Single(lista);
    }

    [Fact(DisplayName = "GetById com ID existente devolve produto")]
    public async Task GetById_IdExistente_DevolveProduto()
    {
        var resultado = await _controller.GetById(ProdutoId);
        var ok      = Assert.IsType<OkObjectResult>(resultado.Result);
        var produto = Assert.IsType<ProdutoDto>(ok.Value);
        Assert.Equal("Água Luso 1,5L", produto.Artigo);
    }

    [Fact(DisplayName = "GetById com ID inexistente devolve 404")]
    public async Task GetById_IdInexistente_Devolve404()
    {
        var resultado = await _controller.GetById(9999);
        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    [Fact(DisplayName = "Create produto válido devolve 201")]
    public async Task Create_ProdutoValido_Devolve201()
    {
        var request = new CreateProdutoRequest
        {
            EAN        = "5601999888777",
            Artigo     = "Sumol Laranja 33cl",
            Categoria  = "Bebidas",
            PrecoCusto = 0.50m,
            PVP        = 0.99m,
            Perecivel  = false
        };

        var resultado = await _controller.Create(request);
        var created  = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var produto  = Assert.IsType<ProdutoDto>(created.Value);
        Assert.Equal("Sumol Laranja 33cl", produto.Artigo);
        Assert.Equal(2, Db.Produtos.Count());
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// RelatoriosController — RF10 (relatórios financeiros e operacionais)
// ═══════════════════════════════════════════════════════════════════════════
public class RelatoriosControllerTests : BisTestBase
{
    private readonly RelatoriosController _controller;

    public RelatoriosControllerTests()
    {
        _controller = new RelatoriosController(Db, NullLogger<RelatoriosController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    [Fact(DisplayName = "GetResumo com BD vazia devolve zeros")]
    public async Task GetResumo_BDVazia_DevolvZeros()
    {
        var resultado = await _controller.GetResumo();
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        Assert.NotNull(ok.Value);
    }

    [Fact(DisplayName = "GetFechos com BD vazia devolve lista vazia")]
    public async Task GetFechos_BDVazia_DevolvListaVazia()
    {
        var resultado = await _controller.GetFechos();
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<FechoCaixaDto>>(ok.Value);
        Assert.Empty(lista);
    }

    [Fact(DisplayName = "GetFechos com dados devolve fechos sincronizados")]
    public async Task GetFechos_ComDados_DevolveFechos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        Db.FechosCaixa.Add(new FechoCaixa
        {
            Id                  = Guid.NewGuid(),
            LojaId              = LojaId,
            OperadorId          = OperadorId,
            DataFecho           = DateTime.UtcNow,
            TeoricoNumerario    = 100m,
            TeoricoMultibanco   = 0m,
            TeoricoMbway        = 0m,
            TeoricoTotal        = 100m,
            ContadoNumerario    = 100m,
            ContadoMultibanco   = 0m,
            ContadoMbway        = 0m,
            ContadoTotal        = 100m,
            Discrepancia        = 0m,
            TemDiscrepancia     = false,
            DataSincronizacao   = DateTime.UtcNow
        });
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.GetFechos();

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<FechoCaixaDto>>(ok.Value);
        Assert.Single(lista);
    }

    [Fact(DisplayName = "GetQuebras com BD vazia devolve lista vazia")]
    public async Task GetQuebras_BDVazia_DevolvListaVazia()
    {
        var resultado = await _controller.GetQuebras();
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<QuebraRelatorioDto>>(ok.Value);
        Assert.Empty(lista);
    }

    [Fact(DisplayName = "GetQuebras com dados devolve quebras sincronizadas")]
    public async Task GetQuebras_ComDados_DevolveQuebras()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        Db.Quebras.Add(new Quebra
        {
            Id                = Guid.NewGuid(),
            LojaId            = LojaId,
            OperadorId        = OperadorId,
            ProdutoId         = ProdutoId,
            Quantidade        = 2,
            ValorPerdido      = 0.64m,
            Motivo            = MotivoQuebra.ValidadeExpirada,
            DataRegisto       = DateTime.UtcNow,
            DataSincronizacao = DateTime.UtcNow
        });
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.GetQuebras();

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<QuebraRelatorioDto>>(ok.Value);
        Assert.Single(lista);
    }
}
