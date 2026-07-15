using BIS.Api.Controllers;
using BIS.Domain.Entities;
using BIS.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using BIS.Api.DTOs;

namespace BIS.Tests;

/// <summary>
/// Testes de regressão para o InventarioController.
///
/// Contexto: O Bug #1 documentado no relatório identificou que o LLM gerou
/// uma query LINQ onde as vendas eram SOMADAS ao stock em vez de SUBTRAÍDAS,
/// inflacionando os valores no backoffice. Estes testes garantem que
/// a correcção permanece válida em futuras alterações ao código.
///
/// Requisito coberto: RF04 — consulta de stock em todas as lojas.
/// </summary>
public class InventarioControllerTests : BisTestBase
{
    private readonly InventarioController _controller;

    public InventarioControllerTests()
    {
        _controller = new InventarioController(Db, NullLogger<InventarioController>.Instance)
        {
            ControllerContext = CriarContextoAutenticado(PerfilUtilizador.Administrador)
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 1 — Cálculo de stock com receção, venda e quebra
    // Prova a correcção do Bug #1: vendas devem SUBTRAIR, não somar.
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Stock = Receção(10) - Venda(3) - Quebra(2) = 5")]
    public async Task ObterInventario_ComRececaoVendaEQuebra_DevolveCincoUnidades()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // Receção: +10 unidades entram em stock
        var recId = Guid.NewGuid();
        Db.Rececoes.Add(new Rececao
        {
            Id        = recId,
            LojaId    = LojaId,
            OperadorId = OperadorId,
            DataRececao = DateTime.UtcNow.AddDays(-3),
        });
        Db.LinhasRececao.Add(new LinhaRececao
        {
            RececaoId  = recId,
            ProdutoId  = ProdutoId,
            Quantidade = 10,
            PrecoCusto = 0.32m
        });

        // Venda: -3 unidades saem de stock
        var vendaId = Guid.NewGuid();
        Db.Vendas.Add(new Venda
        {
            Id              = vendaId,
            LojaId          = LojaId,
            OperadorId      = OperadorId,
            DataTransacao   = DateTime.UtcNow.AddDays(-2),
            ValorTotal      = 2.07m,
            MetodoPagamento = MetodoPagamento.Numerario
        });
        Db.LinhasVenda.Add(new LinhaVenda
        {
            VendaId        = vendaId,
            ProdutoId      = ProdutoId,
            Quantidade     = 3,
            PrecoUnitario  = 0.69m,
            Subtotal       = 2.07m
        });

        // Quebra: -2 unidades saem de stock
        Db.Quebras.Add(new Quebra
        {
            Id           = Guid.NewGuid(),
            LojaId       = LojaId,
            OperadorId   = OperadorId,
            ProdutoId    = ProdutoId,
            Quantidade   = 2,
            ValorPerdido = 0.64m,
            Motivo       = MotivoQuebra.DanoQuebraFisica,
            DataRegisto  = DateTime.UtcNow.AddDays(-1)
        });

        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado = await _controller.ObterInventario();

        // ── Assert ────────────────────────────────────────────────────────
        var okResult   = Assert.IsType<OkObjectResult>(resultado.Result);
        var inventario = Assert.IsType<InventarioConsolidadoDto>(okResult.Value);

        var artigo = inventario.Artigos.FirstOrDefault(a => a.Id == ProdutoId);
        Assert.NotNull(artigo);

        // Stock esperado: 10 (receção) - 3 (venda) - 2 (quebra) = 5
        Assert.Equal(5, artigo.StockPorLoja[LojaId]);
        Assert.Equal(5, artigo.Total);
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 2 — Stock zero quando vendas igualam receção
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Stock = 0 quando Vendas == Receção")]
    public async Task ObterInventario_VendasIguaiRecepcao_DevolvZero()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        var recId = Guid.NewGuid();
        Db.Rececoes.Add(new Rececao
        {
            Id = recId, LojaId = LojaId, OperadorId = OperadorId,
            DataRececao = DateTime.UtcNow.AddDays(-5)
        });
        Db.LinhasRececao.Add(new LinhaRececao
        {
            RececaoId = recId, ProdutoId = ProdutoId,
            Quantidade = 5, PrecoCusto = 0.32m
        });

        var vendaId = Guid.NewGuid();
        Db.Vendas.Add(new Venda
        {
            Id = vendaId, LojaId = LojaId, OperadorId = OperadorId,
            DataTransacao = DateTime.UtcNow.AddDays(-1),
            ValorTotal = 3.45m, MetodoPagamento = MetodoPagamento.Multibanco
        });
        Db.LinhasVenda.Add(new LinhaVenda
        {
            VendaId = vendaId, ProdutoId = ProdutoId,
            Quantidade = 5, PrecoUnitario = 0.69m, Subtotal = 3.45m
        });

        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado  = await _controller.ObterInventario();

        // ── Assert ────────────────────────────────────────────────────────
        var okResult   = Assert.IsType<OkObjectResult>(resultado.Result);
        var inventario = Assert.IsType<InventarioConsolidadoDto>(okResult.Value);

        var artigo = inventario.Artigos.FirstOrDefault(a => a.Id == ProdutoId);
        Assert.NotNull(artigo);

        // Stock = 5 - 5 = 0
        Assert.Equal(0, artigo.StockPorLoja.GetValueOrDefault(LojaId));
        Assert.Equal(0, artigo.Total);
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 3 — Sede (TemPOS=false) não aparece no inventário
    // Prova a correcção do Bug #7: LOJA_SEDE_ID hardcoded substituído por TemPOS
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Sede (TemPOS=false) não aparece no inventário")]
    public async Task ObterInventario_Sede_NaoAparecceNoInventario()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // Adicionar uma loja Sede sem TemPOS
        Db.Lojas.Add(new Loja
        {
            Id = 99, Nome = "Sede", Localidade = "Braga", TemPOS = false
        });
        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado  = await _controller.ObterInventario();

        // ── Assert ────────────────────────────────────────────────────────
        var okResult   = Assert.IsType<OkObjectResult>(resultado.Result);
        var inventario = Assert.IsType<InventarioConsolidadoDto>(okResult.Value);

        // A loja Sede (Id=99) não deve aparecer nas colunas do inventário
        Assert.DoesNotContain(inventario.Lojas, l => l.Id == 99);
    }

    // ─────────────────────────────────────────────────────────────────────
    // TESTE 4 — Transferência aumenta stock na loja destino
    // ─────────────────────────────────────────────────────────────────────

    [Fact(DisplayName = "Transferência recebida aumenta stock na loja destino")]
    public async Task ObterInventario_TransferenciaRecebida_AumentaStockDestino()
    {
        // ── Arrange ──────────────────────────────────────────────────────
        // Loja destino (Gualtar)
        const int lojaDestinoId = 4;
        Db.Lojas.Add(new Loja
        {
            Id = lojaDestinoId, Nome = "Gualtar",
            Localidade = "Braga", TemPOS = true
        });

        // Envio da Fraião para Gualtar
        var envioId = Guid.NewGuid();
        Db.Transferencias.Add(new Transferencia
        {
            Id             = envioId,
            TipoMovimento  = TipoMovimentoTransferencia.Envio,
            LojaOrigemId   = LojaId,
            LojaDestinoId  = lojaDestinoId,
            OperadorId     = OperadorId,
            DataMovimento  = DateTime.UtcNow.AddDays(-2)
        });
        Db.LinhasTransferencia.Add(new LinhaTransferencia
        {
            TransferenciaId = envioId,
            ProdutoId       = ProdutoId,
            Quantidade      = 6
        });

        // Receção em Gualtar
        var recepcaoId = Guid.NewGuid();
        Db.Transferencias.Add(new Transferencia
        {
            Id                    = recepcaoId,
            TipoMovimento         = TipoMovimentoTransferencia.Rececao,
            LojaOrigemId          = LojaId,
            LojaDestinoId         = lojaDestinoId,
            OperadorId            = OperadorId,
            DataMovimento         = DateTime.UtcNow.AddDays(-1),
            TransferenciaEnvioId  = envioId
        });
        Db.LinhasTransferencia.Add(new LinhaTransferencia
        {
            TransferenciaId = recepcaoId,
            ProdutoId       = ProdutoId,
            Quantidade      = 6
        });

        await Db.SaveChangesAsync();

        // ── Act ───────────────────────────────────────────────────────────
        var resultado  = await _controller.ObterInventario();

        // ── Assert ────────────────────────────────────────────────────────
        var okResult   = Assert.IsType<OkObjectResult>(resultado.Result);
        var inventario = Assert.IsType<InventarioConsolidadoDto>(okResult.Value);

        var artigo = inventario.Artigos.FirstOrDefault(a => a.Id == ProdutoId);
        Assert.NotNull(artigo);

        // Gualtar deve ter +6 de stock (recebeu a transferência)
        Assert.Equal(6, artigo.StockPorLoja.GetValueOrDefault(lojaDestinoId));
        // Fraião deve ter -6 de stock (enviou a transferência)
    }
}
