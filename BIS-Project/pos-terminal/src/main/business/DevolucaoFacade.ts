/**
 * DevolucaoFacade — Camada de Negócio para Devoluções de Artigos (UC02).
 *
 * Regras de negócio encapsuladas:
 *   1. Operador tem de estar autenticado
 *   2. Loja tem de estar configurada
 *   3. Venda original tem de existir
 *   4. Pelo menos 1 linha com quantidade > 0
 *   5. Quantidade a devolver ≤ (quantidade original - já devolvido)
 *   6. Preço unitário usado é SEMPRE o da venda original (prevenção de manipulação)
 *
 * A validação aproveita as quantidades já devolvidas que vêm embutidas
 * no resultado de obterVendaComLinhas() — não precisamos consultar o DAO
 * duas vezes para a mesma informação.
 */

import { DevolucaoDAO } from '../data/DevolucaoDAO'
import { ConfigDAO }    from '../data/ConfigDAO'
import { ok, fail }     from '../../shared/types'
import type {
  Result,
  VendaOriginal,
  DevolucaoInput,
  DevolucaoResultado
} from '../../shared/types'
import type { IDevolucaoFacade } from './interfaces/IDevolucaoFacade'

export class DevolucaoFacade implements IDevolucaoFacade {
  private readonly devolucaoDAO: DevolucaoDAO
  private readonly configDAO:    ConfigDAO

  constructor() {
    this.devolucaoDAO = new DevolucaoDAO()
    this.configDAO    = new ConfigDAO()
  }

  // ─────────────────────────────────────────────────────────────────

  public obterVendaPorId(vendaId: string): Result<VendaOriginal | null> {
    if (!vendaId || vendaId.trim().length === 0) {
      return fail('ID de venda obrigatório.')
    }
    try {
      const venda = this.devolucaoDAO.obterVendaComLinhas(vendaId.trim())
      return ok(venda)
    } catch (erro) {
      console.error('[DevolucaoFacade] obterVendaPorId falhou:', erro)
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public registarDevolucao(input: DevolucaoInput): Result<DevolucaoResultado> {
    // ── Regra 1: operador ─────────────────────────────────────────
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido.')
    }

    // ── Regra 2: loja configurada ─────────────────────────────────
    const lojaIdStr = this.configDAO.get('loja_id')
    if (!lojaIdStr) {
      return fail('Terminal não configurado: ID de loja em falta.')
    }
    const lojaId = Number(lojaIdStr)

    // ── Regra 3: venda original existe ───────────────────────────
    const venda = this.devolucaoDAO.obterVendaComLinhas(input.vendaOriginalId)
    if (!venda) {
      return fail(`Venda ${input.vendaOriginalId} não encontrada.`)
    }

    // ── Regra 4: pelo menos 1 linha com qtd > 0 ──────────────────
    if (!input.linhas || input.linhas.length === 0) {
      return fail('Indique pelo menos um artigo a devolver.')
    }

    const linhasValidas = input.linhas.filter((l) => l.quantidade > 0)
    if (linhasValidas.length === 0) {
      return fail('Pelo menos um artigo deve ter quantidade > 0 para devolver.')
    }

    // ── Regras 5 e 6: validar quantidades e usar preços originais ─
    const linhasVerificadas: { produtoId: number; quantidade: number; precoUnitario: number }[] = []

    for (const linhaInput of linhasValidas) {
      const linhaOriginal = venda.linhas.find((l) => l.produtoId === linhaInput.produtoId)
      if (!linhaOriginal) {
        return fail(`O produto ${linhaInput.produtoId} não existe na venda original.`)
      }

      const disponivelParaDevolver = linhaOriginal.quantidadeOriginal - linhaOriginal.quantidadeJaDevolvida
      if (linhaInput.quantidade > disponivelParaDevolver) {
        return fail(
          `${linhaOriginal.artigo}: tentativa de devolver ${linhaInput.quantidade} unid., ` +
          `mas apenas ${disponivelParaDevolver} disponíveis ` +
          `(original: ${linhaOriginal.quantidadeOriginal}, já devolvidas: ${linhaOriginal.quantidadeJaDevolvida}).`
        )
      }

      linhasVerificadas.push({
        produtoId:     linhaInput.produtoId,
        quantidade:    linhaInput.quantidade,
        precoUnitario: linhaOriginal.precoUnitario   // SEMPRE o preço da venda original
      })
    }

    // ── Persistir via DAO (transacção atómica) ───────────────────
    try {
      const resultado = this.devolucaoDAO.inserirDevolucao(
        input.vendaOriginalId,
        lojaId,
        input.operadorId,
        linhasVerificadas,
        input.motivo?.trim() || null
      )

      console.log(
        `[DevolucaoFacade] Devolução ${resultado.id.slice(0, 8)}... registada — ` +
        `${linhasVerificadas.length} linha(s), ${resultado.valorReembolsado.toFixed(2)}€ ` +
        `(venda: ${input.vendaOriginalId.slice(0, 8)}...)`
      )

      return ok({
        id:               resultado.id,
        valorReembolsado: resultado.valorReembolsado,
        numeroLinhas:     linhasVerificadas.length,
        dataDevolucao:    resultado.dataDevolucao
      })
    } catch (erro) {
      console.error('[DevolucaoFacade] registarDevolucao falhou:', erro)
      return fail(`Erro ao gravar devolução: ${(erro as Error).message}`)
    }
  }
}
