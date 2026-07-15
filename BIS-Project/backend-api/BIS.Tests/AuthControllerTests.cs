using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes unitários do AuthController.
///
/// Cobrem os dois fluxos de autenticação do sistema BIS:
///   - Login backoffice (email + password) — RF01, RF13
///   - Login POS (NIF + PIN + LojaId) — RF02, RF13
///
/// O teste de restrição de terminal (RF13) é particularmente importante:
/// prova que um operador não consegue autenticar-se numa loja diferente
/// da sua loja base, garantindo a integridade das operações por loja.
/// </summary>
public class AuthControllerTests : BisTestBase
{
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        // AuthController não precisa de [Authorize] para ser instanciado
        _controller = new AuthController(
            Db,
            new FakeJwtService(),
            NullLogger<AuthController>.Instance
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // LOGIN POS — RF02
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Login POS com credenciais válidas devolve token")]
    public async Task LoginPos_CredenciaisValidas_DevolvToken()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // O utilizador do seed tem PinPOS = "hash" — precisamos de um
        // utilizador com PIN real hasheado para testar o login
        var pin = "1234";
        var pinHash = BCrypt.Net.BCrypt.HashPassword(pin);

        var utilizador = new Utilizador
        {
            Id          = 99,
            Nome        = "Teste Operador",
            NIF         = "987654321",
            PinPOS      = pinHash,
            Perfil      = PerfilUtilizador.Funcionario,
            LojaBaseId  = LojaId,
            EstadoConta = EstadoConta.Ativo
        };
        Db.Utilizadores.Add(utilizador);
        await Db.SaveChangesAsync();

        var request = new LoginPosRequest
        {
            NIF    = "987654321",
            Pin    = pin,
            LojaId = LojaId
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.LoginPos(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<LoginResponse>(ok.Value);
        Assert.NotNull(resposta.Token);
        Assert.Equal("Teste Operador", resposta.Utilizador.Nome);
    }

    [Fact(DisplayName = "Login POS com PIN errado devolve 401")]
    public async Task LoginPos_PinErrado_Devolve401()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var utilizador = new Utilizador
        {
            Id = 98, Nome = "Operador Pin", NIF = "111222333",
            PinPOS = BCrypt.Net.BCrypt.HashPassword("9999"),
            Perfil = PerfilUtilizador.Funcionario,
            LojaBaseId = LojaId, EstadoConta = EstadoConta.Ativo
        };
        Db.Utilizadores.Add(utilizador);
        await Db.SaveChangesAsync();

        var request = new LoginPosRequest
        {
            NIF = "111222333", Pin = "0000", LojaId = LojaId  // PIN errado
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.LoginPos(request);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }

    [Fact(DisplayName = "Restrição de terminal: operador bloqueado na loja errada (RF13)")]
    public async Task LoginPos_LojaErrada_Devolve403()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // Criar uma segunda loja
        Db.Lojas.Add(new Loja { Id = 5, Nome = "Centro", Localidade = "Braga", TemPOS = true });

        var pin = "5678";
        var utilizador = new Utilizador
        {
            Id = 97, Nome = "Operador Fraiao", NIF = "555666777",
            PinPOS = BCrypt.Net.BCrypt.HashPassword(pin),
            Perfil = PerfilUtilizador.Funcionario,
            LojaBaseId = LojaId,  // pertence à Fraião (LojaId = 1)
            EstadoConta = EstadoConta.Ativo
        };
        Db.Utilizadores.Add(utilizador);
        await Db.SaveChangesAsync();

        // Tentar login no Centro (lojaId = 5) com operador da Fraião
        var request = new LoginPosRequest
        {
            NIF = "555666777", Pin = pin, LojaId = 5
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.LoginPos(request);

        // ── Assert ────────────────────────────────────────────────────────
        // Deve retornar 403 — restrição de terminal (RF13)
        var objectResult = Assert.IsType<ObjectResult>(resultado.Result);
        Assert.Equal(403, objectResult.StatusCode);
    }

    [Fact(DisplayName = "Conta inactiva bloqueia login POS (RF13)")]
    public async Task LoginPos_ContaInactiva_Devolve401()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var pin = "1111";
        var utilizador = new Utilizador
        {
            Id = 96, Nome = "Operador Inactivo", NIF = "444555666",
            PinPOS = BCrypt.Net.BCrypt.HashPassword(pin),
            Perfil = PerfilUtilizador.Funcionario,
            LojaBaseId = LojaId,
            EstadoConta = EstadoConta.Inativo  // conta inactiva
        };
        Db.Utilizadores.Add(utilizador);
        await Db.SaveChangesAsync();

        var request = new LoginPosRequest
        {
            NIF = "444555666", Pin = pin, LojaId = LojaId
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.LoginPos(request);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }

    [Fact(DisplayName = "NIF inexistente devolve 401")]
    public async Task LoginPos_NifInexistente_Devolve401()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new LoginPosRequest
        {
            NIF = "000000000", Pin = "1234", LojaId = LojaId
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.LoginPos(request);

        // ── Assert ────────────────────────────────────────────────────────
        Assert.IsType<UnauthorizedObjectResult>(resultado.Result);
    }
}

// ─── Fake JWT Service para testes ────────────────────────────────────────────
/// <summary>
/// Substituto simples do IJwtService para testes unitários.
/// Devolve um token fictício sem dependência de configuração.
/// </summary>
public class FakeJwtService : BIS.Api.Services.IJwtService
{
    public (string Token, DateTime ExpiresAt) GenerateToken(BIS.Domain.Entities.Utilizador utilizador)
        => ($"fake-token-{utilizador.Id}", DateTime.UtcNow.AddHours(8));
}
