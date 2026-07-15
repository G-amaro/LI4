using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes unitários do FornecedoresController.
/// Requisito coberto: RF07 — gestão da base de dados de fornecedores.
/// </summary>
public class FornecedoresControllerTests : BisTestBase
{
    private readonly FornecedoresController _controller;

    public FornecedoresControllerTests()
    {
        // Adicionar fornecedor ao seed
        Db.Fornecedores.Add(new Fornecedor
        {
            Id    = 1,
            Nome  = "Distribuição Norte Lda",
            Nif   = "500123456",
            Ativo = true
        });
        Db.SaveChanges();

        _controller = new FornecedoresController(Db)
        {
            ControllerContext = CriarContextoAutenticado()
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET — listar
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Listar devolve fornecedor do seed")]
    public async Task Listar_ComFornecedorNoSeed_DevolveLista()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Listar(ativo: null);

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<FornecedorDto>>(ok.Value);
        Assert.Single(lista);
        Assert.Equal("Distribuição Norte Lda", lista.First().Nome);
    }

    [Fact(DisplayName = "Listar com filtro apenasAtivos=true devolve só activos")]
    public async Task Listar_FiltroApenasAtivos_DevolveSoAtivos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        Db.Fornecedores.Add(new Fornecedor { Id = 2, Nome = "Inactivo Lda", Ativo = false });
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Listar(ativo: true);

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<FornecedorDto>>(ok.Value).ToList();
        Assert.Single(lista);
        Assert.True(lista.All(f => f.Ativo));
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET — obter por ID
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Obter por ID existente devolve fornecedor")]
    public async Task Obter_IdExistente_DevolveFornecedor()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Obter(1);

        // ── Assert ────────────────────────────────────────────────────────
        var ok          = Assert.IsType<OkObjectResult>(resultado.Result);
        var fornecedor  = Assert.IsType<FornecedorDto>(ok.Value);
        Assert.Equal("Distribuição Norte Lda", fornecedor.Nome);
    }

    [Fact(DisplayName = "Obter por ID inexistente devolve 404")]
    public async Task Obter_IdInexistente_Devolve404()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Obter(9999);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST — criar
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Criar fornecedor válido devolve 201")]
    public async Task Criar_FornecedorValido_Devolve201()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarFornecedorDto
        {
            Nome     = "Lacticínios do Norte Lda",
            Nif      = "501234567",
            Telefone = "253000000"
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var created     = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var fornecedor  = Assert.IsType<FornecedorDto>(created.Value);
        Assert.Equal("Lacticínios do Norte Lda", fornecedor.Nome);
        Assert.True(fornecedor.Ativo);
        Assert.Equal(2, Db.Fornecedores.Count());
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUT — actualizar
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Actualizar fornecedor existente devolve 204")]
    public async Task Atualizar_FornecedorExistente_Devolve204()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new AtualizarFornecedorDto
        {
            Nome     = "Distribuição Norte ACTUALIZADO",
            Nif      = "500123456",
            Telefone = "253111111",
            Ativo    = true
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Atualizar(1, dto);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NoContentResult>(resultado);
        var fornecedor = Db.Fornecedores.Find(1);
        Assert.Equal("Distribuição Norte ACTUALIZADO", fornecedor!.Nome);
    }

    [Fact(DisplayName = "Actualizar fornecedor inexistente devolve 404")]
    public async Task Atualizar_FornecedorInexistente_Devolve404()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new AtualizarFornecedorDto { Nome = "X", Ativo = true };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Atualizar(9999, dto);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NotFoundObjectResult>(resultado);
    }

    // ─────────────────────────────────────────────────────────────────────
    // DELETE — eliminar
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Eliminar fornecedor sem receções devolve 204")]
    public async Task Eliminar_FornecedorSemRececoes_Devolve204()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Eliminar(1);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NoContentResult>(resultado);
        Assert.Equal(0, Db.Fornecedores.Count());
    }

    [Fact(DisplayName = "Eliminar fornecedor inexistente devolve 404")]
    public async Task Eliminar_FornecedorInexistente_Devolve404()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Eliminar(9999);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NotFoundObjectResult>(resultado);
    }
}
