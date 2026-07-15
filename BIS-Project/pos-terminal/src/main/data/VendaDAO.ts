/**
 * VendaDAO — Data Access Object para vendas locais e stock.
 *
 * Responsabilidade: executar operações SQL sobre `vendas_locais`,
 * `linhas_venda_locais` e `stock_local`.
 *
 * Decisão de design — porquê o stock está neste DAO:
 *   A dedução de stock DEVE ser atómica com a inserção da venda.
 *   better-sqlite3 garante atomicidade através de db.transaction().
 *   Se a dedução estivesse na Facade, precisaríamos de duas chamadas
 *   DAO separadas sem garantia transaccional entre elas.
 *   Como o inserir() já corre numa única transaction, é aqui que
 *   o stock é actualizado — por necessidade arquitectural, não por
 *   violação de separação de responsabilidades.
 *
 * Correspondência UML:
 *   Diagrama de Classes → VendaDAO na Camada de Dados
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type {
  VendaLocal,
  VendaCompleta,
  SyncStatus,
  MetodoPagamento,
  LinhaVendaInput
} from '../../shared/types'

// ─── Tipos internos ───────────────────────────────────────────────

interface VendaRow {
  id:               string
  loja_id:          number
  operador_id:      number
  data_transacao:   string
  valor_total:      number
  metodo_pagamento: number
  nif_cliente:      string | null
  sync_status:      SyncStatus
  sync_tentativas:  number
  sync_ultimo_erro: string | null
  criado_em:        string
}

interface LinhaRow {
  id:             number
  venda_id:       string
  produto_id:     number
  quantidade:     number
  preco_unitario: number
  subtotal:       number
}

// ─── Classe ───────────────────────────────────────────────────────

export class VendaDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Escrita ─────────────────────────────────────────────────────

  /**
   * Insere uma nova venda, as suas linhas, e deduz o stock —
   * tudo numa única transacção atómica.
   *
   * Comportamento do stock:
   *   - Se o produto já tem entrada em stock_local: deduz a quantidade.
   *   - Se o produto NÃO tem entrada (stock nunca inicializado):
   *     cria a linha com 0 e deduz, resultando em valor negativo.
   *     Isto é intencional — sinaliza stock desconhecido ao gestor.
   *     Será corrigido quando UC04 (Receção de Mercadoria) for implementado.
   *
   * @returns UUID da venda criada
   */
  public inserir(
    lojaId:          number,
    operadorId:      number,
    valorTotal:      number,
    metodoPagamento: number,
    nifCliente:      string | null,
    linhas:          LinhaVendaInput[]
  ): string {
    const id    = randomUUID()
    const agora = new Date().toISOString()

    // ── Prepared statements (definidos fora da transaction para reutilização) ──

    const stmtVenda = this.db.prepare(`
      INSERT INTO vendas_locais
        (id, loja_id, operador_id, data_transacao, valor_total,
         metodo_pagamento, nif_cliente, sync_status, sync_tentativas, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `)

    const stmtLinha = this.db.prepare(`
      INSERT INTO linhas_venda_locais
        (venda_id, produto_id, quantidade, preco_unitario, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `)

    // ── ★ NOVO: stock ★ ──────────────────────────────────────────────────────
    //
    // Passo A: garante que a linha de stock existe (INSERT OR IGNORE).
    //   Se já existe → não faz nada.
    //   Se não existe → cria com quantidade = 0.
    //
    const stmtStockInit = this.db.prepare(`
      INSERT OR IGNORE INTO stock_local
        (produto_id, quantidade, minimo_configurado, atualizado_em)
      VALUES (?, 0, 0, ?)
    `)

    // Passo B: deduz a quantidade vendida da linha de stock.
    //
    const stmtStockDeduzir = this.db.prepare(`
      UPDATE stock_local
         SET quantidade    = quantidade - ?,
             atualizado_em = ?
       WHERE produto_id = ?
    `)
    // ────────────────────────────────────────────────────────────────────────

    const executar = this.db.transaction(() => {
      // 1. Inserir cabeçalho da venda
      stmtVenda.run(
        id, lojaId, operadorId, agora, valorTotal, metodoPagamento, nifCliente, agora
      )

      // 2. Inserir linhas + deduzir stock de cada produto
      for (const l of linhas) {
        stmtLinha.run(id, l.produtoId, l.quantidade, l.precoUnitario, l.subtotal)

        // ★ NOVO: dedução atómica ★
        stmtStockInit.run(l.produtoId, agora)       // garante que a linha existe
        stmtStockDeduzir.run(l.quantidade, agora, l.produtoId)   // deduz
      }
    })

    executar()  // atira exceção em falha → ROLLBACK automático de tudo
    return id
  }

  // ─── Leitura ─────────────────────────────────────────────────────

  public contarPorStatus(status: SyncStatus): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM vendas_locais WHERE sync_status = ?')
      .get(status) as { n: number }
    return row.n
  }

  public listarRecentes(limite: number): VendaLocal[] {
    const n = Math.max(1, Math.min(limite, 500))
    const rows = this.db.prepare(`
      SELECT * FROM vendas_locais ORDER BY data_transacao DESC LIMIT ?
    `).all(n) as VendaRow[]
    return rows.map(this.mapRow)
  }

  public listarPendentes(limite = 50): VendaCompleta[] {
    const vendas = this.db.prepare(`
      SELECT * FROM vendas_locais
      WHERE sync_status = 'pending'
         OR (sync_status = 'error' AND sync_tentativas < 5)
      ORDER BY data_transacao ASC
      LIMIT ?
    `).all(limite) as VendaRow[]

    if (vendas.length === 0) return []

    const ids          = vendas.map((v) => v.id)
    const placeholders = ids.map(() => '?').join(',')
    const linhas = this.db.prepare(`
      SELECT * FROM linhas_venda_locais WHERE venda_id IN (${placeholders})
    `).all(...ids) as LinhaRow[]

    const linhasPorVenda = new Map<string, LinhaVendaInput[]>()
    for (const l of linhas) {
      const arr = linhasPorVenda.get(l.venda_id) ?? []
      arr.push(this.mapLinha(l))
      linhasPorVenda.set(l.venda_id, arr)
    }

    return vendas.map((v) => ({
      ...this.mapRow(v),
      linhas: linhasPorVenda.get(v.id) ?? []
    }))
  }

  // ─── Actualização de status (usada pelo SyncWorker) ──────────────

  public marcarComoSyncing(ids: string[]): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE vendas_locais
         SET sync_status     = 'syncing',
             sync_tentativas = sync_tentativas + 1
       WHERE id IN (${ph})
    `).run(...ids)
  }

  public marcarComoSynced(ids: string[]): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE vendas_locais
         SET sync_status      = 'synced',
             sync_ultimo_erro = NULL
       WHERE id IN (${ph})
    `).run(...ids)
  }

  public marcarComoErro(ids: string[], erro: string): void {
    if (ids.length === 0) return
    const ph = ids.map(() => '?').join(',')
    this.db.prepare(`
      UPDATE vendas_locais
         SET sync_status      = 'error',
             sync_ultimo_erro = ?
       WHERE id IN (${ph})
    `).run(erro.slice(0, 500), ...ids)
  }

  public resetarSyncingParaPending(): number {
    const r = this.db.prepare(`
      UPDATE vendas_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
    `).run()
    return r.changes as number
  }

  // ─── Mapeamento interno ───────────────────────────────────────────

  private mapRow(row: VendaRow): VendaLocal {
    return {
      id:              row.id,
      lojaId:          row.loja_id,
      operadorId:      row.operador_id,
      dataTransacao:   row.data_transacao,
      valorTotal:      row.valor_total,
      metodoPagamento: row.metodo_pagamento as MetodoPagamento,
      nifCliente:      row.nif_cliente,
      syncStatus:      row.sync_status,
      syncTentativas:  row.sync_tentativas,
      syncUltimoErro:  row.sync_ultimo_erro,
      criadoEm:        row.criado_em
    }
  }

  private mapLinha(row: LinhaRow): LinhaVendaInput {
    return {
      produtoId:     row.produto_id,
      quantidade:    row.quantidade,
      precoUnitario: row.preco_unitario,
      subtotal:      row.subtotal
    }
  }
}
