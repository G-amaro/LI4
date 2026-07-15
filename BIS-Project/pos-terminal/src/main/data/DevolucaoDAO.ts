/**
 * DevolucaoDAO — Data Access Object para devoluções locais (UC02).
 *
 * CORREÇÃO v2: o stock está na tabela dedicada `stock_local`, não na
 * `catalogo_local`. O schema real tem:
 *   stock_local: produto_id (PK) → quantidade, minimo_configurado, atualizado_em
 *
 * Transacção atómica: a inserção das duas tabelas + reposição de stock
 * faz-se dentro de um .transaction() do better-sqlite3 — ou tudo acontece,
 * ou nada (garantia ACID).
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type {
  VendaOriginal,
  LinhaVendaOriginal,
  LinhaDevolucaoInput
} from '../../shared/types'

interface VendaRow {
  id:               string
  data_transacao:   string
  valor_total:      number
  metodo_pagamento: number
  nif_cliente:      string | null
}

interface LinhaVendaRow {
  produto_id:     number
  artigo:         string
  quantidade:     number
  preco_unitario: number
  subtotal:       number
}

interface DevolucaoSyncRow {
  id:                  string
  venda_original_id:   string
  operador_id:         number
  data_devolucao:      string
  valor_reembolsado:   number
  motivo:              string | null
}

interface LinhaDevolucaoSyncRow {
  produto_id:     number
  quantidade:     number
  preco_unitario: number
  subtotal:       number
}

export interface DevolucaoParaSync {
  id:                string
  vendaOriginalId:   string
  operadorId:        number
  dataDevolucao:     string
  valorReembolsado:  number
  motivo:            string | null
  linhas: Array<{
    produtoId:     number
    quantidade:    number
    precoUnitario: number
    subtotal:      number
  }>
}

export class DevolucaoDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Leitura ──────────────────────────────────────────────────

  /**
   * Obtém uma venda completa com linhas e quantidades já devolvidas.
   * Retorna null se a venda não existe.
   */
  public obterVendaComLinhas(vendaId: string): VendaOriginal | null {
    console.log(`[DevolucaoDAO] A procurar venda ${vendaId}`)

    const venda = this.db.prepare(`
      SELECT id, data_transacao, valor_total, metodo_pagamento, nif_cliente
      FROM vendas_locais
      WHERE id = ?
    `).get(vendaId) as VendaRow | undefined

    if (!venda) {
      console.log(`[DevolucaoDAO] Venda ${vendaId} não encontrada`)
      return null
    }

    const linhasRaw = this.db.prepare(`
      SELECT
        lv.produto_id,
        c.artigo,
        lv.quantidade,
        lv.preco_unitario,
        lv.subtotal
      FROM linhas_venda_locais lv
      INNER JOIN catalogo_local c ON c.id = lv.produto_id
      WHERE lv.venda_id = ?
      ORDER BY lv.id ASC
    `).all(vendaId) as LinhaVendaRow[]

    console.log(`[DevolucaoDAO] Venda encontrada com ${linhasRaw.length} linhas`)

    const linhas: LinhaVendaOriginal[] = linhasRaw.map((l) => ({
      produtoId:             l.produto_id,
      artigo:                l.artigo,
      quantidadeOriginal:    l.quantidade,
      precoUnitario:         l.preco_unitario,
      subtotal:              l.subtotal,
      quantidadeJaDevolvida: this.quantidadeJaDevolvida(vendaId, l.produto_id)
    }))

    return {
      id:              venda.id,
      dataTransacao:   venda.data_transacao,
      valorTotal:      venda.valor_total,
      metodoPagamento: venda.metodo_pagamento,
      nifCliente:      venda.nif_cliente,
      linhas
    }
  }

  /** Quantidade já devolvida deste produto nesta venda. */
  private quantidadeJaDevolvida(vendaId: string, produtoId: number): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(ld.quantidade), 0) AS total
      FROM devolucoes_locais d
      INNER JOIN linhas_devolucao_locais ld ON ld.devolucao_id = d.id
      WHERE d.venda_original_id = ? AND ld.produto_id = ?
    `).get(vendaId, produtoId) as { total: number }
    return row.total
  }

  // ─── Escrita ──────────────────────────────────────────────────

  /**
   * Regista uma devolução completa dentro de uma transacção atómica:
   *   1. Insere cabeçalho em devolucoes_locais
   *   2. Insere N linhas em linhas_devolucao_locais
   *   3. Repõe stock em stock_local (+quantidade)
   *      — se o produto ainda não tem linha em stock_local (raro), cria com INSERT OR IGNORE
   */
  public inserirDevolucao(
    vendaOriginalId: string,
    lojaId:          number,
    operadorId:      number,
    linhas:          LinhaDevolucaoInput[],
    motivo:          string | null
  ): { id: string; valorReembolsado: number; dataDevolucao: string } {
    const id             = randomUUID()
    const agora          = new Date().toISOString()
    const valorTotal     = linhas.reduce((acc, l) => acc + (l.quantidade * l.precoUnitario), 0)
    const valorArredondado = Math.round(valorTotal * 100) / 100

    const inserirCabecalho = this.db.prepare(`
      INSERT INTO devolucoes_locais (
        id, venda_original_id, loja_id, operador_id,
        data_devolucao, valor_reembolsado, motivo,
        sync_status, sync_tentativas, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `)

    const inserirLinha = this.db.prepare(`
      INSERT INTO linhas_devolucao_locais (
        devolucao_id, produto_id, quantidade, preco_unitario, subtotal
      ) VALUES (?, ?, ?, ?, ?)
    `)

    // Garantir que existe linha em stock_local para o produto
    // (INSERT OR IGNORE não falha se já existir)
    const garantirLinhaStock = this.db.prepare(`
      INSERT OR IGNORE INTO stock_local (produto_id, quantidade, minimo_configurado, atualizado_em)
      VALUES (?, 0, 0, ?)
    `)

    // Repor stock: incrementar quantidade
    const incrementarStock = this.db.prepare(`
      UPDATE stock_local
         SET quantidade = quantidade + ?, atualizado_em = ?
       WHERE produto_id = ?
    `)

    const transaction = this.db.transaction(() => {
      inserirCabecalho.run(
        id, vendaOriginalId, lojaId, operadorId,
        agora, valorArredondado, motivo, agora
      )

      for (const linha of linhas) {
        const subtotal = Math.round(linha.quantidade * linha.precoUnitario * 100) / 100
        inserirLinha.run(id, linha.produtoId, linha.quantidade, linha.precoUnitario, subtotal)

        garantirLinhaStock.run(linha.produtoId, agora)
        incrementarStock.run(linha.quantidade, agora, linha.produtoId)
      }
    })

    transaction()

    console.log(
      `[DevolucaoDAO] Devolução ${id.slice(0, 8)}... persistida — ` +
      `${linhas.length} linha(s), ${valorArredondado}€ reembolsados`
    )

    return {
      id,
      valorReembolsado: valorArredondado,
      dataDevolucao:    agora
    }
  }

  public listarPendentes(limite = 50): DevolucaoParaSync[] {
  const cabecalhos = this.db.prepare(`
    SELECT id, venda_original_id, operador_id,
           data_devolucao, valor_reembolsado, motivo
    FROM devolucoes_locais
    WHERE sync_status = 'pending'
       OR (sync_status = 'error' AND sync_tentativas < 5)
    ORDER BY data_devolucao ASC
    LIMIT ?
  `).all(limite) as DevolucaoSyncRow[]
 
  return cabecalhos.map((c) => {
    const linhas = this.db.prepare(`
      SELECT produto_id, quantidade, preco_unitario, subtotal
      FROM linhas_devolucao_locais
      WHERE devolucao_id = ?
      ORDER BY id ASC
    `).all(c.id) as LinhaDevolucaoSyncRow[]
 
    return {
      id:               c.id,
      vendaOriginalId:  c.venda_original_id,
      operadorId:       c.operador_id,
      dataDevolucao:    c.data_devolucao,
      valorReembolsado: c.valor_reembolsado,
      motivo:           c.motivo,
      linhas: linhas.map((l) => ({
        produtoId:     l.produto_id,
        quantidade:    l.quantidade,
        precoUnitario: l.preco_unitario,
        subtotal:      l.subtotal
      }))
    }
  })
}
 
public marcarComoSyncing(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE devolucoes_locais
       SET sync_status = 'syncing', sync_tentativas = sync_tentativas + 1
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoSynced(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE devolucoes_locais
       SET sync_status = 'synced', sync_ultimo_erro = NULL
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoErro(ids: string[], erro: string): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE devolucoes_locais
       SET sync_status = 'error', sync_ultimo_erro = ?
     WHERE id IN (${ph})
  `).run(erro.slice(0, 500), ...ids)
}
 
public resetarSyncingParaPending(): number {
  const r = this.db.prepare(`
    UPDATE devolucoes_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
  `).run()
  return r.changes as number
}

}
