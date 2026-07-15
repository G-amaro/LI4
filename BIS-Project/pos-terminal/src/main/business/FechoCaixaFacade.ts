/**
 * FechoCaixaFacade — Camada de Negócio para Fecho de Caixa Cego (UC03).
 *
 * CORRECÇÃO v2 — Suporte a Turnos Múltiplos:
 *   A regra "um fecho por dia" foi REMOVIDA — era incorrecta para operações
 *   com múltiplos turnos (ex: turno manhã + turno tarde no mesmo dia).
 *
 *   Nova regra substituta: "não é possível fechar se não há vendas
 *   desde o último fecho" — logicamente equivalente mas operacionalmente
 *   correcta para qualquer número de turnos.
 *
 * Correspondência UML:
 *   Diagrama de Classes → FechoCaixaFacade (implementa IFechoCaixaFacade)
 *   Diagrama de Sequência 4.4.3 → FacadeVendas (Fecho de Caixa Cego)
 */

import { FechoCaixaDAO } from '../data/FechoCaixaDAO'
import { ConfigDAO }     from '../data/ConfigDAO'
import { ok, fail }      from '../../shared/types'
import type {
  Result,
  ValoresPorMetodo,
  FechoInput,
  ResultadoFecho
} from '../../shared/types'
import type { IFechoCaixaFacade } from './interfaces/IFechoCaixaFacade'

const LIMITE_DISCREPANCIA = 2.00

export class FechoCaixaFacade implements IFechoCaixaFacade {
  private readonly fechoCaixaDAO: FechoCaixaDAO
  private readonly configDAO:     ConfigDAO

  constructor() {
    this.fechoCaixaDAO = new FechoCaixaDAO()
    this.configDAO     = new ConfigDAO()
  }

  // ─────────────────────────────────────────────────────────────────

  public calcularTeorico(): Result<ValoresPorMetodo> {
    try {
      return ok(this.fechoCaixaDAO.calcularTeorico())
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public registar(input: FechoInput): Result<ResultadoFecho> {
    // ── Regra 1: loja configurada ─────────────────────────────────
    const lojaIdStr = this.configDAO.get('loja_id')
    if (!lojaIdStr) {
      return fail('Terminal não configurado: ID de loja em falta.')
    }
    const lojaId = Number(lojaIdStr)

    // ── Regra 2: operador válido ──────────────────────────────────
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido.')
    }

    // ── Regra 3: valores não negativos ───────────────────────────
    const { contado } = input
    if (contado.numerario < 0 || contado.multibanco < 0 || contado.mbway < 0) {
      return fail('Os valores contados não podem ser negativos.')
    }

    // ── Regra 4 (NOVA): tem de haver vendas desde o último fecho ──
    // Substitui a antiga regra "um fecho por dia" que bloqueava turnos múltiplos.
    // Um fecho sem vendas não faz sentido operacional — não há nada a reconciliar.
    const vendasNoTurno = this.fechoCaixaDAO.contarVendasDesdeUltimoFecho()
    if (vendasNoTurno === 0) {
      const ultimoFecho = this.fechoCaixaDAO.ultimoFechoEm()
      const quando = ultimoFecho
        ? `desde o último fecho (${new Date(ultimoFecho).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })})`
        : 'registadas'
      return fail(`Não existem vendas ${quando}. Não é possível fechar uma caixa sem movimentos.`)
    }

    // ── Calcular teórico e discrepância ───────────────────────────
    let teorico: ValoresPorMetodo
    try {
      teorico = this.fechoCaixaDAO.calcularTeorico()
    } catch (erro) {
      return fail(`Erro ao calcular valor teórico: ${(erro as Error).message}`)
    }

    const totalTeorico = round2(teorico.numerario  + teorico.multibanco  + teorico.mbway)
    const totalContado = round2(contado.numerario  + contado.multibanco  + contado.mbway)
    const discrepancia = round2(totalContado - totalTeorico)

    // ── Regra 5: justificação se discrepância > limite ────────────
    if (Math.abs(discrepancia) > LIMITE_DISCREPANCIA) {
      if (!input.justificacao || input.justificacao.trim().length < 10) {
        return fail(
          `Discrepância de ${discrepancia.toFixed(2)}€ detectada. ` +
          `É obrigatório fornecer uma justificação com pelo menos 10 caracteres.`
        )
      }
    }

    // ── Persistir ─────────────────────────────────────────────────
    try {
      const id = this.fechoCaixaDAO.inserir(
        lojaId,
        input.operadorId,
        teorico,
        contado,
        discrepancia,
        input.justificacao?.trim() ?? null
      )

      console.log(
        `[FechoCaixaFacade] Fecho ${id.slice(0, 8)}... ` +
        `| ${vendasNoTurno} venda(s) no turno ` +
        `| Teórico: ${totalTeorico.toFixed(2)}€ ` +
        `| Contado: ${totalContado.toFixed(2)}€ ` +
        `| Discrepância: ${discrepancia.toFixed(2)}€`
      )

      return ok({
        id,
        teorico,
        contado,
        discrepancia,
        temDiscrepancia: Math.abs(discrepancia) > 0.01,
        dataFecho:       new Date().toISOString()
      })

    } catch (erro) {
      return fail(`Erro ao gravar fecho de caixa: ${(erro as Error).message}`)
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
