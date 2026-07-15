/**
 * VendaFacade — Camada de Negócio para Vendas (UC01).
 *
 * Coordena:
 *   - VendaDAO: persistência local (SQLite)
 *   - ConfigDAO: leitura do contexto do terminal (LojaId)
 *
 * Regras de negócio encapsuladas:
 *   - Uma venda tem de ter pelo menos uma linha
 *   - O LojaId vem do config do terminal, nunca do renderer
 *   - O total é recalculado aqui (não se confia no valor do renderer)
 *   - Quantidades e preços têm de ser positivos
 *   - A venda nasce sempre com sync_status = 'pending'
 *
 * Correspondência UML:
 *   Diagrama de Classes → VendaFacade (implementa IVendaFacade)
 *   Diagrama de Sequência 4.4.1 → FacadeVendas
 */

import { VendaDAO }  from '../data/VendaDAO'
import { ConfigDAO } from '../data/ConfigDAO'
import { ok, fail }  from '../../shared/types'
import type {
  Result,
  VendaInput,
  VendaLocal,
  VendaCriadaResultado,
  SyncStatus
} from '../../shared/types'
import type { IVendaFacade } from './interfaces/IVendaFacade'

export class VendaFacade implements IVendaFacade {
  private readonly vendaDAO:  VendaDAO
  private readonly configDAO: ConfigDAO

  constructor() {
    this.vendaDAO  = new VendaDAO()
    this.configDAO = new ConfigDAO()
  }

  // ─────────────────────────────────────────────────────────────────

  public registarNovaVenda(input: VendaInput): Result<VendaCriadaResultado> {
    // ── Regra 1: tem de ter linhas ────────────────────────────────
    if (!input.linhas || input.linhas.length === 0) {
      return fail('Uma venda tem de ter pelo menos uma linha de produto.')
    }

    // ── Regra 2: operador válido ──────────────────────────────────
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido. Por favor, inicie sessão novamente.')
    }

    // ── Regra 3: validar cada linha ───────────────────────────────
    for (const linha of input.linhas) {
      if (!Number.isInteger(linha.produtoId) || linha.produtoId < 1) {
        return fail(`Produto inválido na linha (id: ${linha.produtoId}).`)
      }
      if (linha.quantidade <= 0) {
        return fail('A quantidade de cada linha deve ser superior a zero.')
      }
      if (linha.precoUnitario < 0 || linha.subtotal < 0) {
        return fail('Preços negativos não são permitidos.')
      }
    }

    // ── Regra 4: LojaId vem do config, nunca do renderer ─────────
    const lojaIdStr = this.configDAO.get('loja_id')
    if (!lojaIdStr) {
      return fail('Terminal não configurado: ID de loja em falta.')
    }
    const lojaId = Number(lojaIdStr)

    // ── Regra 5: recalcular total para prevenir adulteração ───────
    const valorTotal = round2(
      input.linhas.reduce((acc, l) => acc + l.subtotal, 0)
    )
    if (valorTotal <= 0) {
      return fail('O valor total da venda tem de ser positivo.')
    }

    // ── Delegar ao DAO ────────────────────────────────────────────
    try {
      const id = this.vendaDAO.inserir(
        lojaId,
        input.operadorId,
        valorTotal,
        input.metodoPagamento,
        input.nifCliente,
        input.linhas
      )

      console.log(
        `[VendaFacade] Venda ${id.slice(0, 8)}... registada — ` +
        `${input.linhas.length} linha(s), ${valorTotal.toFixed(2)}€`
      )

      return ok({
        id,
        valorTotal,
        numeroLinhas:  input.linhas.length,
        dataTransacao: new Date().toISOString()
      })
    } catch (erro) {
      return fail(`Erro ao gravar venda: ${(erro as Error).message}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public contarPorStatus(status: SyncStatus): Result<number> {
    try {
      return ok(this.vendaDAO.contarPorStatus(status))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public listarRecentes(limite: number): Result<VendaLocal[]> {
    try {
      const n = Math.max(1, Math.min(limite, 100))
      return ok(this.vendaDAO.listarRecentes(n))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }
}

// ─── Helper ──────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
