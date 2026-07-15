using BIS.Api.Controllers;
using BIS.Api.DTOs;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BIS.Tests;

/// <summary>
/// Testes de regressão para o SyncController.
///
/// Contexto: O mecanismo de idempotência por UUID é o coração da arquitectura
/// offline-first do sistema BIS. Um terminal POS pode enviar o mesmo batch
/// múltiplas vezes (falha de rede, crash, retry). O SyncController deve
/// aceitar duplicados silenciosamente sem criar registos duplos na BD.
///
/// Estes testes provam que a implementação é robusta a re-envios, garantindo
/// a integridade dos dados mesmo em condições de rede instável.
///
/// Requisito coberto: RF06 — sincronização e consolidação de dados.
/// </summary>
public class SyncControllerTests : BisTestBase
{
    private readonly SyncController _controller;

    public SyncControllerTests()
    {
        _controller = new SyncController(Db, NullLogger<SyncController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado(
                PerfilUtilizador.Funcionario, LojaId)
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 1 — Idempotência: reenvio do mesmo batch não cria duplicados
    // Prova central do RF06 e da robustez offline-first.
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Reenvio do mesmo batch não duplica vendas na BD")]
    public async Task SyncVendas_ReenvioBatchIdentico_NaoDuplicaRegistos()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // Batch com 2 vendas — UUIDs gerados pelo POS e fixos para o teste
        var vendaId1 = Guid.NewGuid();
        var vendaId2 = Guid.NewGuid();

        var batch = new SyncVendasRequest
        {
            LojaId = LojaId,
            Vendas = new List<SyncVendaDto>
            {
                new()
                {
                    Id              = vendaId1,
                    LojaId          = LojaId,
                    OperadorId      = OperadorId,
                    DataTransacao   = DateTime.UtcNow.AddHours(-2),
                    ValorTotal      = 1.38m,
                    MetodoPagamento = MetodoPagamento.Numerario,
                    Linhas          = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 2,
                                PrecoUnitario = 0.69m, Subtotal = 1.38m }
                    }
                },
                new()
                {
                    Id              = vendaId2,
                    LojaId          = LojaId,
                    OperadorId      = OperadorId,
                    DataTransacao   = DateTime.UtcNow.AddHours(-1),
                    ValorTotal      = 0.69m,
                    MetodoPagamento = MetodoPagamento.MBWay,
                    Linhas          = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 1,
                                PrecoUnitario = 0.69m, Subtotal = 0.69m }
                    }
                }
            }
        };

        // ── Act — Primeiro envio ──────────────────────────────────────────
        var resultado1 = await _controller.SyncVendas(batch);

        // ── Act — Reenvio exactamente igual (simula retry por falha de rede)
        var resultado2 = await _controller.SyncVendas(batch);

        // ── Assert ────────────────────────────────────────────────────────
        // Primeiro envio: 2 inseridas, 0 duplicadas
        var ok1       = Assert.IsType<OkObjectResult>(resultado1.Result);
        var resposta1 = Assert.IsType<SyncVendasResponse>(ok1.Value);
        Assert.Equal(2, resposta1.TotalInseridas);
        Assert.Equal(0, resposta1.TotalDuplicadas);
        Assert.True(resposta1.Sucesso);

        // Segundo envio: 0 inseridas, 2 duplicadas
        var ok2       = Assert.IsType<OkObjectResult>(resultado2.Result);
        var resposta2 = Assert.IsType<SyncVendasResponse>(ok2.Value);
        Assert.Equal(0, resposta2.TotalInseridas);
        Assert.Equal(2, resposta2.TotalDuplicadas);
        Assert.True(resposta2.Sucesso); // duplicados não são erro

        // BD deve ter exactamente 2 vendas — não 4
        Assert.Equal(2, Db.Vendas.Count());
        Assert.Equal(2, Db.LinhasVenda.Count()); // 1 linha por venda
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 2 — Batch misto: vendas novas + duplicadas no mesmo envio
    // Simula o caso real onde o POS reenvia vendas antigas com novas
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Batch misto: novas inseridas e duplicadas ignoradas")]
    public async Task SyncVendas_BatchMisto_InsereNovasEIgnoraDuplicadas()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var vendaExistenteId = Guid.NewGuid();
        var vendaNovaId      = Guid.NewGuid();

        // Primeiro batch — só a venda existente
        var primeiroBatch = new SyncVendasRequest
        {
            LojaId = LojaId,
            Vendas = new List<SyncVendaDto>
            {
                new()
                {
                    Id = vendaExistenteId, LojaId = LojaId, OperadorId = OperadorId,
                    DataTransacao = DateTime.UtcNow.AddHours(-3),
                    ValorTotal = 0.69m, MetodoPagamento = MetodoPagamento.Numerario,
                    Linhas = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 1,
                                PrecoUnitario = 0.69m, Subtotal = 0.69m }
                    }
                }
            }
        };
        await _controller.SyncVendas(primeiroBatch);

        // Segundo batch — venda existente + venda nova
        var segundoBatch = new SyncVendasRequest
        {
            LojaId = LojaId,
            Vendas = new List<SyncVendaDto>
            {
                new()
                {
                    Id = vendaExistenteId, LojaId = LojaId, OperadorId = OperadorId,
                    DataTransacao = DateTime.UtcNow.AddHours(-3),
                    ValorTotal = 0.69m, MetodoPagamento = MetodoPagamento.Numerario,
                    Linhas = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 1,
                                PrecoUnitario = 0.69m, Subtotal = 0.69m }
                    }
                },
                new()
                {
                    Id = vendaNovaId, LojaId = LojaId, OperadorId = OperadorId,
                    DataTransacao = DateTime.UtcNow.AddHours(-1),
                    ValorTotal = 1.38m, MetodoPagamento = MetodoPagamento.Multibanco,
                    Linhas = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 2,
                                PrecoUnitario = 0.69m, Subtotal = 1.38m }
                    }
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncVendas(segundoBatch);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncVendasResponse>(ok.Value);

        Assert.Equal(1, resposta.TotalInseridas);   // só a nova foi inserida
        Assert.Equal(1, resposta.TotalDuplicadas);  // a existente foi ignorada
        Assert.Empty(resposta.Erros);

        // BD deve ter exactamente 2 vendas
        Assert.Equal(2, Db.Vendas.Count());
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 3 — Loja inválida deve retornar 400
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Loja inexistente devolve BadRequest 400")]
    public async Task SyncVendas_LojaInexistente_DevolveBadRequest()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var request = new SyncVendasRequest
        {
            LojaId = 9999, // loja que não existe
            Vendas = new List<SyncVendaDto>
            {
                new()
                {
                    Id = Guid.NewGuid(), LojaId = 9999, OperadorId = OperadorId,
                    DataTransacao = DateTime.UtcNow, ValorTotal = 0.69m,
                    MetodoPagamento = MetodoPagamento.Numerario,
                    Linhas = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 1,
                                PrecoUnitario = 0.69m, Subtotal = 0.69m }
                    }
                }
            }
        };

        _controller.ControllerContext = CriarContextoAutenticado(PerfilUtilizador.Funcionario, 9999);
        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncVendas(request);

        // ── Assert ────────────────────────────────────────────────────────
        var badResult = resultado.Result as ObjectResult; Assert.NotNull(badResult); Assert.Equal(400, badResult.StatusCode);

        // Nenhuma venda deve ter sido inserida
        Assert.Equal(0, Db.Vendas.Count());
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 4 — Venda com UUID único é correctamente inserida
    // Teste base que valida o fluxo happy path
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Venda nova com UUID único é inserida correctamente")]
    public async Task SyncVendas_VendaNova_EInseridaComSucesso()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var novoId = Guid.NewGuid();
        var request = new SyncVendasRequest
        {
            LojaId = LojaId,
            Vendas = new List<SyncVendaDto>
            {
                new()
                {
                    Id              = novoId,
                    LojaId          = LojaId,
                    OperadorId      = OperadorId,
                    DataTransacao   = DateTime.UtcNow,
                    ValorTotal      = 2.07m,
                    MetodoPagamento = MetodoPagamento.MBWay,
                    NifCliente      = "123456789",
                    Linhas          = new List<SyncLinhaVendaDto>
                    {
                        new() { ProdutoId = ProdutoId, Quantidade = 3,
                                PrecoUnitario = 0.69m, Subtotal = 2.07m }
                    }
                }
            }
        };

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.SyncVendas(request);

        // ── Assert ────────────────────────────────────────────────────────
        var ok       = Assert.IsType<OkObjectResult>(resultado.Result);
        var resposta = Assert.IsType<SyncVendasResponse>(ok.Value);

        Assert.Equal(1, resposta.TotalInseridas);
        Assert.Equal(0, resposta.TotalDuplicadas);
        Assert.True(resposta.Sucesso);
        Assert.Empty(resposta.Erros);

        // Verificar que a venda foi persistida na BD com os dados correctos
        var vendaNaBD = Db.Vendas.FirstOrDefault(v => v.Id == novoId);
        Assert.NotNull(vendaNaBD);
        Assert.Equal(LojaId,              vendaNaBD.LojaId);
        Assert.Equal(2.07m,               vendaNaBD.ValorTotal);
        Assert.Equal(MetodoPagamento.MBWay, vendaNaBD.MetodoPagamento);
        Assert.Equal("123456789",         vendaNaBD.NifCliente);

        // Verificar que as linhas foram persistidas
        var linhas = Db.LinhasVenda.Where(l => l.VendaId == novoId).ToList();
        Assert.Single(linhas);
        Assert.Equal(3, linhas[0].Quantidade);
    }
}
