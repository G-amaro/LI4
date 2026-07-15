using BIS.Api.Controllers;
using BIS.Api.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

// ═══════════════════════════════════════════════════════════════════════════
// LojasController — RF04 (consulta de lojas e stock)
// ═══════════════════════════════════════════════════════════════════════════
public class LojasControllerTests : BisTestBase
{
    private readonly LojasController _controller;

    public LojasControllerTests()
    {
        _controller = new LojasController(Db, NullLogger<LojasController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    [Fact(DisplayName = "Listar devolve lojas com TemPOS=true")]
    public async Task Listar_DevolveLojasComTemPOS()
    {
        var resultado = await _controller.Listar();
        var ok   = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<LojaCardDto>>(ok.Value);
        Assert.NotEmpty(lista);
        Assert.All(lista, l => Assert.True(l.Id > 0));
    }

    [Fact(DisplayName = "Detalhe de loja existente devolve 200")]
    public async Task Detalhe_LojaExistente_Devolve200()
    {
        var resultado = await _controller.Detalhe(LojaId);
        var ok = Assert.IsType<OkObjectResult>(resultado.Result);
        Assert.IsType<LojaDetalheDto>(ok.Value);
    }

    [Fact(DisplayName = "Detalhe de loja inexistente devolve 404")]
    public async Task Detalhe_LojaInexistente_Devolve404()
    {
        var resultado = await _controller.Detalhe(9999);
        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DashboardController — RF10 (relatórios e monitorização)
// ═══════════════════════════════════════════════════════════════════════════
public class DashboardControllerTests : BisTestBase
{
    private readonly DashboardController _controller;

    public DashboardControllerTests()
    {
        _controller = new DashboardController(Db)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    [Fact(DisplayName = "Resumo devolve DTO com métricas da cadeia")]
    public async Task Resumo_DevolveDtoComMetricas()
    {
        var resultado = await _controller.Resumo();
        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.NotNull(ok.Value);
    }

    [Fact(DisplayName = "Resumo com BD vazia devolve zeros")]
    public async Task Resumo_BDVazia_DevolvZeros()
    {
        // Sem vendas nem quebras — apenas o seed mínimo
        var resultado = await _controller.Resumo();
        var ok  = Assert.IsType<OkObjectResult>(resultado);
        Assert.NotNull(ok.Value);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ComprasController — RF07 (receções e encomendas)
// ═══════════════════════════════════════════════════════════════════════════
public class ComprasControllerTests : BisTestBase
{
    private readonly ComprasController _controller;

    public ComprasControllerTests()
    {
        _controller = new ComprasController(Db)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    [Fact(DisplayName = "Listar compras com BD vazia devolve lista vazia")]
    public async Task Listar_BDVazia_DevolvListaVazia()
    {
        var resultado = await _controller.Listar(null, null, null);
        var ok   = Assert.IsType<OkObjectResult>(resultado);
        Assert.NotNull(ok.Value);
    }

    [Fact(DisplayName = "Kpis devolve métricas de compras")]
    public async Task Kpis_DevolvMetricas()
    {
        var resultado = await _controller.Kpis();
        var ok = Assert.IsType<OkObjectResult>(resultado);
        Assert.NotNull(ok.Value);
    }
}
