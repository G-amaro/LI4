/**
 * QuebraDAO — Data Access Object para a tabela `quebras_locais`.
 *
 * Tal como o VendaDAO, a dedução de stock é feita dentro da mesma
 * transacção atómica que o registo da quebra — garantindo que nunca
 * existe uma quebra registada sem a correspondente redução de stock.
 *
 * Diferença importante face ao VendaDAO:
 *   - Uma quebra é IMUTÁVEL após submissão (não pode ser editada ou anulada)
 *   - Qualquer correcção deve ser feita por um novo lançamento de acerto
 *   - O DAO reflecte isto não expondo métodos de update ou delete
 *
 * Correspondência UML:
 *   Diagrama de Classes → QuebraDAO na Camada de Dados
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type { QuebraLocal, SyncStatus, MotivoQuebra, QuebraParaSync } from '../../shared/types'

interface QuebraRow {
  id:               string
  loja_id:          number
  operador_id:      number
  produto_id:       number
  quantidade:       number
  valor_perdido:    number
  motivo:           number
  data_registo:     string
  sync_status:      SyncStatus
  sync_tentativas:  number
  sync_ultimo_erro: string | null
  criado_em:        string
}

export class QuebraDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  /**
   * Regista uma quebra e deduz o stock — numa única transacção atómica.
   *
   * Comportamento do stock (idêntico ao VendaDAO):
   *   - Se o produto já tem entrada em stock_local: deduz.
   *   - Se não tem entrada: cria com 0 e deduz (resultado negativo
   *     sinaliza stock desconhecido até UC04 ser implementado).
   *
   * @returns UUID da quebra criada
   */
  public inserir(
    lojaId:       number,
    operadorId:   number,
    produtoId:    number,
    quantidade:   number,
    valorPerdido: number,
    motivo:       number
  ): string {
    const id    = randomUUID()
    const agora = new Date().toISOString()

    const stmtQuebra = this.db.prepare(`
      INSERT INTO quebras_locais
        (id, loja_id, operador_id, produto_id, quantidade,
         valor_perdido, motivo, data_registo, sync_status, sync_tentativas, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `)

    // ── Dedução de stock (mesma lógica do VendaDAO) ──────────────
    const stmtStockInit = this.db.prepare(`
      INSERT OR IGNORE INTO stock_local
        (produto_id, quantidade, minimo_configurado, atualizado_em)
      VALUES (?, 0, 0, ?)
    `)

    const stmtStockDeduzir = this.db.prepare(`
      UPDATE stock_local
         SET quantidade    = quantidade - ?,
             atualizado_em = ?
       WHERE produto_id = ?
    `)

    const executar = this.db.transaction(() => {
      stmtQuebra.run(id, lojaId, operadorId, produtoId, quantidade, valorPerdido, motivo, agora, agora)
      stmtStockInit.run(produtoId, agora)
      stmtStockDeduzir.run(quantidade, agora, produtoId)
    })

    executar()
    return id
  }

  /** Lista as quebras mais recentes (qualquer status). */
  public listarRecentes(limite: number): QuebraLocal[] {
    const n = Math.max(1, Math.min(limite, 100))
    const rows = this.db.prepare(`
      SELECT * FROM quebras_locais ORDER BY data_registo DESC LIMIT ?
    `).all(n) as QuebraRow[]
    return rows.map(this.mapRow)
  }

  private mapRow(row: QuebraRow): QuebraLocal {
    return {
      id:           row.id,
      lojaId:       row.loja_id,
      operadorId:   row.operador_id,
      produtoId:    row.produto_id,
      quantidade:   row.quantidade,
      valorPerdido: row.valor_perdido,
      motivo:       row.motivo as MotivoQuebra,
      dataRegisto:  row.data_registo,
      syncStatus:   row.sync_status,
      criadoEm:     row.criado_em
    }
  }

  public listarPendentes(limite = 50): QuebraParaSync[] {
  const rows = this.db.prepare(`
    SELECT * FROM quebras_locais
    WHERE sync_status = 'pending'
       OR (sync_status = 'error' AND sync_tentativas < 5)
    ORDER BY data_registo ASC
    LIMIT ?
  `).all(limite) as QuebraRow[]
 
  return rows.map((r) => ({
    id:           r.id,
    lojaId:       r.loja_id,
    operadorId:   r.operador_id,
    produtoId:    r.produto_id,
    quantidade:   r.quantidade,
    valorPerdido: r.valor_perdido,
    motivo:       r.motivo,
    dataRegisto:  r.data_registo
  }))
}
 
public marcarComoSyncing(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE quebras_locais
       SET sync_status     = 'syncing',
           sync_tentativas = sync_tentativas + 1
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoSynced(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE quebras_locais
       SET sync_status      = 'synced',
           sync_ultimo_erro = NULL
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoErro(ids: string[], erro: string): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE quebras_locais
       SET sync_status      = 'error',
           sync_ultimo_erro = ?
     WHERE id IN (${ph})
  `).run(erro.slice(0, 500), ...ids)
}
 
public resetarSyncingParaPending(): number {
  const r = this.db.prepare(`
    UPDATE quebras_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
  `).run()
  return r.changes as number
}
 

}
