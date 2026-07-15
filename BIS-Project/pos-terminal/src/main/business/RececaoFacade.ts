/**
 * RececaoFacade — Camada de Negócio para Receção de Mercadoria (UC09).
 *
 * Regras de negócio encapsuladas:
 *   1. Operador autenticado (operadorId válido)
 *   2. Loja configurada (config loja_id)
 *   3. Pelo menos 1 linha na receção
 *   4. Quantidades estritamente positivas (> 0)
 *   5. Todos os produtoIds têm de existir no catalogo_local
 *   6. Sem duplicados — mesmo produto em 2 linhas é erro (erro humano)
 *   7. [Fase 4] Fornecedor obrigatório e válido (> 0)
 */

import { RececaoDAO }  from '../data/RececaoDAO'
import { CatalogoDAO } from '../data/CatalogoDAO'
import { ConfigDAO }   from '../data/ConfigDAO'
import { ok, fail }    from '../../shared/types'
import type {
  Result,
  RececaoInput,
  RececaoResultado
} from '../../shared/types'
import type { IRececaoFacade } from './interfaces/IRececaoFacade'

export class RececaoFacade implements IRececaoFacade {
  private readonly rececaoDAO:  RececaoDAO
  private readonly catalogoDAO: CatalogoDAO
  private readonly configDAO:   ConfigDAO

  constructor() {
    this.rececaoDAO  = new RececaoDAO()
    this.catalogoDAO = new CatalogoDAO()
    this.configDAO   = new ConfigDAO()
  }

  // ─────────────────────────────────────────────────────────────────

  public registarRececao(input: RececaoInput): Result<RececaoResultado> {
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

    // ── Regra 3: pelo menos 1 linha ───────────────────────────────
    if (!input.linhas || input.linhas.length === 0) {
      return fail('Indique pelo menos um artigo recebido.')
    }

    // ── Regra 4: quantidades positivas ────────────────────────────
    for (const linha of input.linhas) {
      if (!Number.isInteger(linha.quantidade) || linha.quantidade <= 0) {
        return fail(`Quantidade inválida para produto ${linha.produtoId}: deve ser um inteiro > 0.`)
      }
      if (!Number.isInteger(linha.produtoId) || linha.produtoId < 1) {
        return fail(`ID de produto inválido: ${linha.produtoId}.`)
      }
    }

    // ── Regra 5: produtos existem no catálogo ─────────────────────
    for (const linha of input.linhas) {
      const produto = this.catalogoDAO.porId(linha.produtoId)
      if (!produto) {
        return fail(`Produto ${linha.produtoId} não existe no catálogo local.`)
      }
    }

    // ── Regra 6: sem duplicados ───────────────────────────────────
    const idsVistos = new Set<number>()
    for (const linha of input.linhas) {
      if (idsVistos.has(linha.produtoId)) {
        return fail(
          `O produto ${linha.produtoId} aparece mais do que uma vez. ` +
          `Some as quantidades numa única linha.`
        )
      }
      idsVistos.add(linha.produtoId)
    }

    // ── Regra 7: fornecedor obrigatório [Fase 4] ──────────────────
    if (!Number.isInteger(input.fornecedorId) || input.fornecedorId < 1) {
      return fail('Seleccione um fornecedor antes de confirmar a receção.')
    }

    // ── Persistir via DAO (transacção atómica) ────────────────────
    try {
      const resultado = this.rececaoDAO.inserirRececao(
        lojaId,
        input.operadorId,
        input.documentoReferencia?.trim() || null,
        input.fornecedorId,                          // [+ Fase 4]
        input.linhas
      )

      console.log(
        `[RececaoFacade] Receção ${resultado.id.slice(0, 8)}... registada — ` +
        `${resultado.numeroLinhas} linha(s), ${resultado.totalUnidades} unid.`
      )

      return ok(resultado)
    } catch (erro) {
      console.error('[RececaoFacade] registarRececao falhou:', erro)
      return fail(`Erro ao gravar receção: ${(erro as Error).message}`)
    }
  }
}
