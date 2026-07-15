import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

interface OperadorCache {
  nif:           string
  operador_id:   number
  nome:          string
  perfil:        string
  loja_base_id:  number
  loja_base_nome: string
}

export class OperadorCacheDAO {
  constructor(private readonly db: Database.Database) {}

  guardar(nif: string, pinPlain: string, operador: Omit<OperadorCache, 'nif'>): void {
    const pinHash = bcrypt.hashSync(pinPlain, 10)
    this.db.prepare(`
      INSERT INTO operadores_cache
        (nif, pin_hash, operador_id, nome, perfil, loja_base_id, loja_base_nome, atualizado_em)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(nif) DO UPDATE SET
        pin_hash       = excluded.pin_hash,
        operador_id    = excluded.operador_id,
        nome           = excluded.nome,
        perfil         = excluded.perfil,
        loja_base_id   = excluded.loja_base_id,
        loja_base_nome = excluded.loja_base_nome,
        atualizado_em  = excluded.atualizado_em
    `).run(
      nif,
      pinHash,
      operador.operador_id,
      operador.nome,
      operador.perfil,
      operador.loja_base_id,
      operador.loja_base_nome,
      new Date().toISOString()
    )
  }

  verificar(nif: string, pinPlain: string): OperadorCache | null {
    const row = this.db.prepare(
      'SELECT * FROM operadores_cache WHERE nif = ?'
    ).get(nif) as any

    if (!row) return null
    if (!bcrypt.compareSync(pinPlain, row.pin_hash)) return null

    return {
      nif,
      operador_id:    row.operador_id,
      nome:           row.nome,
      perfil:         row.perfil,
      loja_base_id:   row.loja_base_id,
      loja_base_nome: row.loja_base_nome
    }
  }
}
