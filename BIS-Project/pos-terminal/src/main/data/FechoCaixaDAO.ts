/**
 * FechoCaixaDAO — Data Access Object para fechos de caixa locais.
 *
 * CORRECÇÃO DE TURNOS MÚLTIPLOS (v2):
 *   O cálculo do teórico deixou de usar a data do dia como filtro.
 *   Passa a somar apenas as vendas criadas APÓS o último fecho registado.
 *   Se não existir fecho anterior, soma todas as vendas (primeiro turno do dia).
 *
 *   Antes (errado):  WHERE data_transacao LIKE '2026-04-21%'
 *   Depois (correcto): WHERE criado_em > MAX(criado_em dos fechos anteriores)
 *
 * Correspondência UML:
 *   Diagrama de Classes → FechoCaixaDAO na Camada de Dados
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type {ResultadoFecho, ValoresPorMetodo, FechoParaSync } from '../../shared/types'

interface FechoRow {
  id:                 string
  loja_id:            number
  operador_id:        number
  data_fecho:         string
  teorico_numerario:  number
  teorico_multibanco: number
  teorico_mbway:      number
  teorico_total:      number
  contado_numerario:  number
  contado_multibanco: number
  contado_mbway:      number
  contado_total:      number
  discrepancia:       number
  tem_discrepancia:   number
  justificacao:       string | null
  criado_em:          string
}

export class FechoCaixaDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Leitura / Cálculo ────────────────────────────────────────────

  /**
   * Calcula o valor teórico do turno actual.
   *
   * "Turno actual" = vendas criadas APÓS o último fecho de caixa registado.
   * Se não existe nenhum fecho anterior, inclui todas as vendas (arranque do sistema).
   *
   * O COALESCE com '1970-01-01' garante que, sem fechos anteriores,
   * a condição `criado_em > '1970-...'` é verdadeira para todas as vendas.
   */
 public calcularTeorico(): ValoresPorMetodo {
  // Vendas do turno (criadas após o último fecho)
  const vendas = this.db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN metodo_pagamento = 1 THEN valor_total ELSE 0 END), 0) AS numerario,
      COALESCE(SUM(CASE WHEN metodo_pagamento = 2 THEN valor_total ELSE 0 END), 0) AS multibanco,
      COALESCE(SUM(CASE WHEN metodo_pagamento = 3 THEN valor_total ELSE 0 END), 0) AS mbway
    FROM vendas_locais
    WHERE criado_em > COALESCE(
      (SELECT MAX(criado_em) FROM fechos_caixa_locais),
      '1970-01-01T00:00:00.000Z'
    )
  `).get() as { numerario: number; multibanco: number; mbway: number }
 
  // Devoluções do turno — usa o método de pagamento da venda original
  const devolucoes = this.db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN v.metodo_pagamento = 1 THEN d.valor_reembolsado ELSE 0 END), 0) AS numerario,
      COALESCE(SUM(CASE WHEN v.metodo_pagamento = 2 THEN d.valor_reembolsado ELSE 0 END), 0) AS multibanco,
      COALESCE(SUM(CASE WHEN v.metodo_pagamento = 3 THEN d.valor_reembolsado ELSE 0 END), 0) AS mbway
    FROM devolucoes_locais d
    INNER JOIN vendas_locais v ON v.id = d.venda_original_id
    WHERE d.criado_em > COALESCE(
      (SELECT MAX(criado_em) FROM fechos_caixa_locais),
      '1970-01-01T00:00:00.000Z'
    )
  `).get() as { numerario: number; multibanco: number; mbway: number }
 
  return {
    numerario:  round2(vendas.numerario  - devolucoes.numerario),
    multibanco: round2(vendas.multibanco - devolucoes.multibanco),
    mbway:      round2(vendas.mbway      - devolucoes.mbway)
  }
}

  /**
   * Conta quantas vendas existem desde o último fecho.
   *
   * Usado pela Facade para impedir um fecho quando não há nenhuma
   * venda a fechar — substitui a antiga regra "um fecho por dia"
   * que bloqueava turnos múltiplos.
   */
  public contarVendasDesdeUltimoFecho(): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS n
      FROM vendas_locais
      WHERE criado_em > COALESCE(
        (SELECT MAX(criado_em) FROM fechos_caixa_locais),
        '1970-01-01T00:00:00.000Z'
      )
    `).get() as { n: number }
    return row.n
  }

  /**
   * Retorna o timestamp do último fecho registado.
   * Útil para mostrar na UI "último fecho às HH:MM".
   */
  public ultimoFechoEm(): string | null {
    const row = this.db.prepare(`
      SELECT MAX(criado_em) AS ts FROM fechos_caixa_locais
    `).get() as { ts: string | null }
    return row.ts
  }

  // ─── Escrita ──────────────────────────────────────────────────────

  /**
   * Persiste o fecho de caixa do turno actual.
   */
  public inserir(
    lojaId:       number,
    operadorId:   number,
    teorico:      ValoresPorMetodo,
    contado:      ValoresPorMetodo,
    discrepancia: number,
    justificacao: string | null
  ): string {
    const id    = randomUUID()
    const agora = new Date().toISOString()

    const totalTeorico = round2(teorico.numerario  + teorico.multibanco  + teorico.mbway)
    const totalContado = round2(contado.numerario  + contado.multibanco  + contado.mbway)
    const temDiscrep   = Math.abs(discrepancia) > 0.01 ? 1 : 0

    this.db.prepare(`
      INSERT INTO fechos_caixa_locais (
        id, loja_id, operador_id, data_fecho,
        teorico_numerario, teorico_multibanco, teorico_mbway, teorico_total,
        contado_numerario, contado_multibanco, contado_mbway, contado_total,
        discrepancia, tem_discrepancia, justificacao,
        sync_status, sync_tentativas, criado_em
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        'pending', 0, ?
      )
    `).run(
      id, lojaId, operadorId, agora,
      teorico.numerario,  teorico.multibanco,  teorico.mbway,  totalTeorico,
      contado.numerario,  contado.multibanco,  contado.mbway,  totalContado,
      discrepancia, temDiscrep, justificacao,
      agora
    )

    return id
  }

  /** Lista os últimos fechos (para histórico futuro). */
  public listarRecentes(limite = 10): ResultadoFecho[] {
    const rows = this.db.prepare(`
      SELECT * FROM fechos_caixa_locais ORDER BY data_fecho DESC LIMIT ?
    `).all(limite) as FechoRow[]
    return rows.map(this.mapRow)
  }

  // ─── Mapeamento ───────────────────────────────────────────────────

  private mapRow(row: FechoRow): ResultadoFecho {
    return {
      id:              row.id,
      teorico:         { numerario: row.teorico_numerario, multibanco: row.teorico_multibanco, mbway: row.teorico_mbway },
      contado:         { numerario: row.contado_numerario, multibanco: row.contado_multibanco, mbway: row.contado_mbway },
      discrepancia:    row.discrepancia,
      temDiscrepancia: row.tem_discrepancia === 1,
      dataFecho:       row.data_fecho
    }
  }

  public listarPendentes(limite = 20): FechoParaSync[] {
  const rows = this.db.prepare(`
    SELECT * FROM fechos_caixa_locais
    WHERE sync_status = 'pending'
       OR (sync_status = 'error' AND sync_tentativas < 5)
    ORDER BY data_fecho ASC
    LIMIT ?
  `).all(limite) as FechoRow[]
 
  return rows.map((r) => ({
    id:                r.id,
    lojaId:            r.loja_id,
    operadorId:        r.operador_id,
    dataFecho:         r.data_fecho,
    teoricoNumerario:  r.teorico_numerario,
    teoricoMultibanco: r.teorico_multibanco,
    teoricoMbway:      r.teorico_mbway,
    teoricoTotal:      r.teorico_total,
    contadoNumerario:  r.contado_numerario,
    contadoMultibanco: r.contado_multibanco,
    contadoMbway:      r.contado_mbway,
    contadoTotal:      r.contado_total,
    discrepancia:      r.discrepancia,
    temDiscrepancia:   r.tem_discrepancia === 1,
    justificacao:      r.justificacao
  }))
}
 
public marcarComoSyncing(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE fechos_caixa_locais
       SET sync_status     = 'syncing',
           sync_tentativas = sync_tentativas + 1
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoSynced(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE fechos_caixa_locais
       SET sync_status      = 'synced',
           sync_ultimo_erro = NULL
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoErro(ids: string[], erro: string): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE fechos_caixa_locais
       SET sync_status      = 'error',
           sync_ultimo_erro = ?
     WHERE id IN (${ph})
  `).run(erro.slice(0, 500), ...ids)
}
 
public resetarSyncingParaPending(): number {
  const r = this.db.prepare(`
    UPDATE fechos_caixa_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
  `).run()
  return r.changes as number
}
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
