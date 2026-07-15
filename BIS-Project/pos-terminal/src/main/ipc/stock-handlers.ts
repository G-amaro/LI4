/**
 * Stock Controller — consultas ao stock_local.
 *
 * Expõe ao renderer a quantidade disponível por produto,
 * consultando directamente a tabela stock_local do SQLite.
 *
 * Não há Facade aqui — a lógica é trivial (1 SELECT) e não
 * justifica camadas extra.
 */

import { ipcMain } from 'electron'
import { getDb }   from '../database/connection'
import { IpcChannels } from '../../shared/ipc-channels'
import { ok } from '../../shared/types'

export function registerStockHandlers(): void {
  const db = getDb()

  /**
   * Devolve a quantidade disponível em stock para um produto.
   * Retorna 0 se o produto não existir em stock_local.
   */
  ipcMain.handle(IpcChannels.StockPorProduto, (_evt, produtoId: number) => {
    try {
      const row = db.prepare(`
        SELECT quantidade FROM stock_local WHERE produto_id = ?
      `).get(produtoId) as { quantidade: number } | undefined

      return ok(row?.quantidade ?? 0)
    } catch (e) {
      return ok(0) // se falhar, assume 0 — não é erro crítico
    }
  })

  /**
   * Devolve o stock de múltiplos produtos de uma vez (batch).
   * Mais eficiente do que N chamadas separadas.
   * Retorna um Record<produtoId, quantidade>.
   */
  ipcMain.handle(IpcChannels.StockBatch, (_evt, produtoIds: number[]) => {
    if (!produtoIds || produtoIds.length === 0) return ok({} as Record<number, number>)

    try {
      const ph   = produtoIds.map(() => '?').join(',')
      const rows = db.prepare(`
        SELECT produto_id, quantidade
        FROM stock_local
        WHERE produto_id IN (${ph})
      `).all(...produtoIds) as Array<{ produto_id: number; quantidade: number }>

      const resultado: Record<number, number> = {}
      // Inicializar todos a 0
      for (const id of produtoIds) resultado[id] = 0
      // Preencher os que existem
      for (const row of rows) resultado[row.produto_id] = row.quantidade

      return ok(resultado)
    } catch (e) {
      // Fallback: todos a 0
      const resultado: Record<number, number> = {}
      for (const id of produtoIds) resultado[id] = 0
      return ok(resultado)
    }
  })
}
