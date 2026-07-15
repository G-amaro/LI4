/**
 * Conexão singleton ao SQLite local.
 *
 * Guarda o ficheiro .db na pasta userData do Electron (cross-platform),
 * que por defeito é:
 *   - Windows: %APPDATA%/pos-terminal/
 *   - Linux:   ~/.config/pos-terminal/
 *   - macOS:   ~/Library/Application Support/pos-terminal/
 *
 * Chamar getDb() cria o ficheiro e aplica o schema no primeiro acesso.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { applySchema } from './schema'

let dbInstance: Database.Database | null = null

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance

  const userDataDir = app.getPath('userData')
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }

  const dbPath = path.join(userDataDir, 'bis-pos.db')
  console.log('[DB] A abrir SQLite em:', dbPath)

  dbInstance = new BetterSqlite3(dbPath)
  applySchema(dbInstance)

  return dbInstance
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
