using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes unitários do UtilizadoresController.
/// Requisitos cobertos: RF01 (criar utilizadores), RF13 (gestão de permissões e acesso).
/// </summary>
public class UtilizadoresControllerTests : BisTestBase
{
    private readonly UtilizadoresController _controller;

    public UtilizadoresControllerTests()
    {
        _controller = new UtilizadoresController(Db, NullLogger<UtilizadoresController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado(PerfilUtilizador.Administrador)
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET — listar utilizadores
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "GetAll devolve utilizadores existentes")]
    public async Task GetAll_ComUtilizadoresNoSeed_DevolveLista()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.GetAll();

        // ── Assert ────────────────────────────────────────────────────────
        var ok    = Assert.IsType<OkObjectResult>(resultado.Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<UtilizadorDto>>(ok.Value);
        Assert.NotEmpty(lista);
        Assert.Contains(lista, u => u.Nome == "João Sousa");
    }

    // ─────────────────────────────────────────────────────────────────────
    // POST — criar utilizador (RF01)
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Criar utilizador válido devolve 201 (RF01)")]
    public async Task Criar_UtilizadorValido_Devolve201()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarUtilizadorDto
        {
            Nome       = "Ana Costa",
            NIF        = "333444555",
            Email      = "ana@bragaconvenience.pt",
            Perfil     = PerfilUtilizador.Funcionario,
            PinPOS     = "1234",
            LojaBaseId = LojaId
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var created     = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        var utilizador  = Assert.IsType<UtilizadorDto>(created.Value);
        Assert.Equal("Ana Costa",    utilizador.Nome);
        Assert.Equal("333444555",    utilizador.NIF);
        Assert.True(utilizador.Ativo);
    }

    [Fact(DisplayName = "Criar utilizador com NIF duplicado devolve 409")]
    public async Task Criar_NIFDuplicado_Devolve409()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarUtilizadorDto
        {
            Nome       = "Outro João",
            NIF        = "223456781", // NIF já existe no seed (João Sousa)
            Perfil     = PerfilUtilizador.Funcionario,
            PinPOS     = "5678",
            LojaBaseId = LojaId
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var conflict = resultado.Result as ObjectResult;
        Assert.NotNull(conflict);
        Assert.Equal(409, conflict!.StatusCode);
    }

    [Fact(DisplayName = "Criar utilizador com loja inexistente devolve 400")]
    public async Task Criar_LojaInexistente_Devolve400()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var dto = new CriarUtilizadorDto
        {
            Nome       = "Pedro Silva",
            NIF        = "777888999",
            Perfil     = PerfilUtilizador.Funcionario,
            PinPOS     = "4321",
            LojaBaseId = 9999 // loja que não existe
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.Criar(dto);

        // ── Assert ────────────────────────────────────────────────────────
        var badRequest = resultado.Result as ObjectResult;
        Assert.NotNull(badRequest);
        Assert.Equal(400, badRequest!.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PUT — toggle status (RF13 — kill switch)
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "ToggleStatus desactiva utilizador activo (RF13)")]
    public async Task ToggleStatus_UtilizadorActivo_Desactiva()
    {
        // ── Arrange: confirmar que está activo ───────────────────────────
        var antes = Db.Utilizadores.Find(OperadorId);
        Assert.Equal(EstadoConta.Ativo, antes!.EstadoConta);

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.ToggleStatus(OperadorId);

        // ── Assert ────────────────────────────────────────────────────────
        var ok          = Assert.IsType<OkObjectResult>(resultado.Result);
        var utilizador  = Assert.IsType<UtilizadorDto>(ok.Value);
        Assert.False(utilizador.Ativo);

        // Verificar na BD
        Db.Entry(antes).Reload();
        Assert.Equal(EstadoConta.Inativo, antes.EstadoConta);
    }

    [Fact(DisplayName = "ToggleStatus reactiva utilizador inactivo (RF13)")]
    public async Task ToggleStatus_UtilizadorInactivo_Reactiva()
    {
        // ── Arrange: desactivar primeiro ─────────────────────────────────
        var utilizador = Db.Utilizadores.Find(OperadorId)!;
        utilizador.EstadoConta = EstadoConta.Inativo;
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.ToggleStatus(OperadorId);

        // ── Assert ────────────────────────────────────────────────────────
        var ok   = Assert.IsType<OkObjectResult>(resultado.Result);
        var dto  = Assert.IsType<UtilizadorDto>(ok.Value);
        Assert.True(dto.Ativo);
    }

    [Fact(DisplayName = "ToggleStatus de utilizador inexistente devolve 404")]
    public async Task ToggleStatus_UtilizadorInexistente_Devolve404()
    {
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.ToggleStatus(9999);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<NotFoundObjectResult>(resultado.Result);
    }
}
