/**
 * RececaoDAO — Data Access Object para receções de mercadoria (UC09).
 *
 * Responsabilidades:
 *   - Persistir receção em rececoes_locais + linhas_rececao_locais
 *   - Incrementar stock_local atomicamente para cada linha
 *
 * Transacção atómica (better-sqlite3): cabeçalho + linhas + stock
 * acontecem numa única unidade. Se falhar a meio, rollback total.
 *
 * Fase 4: + fornecedor_id no cabeçalho, + preco_custo nas linhas.
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type { LinhaRececaoInput } from '../../shared/types'

// ─── Tipos internos (rows da BD) ────────────────────────────────

interface RececaoSyncRow {
  id:                   string
  operador_id:          number
  data_rececao:         string
  documento_referencia: string | null
  fornecedor_id:        number | null    // [+ Fase 4]
}

interface LinhaRececaoSyncRow {
  produto_id:    number
  quantidade:    number
  lote:          string | null
  data_validade: string | null
  preco_custo:   number                  // [+ Fase 4]
}

// ─── Tipo público (retorno de listarPendentes) ───────────────────

export interface RececaoParaSync {
  id:                   string
  operadorId:           number
  dataRececao:          string
  documentoReferencia:  string | null
  fornecedorId:         number | null    // [+ Fase 4]
  linhas: Array<{
    produtoId:    number
    quantidade:   number
    lote:         string | null
    dataValidade: string | null
    precoCusto:   number                 // [+ Fase 4]
  }>
}

// ═══════════════════════════════════════════════════════════════

export class RececaoDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Escrita ──────────────────────────────────────────────────

  /**
   * Regista uma receção completa dentro de uma transacção atómica:
   *   1. Insere cabeçalho em rececoes_locais
   *   2. Insere N linhas em linhas_rececao_locais (com lote, validade, preço)
   *   3. Incrementa quantidade em stock_local para cada produto
   *
   * Fase 4: recebe fornecedorId e preco_custo por linha.
   */
  public inserirRececao(
    lojaId:               number,
    operadorId:           number,
    documentoReferencia:  string | null,
    fornecedorId:         number | null,   // [+ Fase 4]
    linhas:               LinhaRececaoInput[]
  ): { id: string; numeroLinhas: number; totalUnidades: number; dataRececao: string } {
    const id            = randomUUID()
    const agora         = new Date().toISOString()
    const totalUnidades = linhas.reduce((acc, l) => acc + l.quantidade, 0)

    const inserirCabecalho = this.db.prepare(`
      INSERT INTO rececoes_locais (
        id, loja_id, operador_id,
        data_rececao, documento_referencia,
        fornecedor_id,
        numero_linhas, total_unidades,
        sync_status, sync_tentativas, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `)

    const inserirLinha = this.db.prepare(`
      INSERT INTO linhas_rececao_locais
        (rececao_id, produto_id, quantidade, lote, data_validade, preco_custo)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const garantirLinhaStock = this.db.prepare(`
      INSERT OR IGNORE INTO stock_local (produto_id, quantidade, minimo_configurado, atualizado_em)
      VALUES (?, 0, 0, ?)
    `)

    const incrementarStock = this.db.prepare(`
      UPDATE stock_local
         SET quantidade = quantidade + ?, atualizado_em = ?
       WHERE produto_id = ?
    `)

    const transaction = this.db.transaction(() => {
      inserirCabecalho.run(
        id, lojaId, operadorId,
        agora, documentoReferencia,
        fornecedorId,              // [+ Fase 4]
        linhas.length, totalUnidades,
        agora
      )

      for (const linha of linhas) {
        inserirLinha.run(
          id,
          linha.produtoId,
          linha.quantidade,
          linha.lote ?? null,
          linha.dataValidade ?? null,
          linha.precoCusto ?? 0    // [+ Fase 4]
        )
        garantirLinhaStock.run(linha.produtoId, agora)
        incrementarStock.run(linha.quantidade, agora, linha.produtoId)
      }
    })

    transaction()

    console.log(
      `[RececaoDAO] Receção ${id.slice(0, 8)}... persistida — ` +
      `${linhas.length} linha(s), ${totalUnidades} unid. totais` +
      (documentoReferencia ? ` (ref: ${documentoReferencia})` : '') +
      (fornecedorId ? ` (forn: ${fornecedorId})` : '')
    )

    return {
      id,
      numeroLinhas:  linhas.length,
      totalUnidades,
      dataRececao:   agora
    }
  }

  // ─── Sync ─────────────────────────────────────────────────────

  public listarPendentes(limite = 50): RececaoParaSync[] {
    const cabecalhos = this.db.prepare(`
      SELECT id, operador_id, data_rececao, documento_referencia, fornecedor_id
      FROM rececoes_locais
      WHERE sync_status = 'pending'
         OR (sync_status = 'error' AND sync_tentativas < 5)
      ORDER BY data_rececao ASC
      LIMIT ?
    `).all(limite) as RececaoSyncRow[]

    return cabecalhos.map((c) => {
      const linhas = this.db.prepare(`
        SELECT produto_id, quantidade, lote, data_validade, preco_custo
        FROM linhas_rececao_locais
        WHERE rececao_id = ?
        ORDER BY id ASC
      `).all(c.id) as LinhaRececaoSyncRow[]

      return {
        id:                  c.id,
        operadorId:          c.operador_id,
        dataRececao:         c.data_rececao,
        documentoReferencia: c.documento_referencia,
        fornecedorId:        c.fornecedor_id ?? null,   // [+ Fase 4]
        linhas: linhas.map((l) => ({
          produtoId:    l.produto_id,
          quantidade:   l.quantidade,
          lote:         l.lote ?? null,
          dataValidade: l.data_validade ?? null,
          precoCusto:   l.preco_custo ?? 0              // [+ Fase 4]
        }))
      }
    })
  }

  public marcarComoSyncing(ids: string[]): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE rececoes_locais
         SET sync_status = 'syncing', sync_tentativas = sync_tentativas + 1
       WHERE id IN (${ph})
    `).run(...ids)
  }

  public marcarComoSynced(ids: string[]): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE rececoes_locais
         SET sync_status = 'synced', sync_ultimo_erro = NULL
       WHERE id IN (${ph})
    `).run(...ids)
  }

  public marcarComoErro(ids: string[], erro: string): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE rececoes_locais
         SET sync_status = 'error', sync_ultimo_erro = ?
       WHERE id IN (${ph})
    `).run(erro.slice(0, 500), ...ids)
  }

  public resetarSyncingParaPending(): number {
    const r = this.db.prepare(`
      UPDATE rececoes_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
    `).run()
    return r.changes as number
  }
}
