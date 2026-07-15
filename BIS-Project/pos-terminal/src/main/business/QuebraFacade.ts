/**
 * QuebraFacade — Camada de Negócio para Quebras de Stock (UC08).
 *
 * Coordena:
 *   - QuebraDAO:   persistência local (quebra + dedução de stock)
 *   - CatalogoDAO: leitura do produto para obter precoCusto
 *   - ConfigDAO:   leitura do contexto do terminal (LojaId, OperadorId)
 *
 * Regras de negócio encapsuladas:
 *   - Quantidade deve ser >= 1 (não pode abanar stock com 0 unidades)
 *   - Motivo é obrigatório — não existe quebra sem categorização
 *   - valorPerdido = precoCusto × quantidade (calculado aqui, não pelo renderer)
 *   - LojaId vem do config do terminal, nunca do renderer
 *   - Produto tem de existir no catálogo local
 *
 * Correspondência UML:
 *   Diagrama de Classes → QuebraFacade (implementa IQuebraFacade)
 *   Diagrama de Sequência → FacadeInventario (registo de quebra)
 */

import { QuebraDAO }   from '../data/QuebraDAO'
import { CatalogoDAO } from '../data/CatalogoDAO'
import { ConfigDAO }   from '../data/ConfigDAO'
import { ok, fail }    from '../../shared/types'
import { MotivoQuebra } from '../../shared/types'
import type {
  Result,
  QuebraInput,
  QuebrasRegistadaResultado
} from '../../shared/types'
import type { IQuebraFacade } from './interfaces/IQuebraFacade'

export class QuebraFacade implements IQuebraFacade {
  private readonly quebraDAO:   QuebraDAO
  private readonly catalogoDAO: CatalogoDAO
  private readonly configDAO:   ConfigDAO

  constructor() {
    this.quebraDAO   = new QuebraDAO()
    this.catalogoDAO = new CatalogoDAO()
    this.configDAO   = new ConfigDAO()
  }

  public registarQuebra(input: QuebraInput): Result<QuebrasRegistadaResultado> {
    // ── Regra 1: quantidade positiva ─────────────────────────────
    if (!Number.isInteger(input.quantidade) || input.quantidade < 1) {
      return fail('A quantidade tem de ser um número inteiro positivo (mínimo 1).')
    }

    // ── Regra 2: motivo obrigatório e válido ──────────────────────
    const motivosValidos = [
      MotivoQuebra.ValidadeExpirada,
      MotivoQuebra.DanoQuebraFisica,
      MotivoQuebra.FurtoDesaparecimento
    ]
    if (!motivosValidos.includes(input.motivo)) {
      return fail('Motivo de quebra inválido. Seleccione uma das opções disponíveis.')
    }

    // ── Regra 3: operador válido ──────────────────────────────────
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido. Por favor, inicie sessão novamente.')
    }

    // ── Regra 4: LojaId do terminal (não do renderer) ────────────
    const lojaIdStr = this.configDAO.get('loja_id')
    if (!lojaIdStr) {
      return fail('Terminal não configurado: ID de loja em falta.')
    }
    const lojaId = Number(lojaIdStr)

    // ── Regra 5: produto tem de existir no catálogo local ─────────
    const produto = this.catalogoDAO.porId(input.produtoId)
    if (!produto) {
      return fail(`Produto ${input.produtoId} não encontrado no catálogo local. Sincronize o catálogo.`)
    }

    // ── Regra 6: calcular valorPerdido (responsabilidade de negócio) ──
    // Usa o preço de custo — o que a BragaConvenience pagou ao fornecedor,
    // não o PVP — para reflectir o impacto real na margem de lucro.
    const valorPerdido = round2(produto.precoCusto * input.quantidade)

    // ── Delegar ao DAO ────────────────────────────────────────────
    try {
      const id = this.quebraDAO.inserir(
        lojaId,
        input.operadorId,
        input.produtoId,
        input.quantidade,
        valorPerdido,
        input.motivo
      )

      console.log(
        `[QuebraFacade] Quebra ${id.slice(0, 8)}... registada — ` +
        `${produto.artigo} × ${input.quantidade} unid. | Perda: ${valorPerdido.toFixed(2)}€`
      )

      return ok({
        id,
        valorPerdido,
        artigo: produto.artigo
      })

    } catch (erro) {
      return fail(`Erro ao registar quebra: ${(erro as Error).message}`)
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
