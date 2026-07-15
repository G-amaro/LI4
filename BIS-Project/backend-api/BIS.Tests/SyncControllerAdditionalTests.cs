using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes adicionais do SyncController para os endpoints de Quebras e Fechos de Caixa.
/// Seguem o mesmo padrão de idempotência por UUID documentado nos SyncControllerTests.
/// Requisitos cobertos: RF06 (sincronização), RF15 (quebras), RF12 (fecho de caixa).
/// </summary>
public class SyncControllerAdditionalTests : BisTestBase
{
    private readonly SyncController _controller;

    public SyncControllerAdditionalTests()
    {
        _controller = new SyncController(Db, NullLogger<SyncController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado(PerfilUtilizador.Funcionario, LojaId)
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // QUEBRAS — RF15
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Quebra nova é inserida com sucesso")]
    public async Task SyncQuebras_QuebrasNova_EInseridaComSucesso()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new SyncQuebrasRequest
        {
            LojaId = LojaId,
            Quebras = new List<SyncQuebraDto>
            {
                new()
                {
                    Id           = Guid.NewGuid(),
                    LojaId       = LojaId,
                    OperadorId   = OperadorId,
                    ProdutoId    = ProdutoId,
                    Quantidade   = 3,
                    ValorPerdido = 0.96m,
                    Motivo       = MotivoQuebra.ValidadeExpirada,
                    DataRegisto  = DateTime.UtcNow
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncQuebras(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncQuebrasResponse>(ok.Value);

        Assert.Equal(1, resposta.TotalInseridas);
        Assert.Equal(0, resposta.TotalDuplicadas);
        Assert.True(resposta.Sucesso);
        Assert.Equal(1, Db.Quebras.Count());
    }

    [Fact(DisplayName = "Reenvio da mesma quebra não cria duplicado")]
    public async Task SyncQuebras_ReenvioBatchIdentico_NaoDuplicaRegistos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var quebraId = Guid.NewGuid();
        var request = new SyncQuebrasRequest
        {
            LojaId = LojaId,
            Quebras = new List<SyncQuebraDto>
            {
                new()
                {
                    Id           = quebraId,
                    LojaId       = LojaId,
                    OperadorId   = OperadorId,
                    ProdutoId    = ProdutoId,
                    Quantidade   = 2,
                    ValorPerdido = 0.64m,
                    Motivo       = MotivoQuebra.DanoQuebraFisica,
                    DataRegisto  = DateTime.UtcNow
                }
            }
        };

        // ── Act — Primeiro envio ──────────────────────────────────────────
        var resultado1 = await _controller.SyncQuebras(request);

        // ── Act — Reenvio ─────────────────────────────────────────────────
        var resultado2 = await _controller.SyncQuebras(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok1       = Assert.IsType<OkObjectResult>(resultado1.Result);
        var resposta1 = Assert.IsType<SyncQuebrasResponse>(ok1.Value);
        Assert.Equal(1, resposta1.TotalInseridas);
        Assert.Equal(0, resposta1.TotalDuplicadas);

        var ok2       = Assert.IsType<OkObjectResult>(resultado2.Result);
        var resposta2 = Assert.IsType<SyncQuebrasResponse>(ok2.Value);
        Assert.Equal(0, resposta2.TotalInseridas);
        Assert.Equal(1, resposta2.TotalDuplicadas);

        // BD deve ter exactamente 1 quebra
        Assert.Equal(1, Db.Quebras.Count());
    }

    [Fact(DisplayName = "Quebra com motivo FurtoDesaparecimento é aceite")]
    public async Task SyncQuebras_TodosOsMotivos_SaoAceites()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new SyncQuebrasRequest
        {
            LojaId = LojaId,
            Quebras = new List<SyncQuebraDto>
            {
                new()
                {
                    Id = Guid.NewGuid(), LojaId = LojaId, OperadorId = OperadorId,
                    ProdutoId = ProdutoId, Quantidade = 1, ValorPerdido = 0.32m,
                    Motivo = MotivoQuebra.FurtoDesaparecimento,
                    DataRegisto = DateTime.UtcNow
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncQuebras(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncQuebrasResponse>(ok.Value);
        Assert.Equal(1, resposta.TotalInseridas);

        var quebraNaBD = Db.Quebras.FirstOrDefault();
        Assert.NotNull(quebraNaBD);
        Assert.Equal(MotivoQuebra.FurtoDesaparecimento, quebraNaBD.Motivo);
    }

    // ─────────────────────────────────────────────────────────────────────
    // FECHOS DE CAIXA — RF12
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Fecho equilibrado é inserido correctamente")]
    public async Task SyncFechos_FechoEquilibrado_EInseridoComSucesso()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new SyncFechosRequest
        {
            LojaId = LojaId,
            Fechos = new List<SyncFechoDto>
            {
                new()
                {
                    Id                  = Guid.NewGuid(),
                    LojaId              = LojaId,
                    OperadorId          = OperadorId,
                    DataFecho           = DateTime.UtcNow,
                    TeoricoNumerario    = 50.00m,
                    TeoricoMultibanco   = 80.00m,
                    TeoricoMbway        = 20.00m,
                    TeoricoTotal        = 150.00m,
                    ContadoNumerario    = 50.00m,
                    ContadoMultibanco   = 80.00m,
                    ContadoMbway        = 20.00m,
                    ContadoTotal        = 150.00m,
                    Discrepancia        = 0.00m,
                    TemDiscrepancia     = false,
                    Justificacao        = null
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncFechos(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncFechosResponse>(ok.Value);

        Assert.Equal(1, resposta.TotalInseridas);
        Assert.True(resposta.Sucesso);
        Assert.Equal(1, Db.FechosCaixa.Count());

        var fecho = Db.FechosCaixa.First();
        Assert.Equal(0.00m, fecho.Discrepancia);
        Assert.False(fecho.TemDiscrepancia);
    }

    [Fact(DisplayName = "Fecho com discrepância regista justificação")]
    public async Task SyncFechos_FechoComDiscrepancia_RegistaJustificacao()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new SyncFechosRequest
        {
            LojaId = LojaId,
            Fechos = new List<SyncFechoDto>
            {
                new()
                {
                    Id                  = Guid.NewGuid(),
                    LojaId              = LojaId,
                    OperadorId          = OperadorId,
                    DataFecho           = DateTime.UtcNow,
                    TeoricoNumerario    = 55.00m,
                    TeoricoMultibanco   = 80.00m,
                    TeoricoMbway        = 15.00m,
                    TeoricoTotal        = 150.00m,
                    ContadoNumerario    = 50.00m,  // -5€ diferença
                    ContadoMultibanco   = 80.00m,
                    ContadoMbway        = 15.00m,
                    ContadoTotal        = 145.00m,
                    Discrepancia        = -5.00m,
                    TemDiscrepancia     = true,
                    Justificacao        = "Possível troco errado no turno da tarde."
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncFechos(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncFechosResponse>(ok.Value);
        Assert.Equal(1, resposta.TotalInseridas);

        var fecho = Db.FechosCaixa.First();
        Assert.Equal(-5.00m,  fecho.Discrepancia);
        Assert.True(fecho.TemDiscrepancia);
        Assert.NotNull(fecho.Justificacao);
    }

    [Fact(DisplayName = "Reenvio do mesmo fecho não cria duplicado")]
    public async Task SyncFechos_ReenvioBatchIdentico_NaoDuplicaRegistos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var fechoId = Guid.NewGuid();
        var request = new SyncFechosRequest
        {
            LojaId = LojaId,
            Fechos = new List<SyncFechoDto>
            {
                new()
                {
                    Id = fechoId, LojaId = LojaId, OperadorId = OperadorId,
                    DataFecho = DateTime.UtcNow,
                    TeoricoNumerario = 100m, TeoricoMultibanco = 0m,
                    TeoricoMbway = 0m, TeoricoTotal = 100m,
                    ContadoNumerario = 100m, ContadoMultibanco = 0m,
                    ContadoMbway = 0m, ContadoTotal = 100m,
                    Discrepancia = 0m, TemDiscrepancia = false
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        await _controller.SyncFechos(request);
        var resultado2 = await _controller.SyncFechos(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok2       = Assert.IsType<OkObjectResult>(resultado2.Result);
        var resposta2 = Assert.IsType<SyncFechosResponse>(ok2.Value);

        Assert.Equal(0, resposta2.TotalInseridas);
        Assert.Equal(1, resposta2.TotalDuplicadas);
        Assert.Equal(1, Db.FechosCaixa.Count());
    }
}
