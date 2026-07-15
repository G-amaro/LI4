/**
 * CatalogoDAO — Data Access Object para a tabela `catalogo_local`.
 *
 * Responsabilidade única: executar operações SQL sobre o catálogo
 * de produtos armazenado localmente no terminal POS.
 * Não contém lógica de negócio nem conhece o contexto de sessão.
 *
 * Correspondência UML:
 *   Diagrama de Classes → CatalogoDAO na Camada de Dados
 */

import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type { ProdutoLocal } from '../../shared/types'

// ─── Tipo interno — colunas do SQLite (snake_case) ────────────────

interface ProdutoRow {
  id:            number
  ean:           string
  artigo:        string
  categoria:     string
  preco_custo:   number
  pvp:           number
  perecivel:     number   // SQLite não tem BOOLEAN — usa 0/1
  taxa_iva:      number
  imagem_url:    string | null
  atualizado_em: string
}

export class CatalogoDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  // ─── Leitura ───────────────────────────────────────────────────

  /** Retorna todos os produtos, ordenados por categoria e nome. */
  public listar(): ProdutoLocal[] {
    const rows = this.db.prepare(`
      SELECT * FROM catalogo_local
      ORDER BY categoria, artigo
    `).all() as ProdutoRow[]

    return rows.map(this.mapRow)
  }

  /** Procura um produto pelo código de barras EAN. */
  public porEan(ean: string): ProdutoLocal | null {
    const row = this.db.prepare(`
      SELECT * FROM catalogo_local WHERE ean = ?
    `).get(ean) as ProdutoRow | undefined

    return row ? this.mapRow(row) : null
  }

  /** Procura um produto pelo ID numérico (igual ao ID da Sede). */
  public porId(id: number): ProdutoLocal | null {
    const row = this.db.prepare(`
      SELECT * FROM catalogo_local WHERE id = ?
    `).get(id) as ProdutoRow | undefined

    return row ? this.mapRow(row) : null
  }

  /**
   * Pesquisa case-insensitive por nome, categoria ou EAN.
   * Limitado a 50 resultados para não saturar a UI.
   */
  public pesquisar(termo: string): ProdutoLocal[] {
    const like = `%${termo}%`
    const rows = this.db.prepare(`
      SELECT * FROM catalogo_local
      WHERE  artigo    LIKE ? COLLATE NOCASE
          OR categoria LIKE ? COLLATE NOCASE
          OR ean       LIKE ?
      ORDER BY artigo
      LIMIT 50
    `).all(like, like, like) as ProdutoRow[]

    return rows.map(this.mapRow)
  }

  /** Conta o número total de produtos no catálogo local. */
  public contar(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS n FROM catalogo_local'
    ).get() as { n: number }
    return row.n
  }

  // ─── Escrita ───────────────────────────────────────────────────

  /**
   * Inserção em massa com detecção de inseridos vs. actualizados.
   * Toda a operação corre numa única transacção SQLite.
   *
   * @param produtos Lista de produtos vindos da Sede
   * @param timestamp ISO-8601 do momento de sincronização
   * @returns Contagem de produtos inseridos e actualizados
   */
  public upsertMany(
    produtos: ProdutoLocal[],
    timestamp: string
  ): { inseridos: number; atualizados: number } {
    if (produtos.length === 0) return { inseridos: 0, atualizados: 0 }

    // Descobrir quais IDs já existem (1 query) — para distinguir inserido vs. actualizado
    const ids = produtos.map((p) => p.id)
    const placeholders = ids.map(() => '?').join(',')
    const existentes = new Set(
      (this.db.prepare(
        `SELECT id FROM catalogo_local WHERE id IN (${placeholders})`
      ).all(...ids) as Array<{ id: number }>).map((r) => r.id)
    )

    const stmt = this.db.prepare(`
      INSERT INTO catalogo_local
        (id, ean, artigo, categoria, preco_custo, pvp, perecivel, taxa_iva, imagem_url, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ean           = excluded.ean,
        artigo        = excluded.artigo,
        categoria     = excluded.categoria,
        preco_custo   = excluded.preco_custo,
        pvp           = excluded.pvp,
        perecivel     = excluded.perecivel,
        taxa_iva      = excluded.taxa_iva,
        imagem_url    = excluded.imagem_url,
        atualizado_em = excluded.atualizado_em
    `)

    const executar = this.db.transaction((itens: ProdutoLocal[]) => {
      for (const p of itens) {
        stmt.run(
          p.id, p.ean, p.artigo, p.categoria,
          p.precoCusto, p.pvp, p.perecivel ? 1 : 0, p.taxaIVA ?? 23, p.imagemUrl ?? null, timestamp
        )
      }
    })

    executar(produtos)

    const inseridos   = produtos.filter((p) => !existentes.has(p.id)).length
    const atualizados = produtos.length - inseridos

    return { inseridos, atualizados }
  }

  // ─── Mapeamento interno ────────────────────────────────────────

  /** Converte uma linha SQLite (snake_case) para o tipo partilhado (camelCase). */
  private mapRow(row: ProdutoRow): ProdutoLocal {
    return {
      id:           row.id,
      ean:          row.ean,
      artigo:       row.artigo,
      categoria:    row.categoria,
      precoCusto:   row.preco_custo,
      pvp:          row.pvp,
      perecivel:    row.perecivel === 1,
      taxaIVA:      row.taxa_iva ?? 23,
      imagemUrl:    row.imagem_url ?? null,
      atualizadoEm: row.atualizado_em
    }
  }
}
