/**
 * FornecedorDAO — acesso à tabela fornecedores_locais.
 *
 * Read-only para a aplicação: o POS não cria nem edita fornecedores.
 * O único método de escrita é upsertMany() chamado pelo SyncWorker
 * para popular o cache local a partir do GET /api/sync/fornecedores.
 */

import type Database from 'better-sqlite3'
import type { FornecedorLocal } from '../../shared/types'

interface FornecedorRow {
  id:            number
  nome:          string
  nif:           string | null
  ativo:         number
  atualizado_em: string
}

function rowToFornecedor(r: FornecedorRow): FornecedorLocal {
  return {
    id:           r.id,
    nome:         r.nome,
    nif:          r.nif,
    ativo:        r.ativo === 1,
    atualizadoEm: r.atualizado_em
  }
}

export class FornecedorDAO {
  constructor(private db: Database.Database) {}

  /** Lista todos os fornecedores activos, ordenados por nome. */
  public listarAtivos(): FornecedorLocal[] {
    const rows = this.db.prepare(`
      SELECT id, nome, nif, ativo, atualizado_em
      FROM fornecedores_locais
      WHERE ativo = 1
      ORDER BY nome ASC
    `).all() as FornecedorRow[]

    return rows.map(rowToFornecedor)
  }

  /** Lista TODOS os fornecedores (incluindo inactivos). Usado em listagens admin. */
  public listarTodos(): FornecedorLocal[] {
    const rows = this.db.prepare(`
      SELECT id, nome, nif, ativo, atualizado_em
      FROM fornecedores_locais
      ORDER BY ativo DESC, nome ASC
    `).all() as FornecedorRow[]

    return rows.map(rowToFornecedor)
  }

  public porId(id: number): FornecedorLocal | null {
    const row = this.db.prepare(`
      SELECT id, nome, nif, ativo, atualizado_em
      FROM fornecedores_locais
      WHERE id = ?
    `).get(id) as FornecedorRow | undefined

    return row ? rowToFornecedor(row) : null
  }

  public contar(): number {
    const r = this.db.prepare(`
      SELECT COUNT(*) AS total FROM fornecedores_locais WHERE ativo = 1
    `).get() as { total: number }
    return r.total
  }

  /**
   * Upsert em batch — usado pelo SyncWorker após download da Sede.
   * Substitui o registo se o id já existir.
   */
  public upsertMany(fornecedores: FornecedorLocal[]): { inseridos: number; atualizados: number } {
    if (fornecedores.length === 0) {
      return { inseridos: 0, atualizados: 0 }
    }

    let inseridos    = 0
    let atualizados  = 0

    const existeStmt = this.db.prepare(`SELECT id FROM fornecedores_locais WHERE id = ?`)
    const insertStmt = this.db.prepare(`
      INSERT INTO fornecedores_locais (id, nome, nif, ativo, atualizado_em)
      VALUES (?, ?, ?, ?, ?)
    `)
    const updateStmt = this.db.prepare(`
      UPDATE fornecedores_locais
      SET nome = ?, nif = ?, ativo = ?, atualizado_em = ?
      WHERE id = ?
    `)

    const tx = this.db.transaction((items: FornecedorLocal[]) => {
      for (const f of items) {
        const existe = existeStmt.get(f.id)
        if (existe) {
          updateStmt.run(f.nome, f.nif, f.ativo ? 1 : 0, f.atualizadoEm, f.id)
          atualizados++
        } else {
          insertStmt.run(f.id, f.nome, f.nif, f.ativo ? 1 : 0, f.atualizadoEm)
          inseridos++
        }
      }
    })

    tx(fornecedores)
    return { inseridos, atualizados }
  }
}
