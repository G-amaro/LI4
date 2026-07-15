/**
 * TransferenciaDAO — Data Access Object para transferências entre lojas (UC10).
 *
 * Modelo de dados:
 *   - Cada EVENTO (envio ou recepção) é 1 linha em transferencias_locais
 *   - Um ENVIO (Loja A) e uma RECECAO (Loja B) da mesma guia são DUAS linhas
 *     ligadas por transferencia_envio_id
 *   - UNIQUE(tipo, envio_id) previne duplicação de recepções da mesma guia
 */

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type {
  LinhaTransferenciaInput,
  GuiaEnvio
} from '../../shared/types'

interface TransfRow {
  id:                     string
  tipo_movimento:         string
  loja_origem_id:         number
  loja_destino_id:        number
  data_movimento:         string
  documento_referencia:   string | null
  observacoes:            string | null
  transferencia_envio_id: string | null
}

interface LinhaDetalheRow {
  produto_id: number
  ean:        string
  artigo:     string
  categoria:  string
  quantidade: number
}

interface TransferenciaSyncRow {
  id:                     string
  tipo_movimento:         string                  // 'ENVIO' | 'RECECAO'
  loja_origem_id:         number
  loja_destino_id:        number
  operador_id:            number
  data_movimento:         string
  transferencia_envio_id: string | null
  documento_referencia:   string | null
  observacoes:            string | null
}
 
// ─── Tipo público (retorno) — podes mover para shared/types.ts se quiseres ──
 
export interface TransferenciaParaSync {
  id:                    string
  tipoMovimento:         'Envio' | 'Rececao'
  lojaOrigemId:          number
  lojaDestinoId:         number
  operadorId:            number
  dataMovimento:         string
  transferenciaEnvioId:  string | null
  documentoReferencia:   string | null
  observacoes:           string | null
  linhas: Array<{
    produtoId:  number
    quantidade: number
  }>
}
 

export class TransferenciaDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Escrita: ENVIO ──────────────────────────────────────────────

  public inserirEnvio(
    lojaOrigemId:        number,
    lojaDestinoId:       number,
    operadorId:          number,
    documentoReferencia: string | null,
    observacoes:         string | null,
    linhas:              LinhaTransferenciaInput[]
  ): { id: string; numeroLinhas: number; totalUnidades: number; dataMovimento: string } {
    const id            = randomUUID()
    const agora         = new Date().toISOString()
    const totalUnidades = linhas.reduce((acc, l) => acc + l.quantidade, 0)

    const inserirCabecalho = this.db.prepare(`
      INSERT INTO transferencias_locais (
        id, tipo_movimento,
        loja_origem_id, loja_destino_id, operador_id,
        data_movimento, transferencia_envio_id,
        documento_referencia, observacoes,
        numero_linhas, total_unidades,
        sync_status, sync_tentativas, criado_em
      ) VALUES (?, 'ENVIO', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'pending', 0, ?)
    `)

    const inserirLinha = this.db.prepare(`
      INSERT INTO linhas_transferencia_locais (transferencia_id, produto_id, quantidade)
      VALUES (?, ?, ?)
    `)

    const consultarStock = this.db.prepare(`
      SELECT quantidade FROM stock_local WHERE produto_id = ?
    `)

    const decrementarStock = this.db.prepare(`
      UPDATE stock_local
         SET quantidade = quantidade - ?, atualizado_em = ?
       WHERE produto_id = ? AND quantidade >= ?
    `)

    const transaction = this.db.transaction(() => {
      inserirCabecalho.run(
        id, lojaOrigemId, lojaDestinoId, operadorId,
        agora, documentoReferencia, observacoes,
        linhas.length, totalUnidades, agora
      )

      for (const linha of linhas) {
        inserirLinha.run(id, linha.produtoId, linha.quantidade)

        const row = consultarStock.get(linha.produtoId) as { quantidade: number } | undefined
        const stockActual = row?.quantidade ?? 0
        if (stockActual < linha.quantidade) {
          throw new Error(
            `Stock insuficiente para produto ${linha.produtoId}: ` +
            `tem ${stockActual}, a tentar enviar ${linha.quantidade}.`
          )
        }

        const result = decrementarStock.run(linha.quantidade, agora, linha.produtoId, linha.quantidade)
        if (result.changes === 0) {
          throw new Error(`Falha ao decrementar stock do produto ${linha.produtoId} (concorrência?).`)
        }
      }
    })

    transaction()

    console.log(
      `[TransferenciaDAO] ENVIO ${id.slice(0, 8)}... — ` +
      `origem ${lojaOrigemId} → destino ${lojaDestinoId}, ` +
      `${linhas.length} linha(s), ${totalUnidades} unid.`
    )

    return { id, numeroLinhas: linhas.length, totalUnidades, dataMovimento: agora }
  }

  // ─── Leitura: consultar guia de envio ────────────────────────────

  public obterGuiaEnvio(transferenciaId: string): GuiaEnvio | null {
    const cabecalho = this.db.prepare(`
      SELECT id, tipo_movimento, loja_origem_id, loja_destino_id,
             data_movimento, documento_referencia, observacoes,
             transferencia_envio_id
      FROM transferencias_locais
      WHERE id = ? AND tipo_movimento = 'ENVIO'
    `).get(transferenciaId) as TransfRow | undefined

    if (!cabecalho) return null

    const linhasRaw = this.db.prepare(`
      SELECT lt.produto_id, c.ean, c.artigo, c.categoria, lt.quantidade
      FROM linhas_transferencia_locais lt
      INNER JOIN catalogo_local c ON c.id = lt.produto_id
      WHERE lt.transferencia_id = ?
      ORDER BY lt.id ASC
    `).all(transferenciaId) as LinhaDetalheRow[]

    const rececaoExistente = this.db.prepare(`
      SELECT id FROM transferencias_locais
      WHERE tipo_movimento = 'RECECAO' AND transferencia_envio_id = ?
    `).get(transferenciaId) as { id: string } | undefined

    return {
      id:                   cabecalho.id,
      lojaOrigemId:         cabecalho.loja_origem_id,
      lojaDestinoId:        cabecalho.loja_destino_id,
      dataEnvio:            cabecalho.data_movimento,
      documentoReferencia:  cabecalho.documento_referencia,
      observacoes:          cabecalho.observacoes,
      linhas: linhasRaw.map((l) => ({
        produtoId:  l.produto_id,
        ean:        l.ean,
        artigo:     l.artigo,
        categoria:  l.categoria,
        quantidade: l.quantidade
      })),
      jaRecebida: Boolean(rececaoExistente)
    }
  }

  // ─── Escrita: RECEPÇÃO ───────────────────────────────────────────

  public inserirRececao(
    transferenciaEnvioId: string,
    lojaOrigemId:         number,
    lojaDestinoId:        number,
    operadorId:           number,
    observacoes:          string | null,
    linhas:               LinhaTransferenciaInput[]
  ): { id: string; numeroLinhas: number; totalUnidades: number; dataMovimento: string } {
    const id            = randomUUID()
    const agora         = new Date().toISOString()
    const totalUnidades = linhas.reduce((acc, l) => acc + l.quantidade, 0)

    const inserirCabecalho = this.db.prepare(`
      INSERT INTO transferencias_locais (
        id, tipo_movimento,
        loja_origem_id, loja_destino_id, operador_id,
        data_movimento, transferencia_envio_id,
        documento_referencia, observacoes,
        numero_linhas, total_unidades,
        sync_status, sync_tentativas, criado_em
      ) VALUES (?, 'RECECAO', ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'pending', 0, ?)
    `)

    const inserirLinha = this.db.prepare(`
      INSERT INTO linhas_transferencia_locais (transferencia_id, produto_id, quantidade)
      VALUES (?, ?, ?)
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
        id, lojaOrigemId, lojaDestinoId, operadorId,
        agora, transferenciaEnvioId, observacoes,
        linhas.length, totalUnidades, agora
      )

      for (const linha of linhas) {
        inserirLinha.run(id, linha.produtoId, linha.quantidade)
        garantirLinhaStock.run(linha.produtoId, agora)
        incrementarStock.run(linha.quantidade, agora, linha.produtoId)
      }
    })

    try {
      transaction()
    } catch (erro) {
      const msg = (erro as Error).message
      if (msg.includes('UNIQUE constraint failed')) {
        throw new Error(`A guia ${transferenciaEnvioId} já foi recebida anteriormente.`)
      }
      throw erro
    }

    console.log(
      `[TransferenciaDAO] RECECAO ${id.slice(0, 8)}... — ` +
      `da guia ${transferenciaEnvioId.slice(0, 8)}..., ` +
      `${linhas.length} linha(s), ${totalUnidades} unid.`
    )

    return { id, numeroLinhas: linhas.length, totalUnidades, dataMovimento: agora }
  }

  // ─── Helper: listar lojas (para dropdown do envio) ───────────────

  /**
   * Lista lojas a partir do cache de config (chaves "lojas_cache").
   * Se não houver cache, devolve array vazio — fallback é UI mostrar
   * input manual de ID da loja destino.
   */
  public listarLojasCache(): Array<{ id: number; nome: string }> {
    // Reutiliza a tabela config — as lojas podem ser guardadas como JSON
    const row = this.db.prepare(`SELECT valor FROM config WHERE chave = 'lojas_cache'`).get() as
      { valor: string } | undefined

    if (!row) return []
    try {
      return JSON.parse(row.valor) as Array<{ id: number; nome: string }>
    } catch {
      return []
    }
  }

  public listarPendentes(limite = 50): TransferenciaParaSync[] {
  const rows = this.db.prepare(`
    SELECT id, tipo_movimento, loja_origem_id, loja_destino_id, operador_id,
           data_movimento, transferencia_envio_id, documento_referencia, observacoes
    FROM transferencias_locais
    WHERE sync_status = 'pending'
       OR (sync_status = 'error' AND sync_tentativas < 5)
    ORDER BY data_movimento ASC
    LIMIT ?
  `).all(limite) as TransferenciaSyncRow[]
 
  // Carregar linhas de cada transferência
  return rows.map((r) => {
    const linhas = this.db.prepare(`
      SELECT produto_id, quantidade
      FROM linhas_transferencia_locais
      WHERE transferencia_id = ?
      ORDER BY id ASC
    `).all(r.id) as Array<{ produto_id: number; quantidade: number }>
 
    return {
      id:                   r.id,
      // Converter 'ENVIO'/'RECECAO' (SQLite) para 'Envio'/'Rececao' (C# enum JSON)
      tipoMovimento:        r.tipo_movimento === 'ENVIO' ? 'Envio' : 'Rececao',
      lojaOrigemId:         r.loja_origem_id,
      lojaDestinoId:        r.loja_destino_id,
      operadorId:           r.operador_id,
      dataMovimento:        r.data_movimento,
      transferenciaEnvioId: r.transferencia_envio_id,
      documentoReferencia:  r.documento_referencia,
      observacoes:          r.observacoes,
      linhas: linhas.map((l) => ({
        produtoId:  l.produto_id,
        quantidade: l.quantidade
      }))
    }
  })
}
 
public marcarComoSyncing(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE transferencias_locais
       SET sync_status     = 'syncing',
           sync_tentativas = sync_tentativas + 1
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoSynced(ids: string[]): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE transferencias_locais
       SET sync_status      = 'synced',
           sync_ultimo_erro = NULL
     WHERE id IN (${ph})
  `).run(...ids)
}
 
public marcarComoErro(ids: string[], erro: string): void {
  if (ids.length === 0) return
  const ph = ids.map(() => '?').join(',')
  this.db.prepare(`
    UPDATE transferencias_locais
       SET sync_status      = 'error',
           sync_ultimo_erro = ?
     WHERE id IN (${ph})
  `).run(erro.slice(0, 500), ...ids)
}
 
public resetarSyncingParaPending(): number {
  const r = this.db.prepare(`
    UPDATE transferencias_locais SET sync_status = 'pending' WHERE sync_status = 'syncing'
  `).run()
  return r.changes as number
}
 
/**
 * Grava uma guia de ENVIO recebida da Sede no SQLite local.
 *
 * Esta é a peça chave do offline-first para transferências entre lojas:
 * a Loja A envia → sync Sede; a Loja B puxa da Sede → grava aqui; depois
 * a UI de "Receber" da Loja B mostra a guia como se tivesse sido emitida
 * localmente.
 *
 * Como a guia foi criada NOUTRO terminal, ela JÁ existe na Sede (sync_status
 * deve ser 'synced' para não reenviar). É idempotente — se a guia já existir
 * localmente (INSERT OR IGNORE), não faz nada.
 */
public importarGuiaDaSede(guia: {
  id:                   string
  lojaOrigemId:         number
  lojaDestinoId:        number
  dataMovimento:        string
  documentoReferencia:  string | null
  observacoes:          string | null
  linhas: Array<{
    produtoId:  number
    ean:        string
    artigo:     string
    categoria:  string
    quantidade: number
  }>
}): boolean {
  // Verificar se já existe (idempotência — não queremos duplicar)
  const existe = this.db.prepare(`
    SELECT 1 FROM transferencias_locais WHERE id = ?
  `).get(guia.id)
  if (existe) return false
 
  // Garantir que todos os produtos existem no catalogo_local
  // (se o catálogo não estiver sincronizado, criamos stubs para não quebrar FK)
  const garantirProduto = this.db.prepare(`
    INSERT OR IGNORE INTO catalogo_local (
      id, ean, artigo, categoria, preco_custo, pvp, perecivel, atualizado_em
    ) VALUES (?, ?, ?, ?, 0, 0, 0, ?)
  `)
 
  const inserirCabecalho = this.db.prepare(`
    INSERT INTO transferencias_locais (
      id, tipo_movimento,
      loja_origem_id, loja_destino_id, operador_id,
      data_movimento, transferencia_envio_id,
      documento_referencia, observacoes,
      numero_linhas, total_unidades,
      sync_status, sync_tentativas, criado_em
    ) VALUES (?, 'ENVIO', ?, ?, 0, ?, NULL, ?, ?, ?, ?, 'synced', 0, ?)
  `)
  // Nota: operador_id = 0 porque foi um operador de OUTRA loja
  // Nota: sync_status = 'synced' porque veio da Sede, já está lá
 
  const inserirLinha = this.db.prepare(`
    INSERT INTO linhas_transferencia_locais (transferencia_id, produto_id, quantidade)
    VALUES (?, ?, ?)
  `)
 
  const totalUnidades = guia.linhas.reduce((acc, l) => acc + l.quantidade, 0)
  const agora = new Date().toISOString()
 
  const transaction = this.db.transaction(() => {
    for (const l of guia.linhas) {
      garantirProduto.run(l.produtoId, l.ean, l.artigo, l.categoria, agora)
    }
 
    inserirCabecalho.run(
      guia.id,
      guia.lojaOrigemId,
      guia.lojaDestinoId,
      guia.dataMovimento,
      guia.documentoReferencia,
      guia.observacoes,
      guia.linhas.length,
      totalUnidades,
      agora
    )
 
    for (const l of guia.linhas) {
      inserirLinha.run(guia.id, l.produtoId, l.quantidade)
    }
  })
 
  transaction()
 
  console.log(
    `[TransferenciaDAO] Guia ${guia.id.slice(0, 8)}... importada da Sede ` +
    `(${guia.linhas.length} linha(s), ${totalUnidades} unid. da loja ${guia.lojaOrigemId})`
  )
 
  return true
}

public listarGuiasPendentesLocais(lojaDestinoId: number): Array<{
  id:                   string
  lojaOrigemId:         number
  dataMovimento:        string
  documentoReferencia:  string | null
  numeroLinhas:         number
  totalUnidades:        number
}> {
  const rows = this.db.prepare(`
    SELECT t.id,
           t.loja_origem_id,
           t.data_movimento,
           t.documento_referencia,
           t.numero_linhas,
           t.total_unidades
    FROM transferencias_locais t
    WHERE t.tipo_movimento = 'ENVIO'
      AND t.loja_destino_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM transferencias_locais r
        WHERE r.tipo_movimento = 'RECECAO'
          AND r.transferencia_envio_id = t.id
      )
    ORDER BY t.data_movimento DESC
  `).all(lojaDestinoId) as Array<{
    id:                   string
    loja_origem_id:       number
    data_movimento:       string
    documento_referencia: string | null
    numero_linhas:        number
    total_unidades:       number
  }>

  return rows.map((r) => ({
    id:                  r.id,
    lojaOrigemId:        r.loja_origem_id,
    dataMovimento:       r.data_movimento,
    documentoReferencia: r.documento_referencia,
    numeroLinhas:        r.numero_linhas,
    totalUnidades:       r.total_unidades
  }))
}

}


