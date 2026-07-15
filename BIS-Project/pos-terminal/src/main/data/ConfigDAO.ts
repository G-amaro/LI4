/**
 * ConfigDAO — Data Access Object para a tabela `config`.
 *
 * A tabela `config` é um key-value store local que persiste
 * metadados de sessão e configurações do terminal entre arranques.
 *
 * Padrão DAO:
 *   - Encapsula EXCLUSIVAMENTE o acesso ao SQLite (tabela config)
 *   - Não contém lógica de negócio
 *   - Todos os métodos são síncronos (better-sqlite3 é síncrono by design)
 *
 * Correspondência UML:
 *   Diagrama de Classes → ConfigDAO na Camada de Dados
 */

import type Database from 'better-sqlite3'
import { getDb } from '../database/connection'
import type { ConfigKey } from '../../shared/types'

interface ConfigRow {
  chave: string
  valor: string
}

export class ConfigDAO {
  private readonly db: Database.Database

  constructor() {
    this.db = getDb()
  }

  /**
   * Lê o valor de uma chave.
   * @returns O valor como string, ou null se a chave não existir.
   */
  public get(chave: ConfigKey): string | null {
    const row = this.db
      .prepare('SELECT valor FROM config WHERE chave = ?')
      .get(chave) as ConfigRow | undefined
    return row?.valor ?? null
  }

  /**
   * Insere ou actualiza (UPSERT) um par chave-valor.
   */
  public set(chave: ConfigKey, valor: string): void {
    this.db.prepare(`
      INSERT INTO config (chave, valor) VALUES (?, ?)
      ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
    `).run(chave, valor)
  }

  /**
   * Remove uma chave do config.
   * Operação silenciosa se a chave não existir.
   */
  public delete(chave: ConfigKey): void {
    this.db.prepare('DELETE FROM config WHERE chave = ?').run(chave)
  }

  /**
   * Retorna todas as entradas do config como um objecto chave→valor.
   */
  public getAll(): Record<string, string> {
    const rows = this.db
      .prepare('SELECT chave, valor FROM config')
      .all() as ConfigRow[]

    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.chave] = row.valor
      return acc
    }, {})
  }
}
