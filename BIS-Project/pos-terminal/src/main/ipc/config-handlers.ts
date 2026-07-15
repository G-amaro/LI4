import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { ok, fail } from '../../shared/types'
import type { ConfigKey, Result } from '../../shared/types'

// 1. Importamos o novo DAO
import { ConfigDAO } from '../data/ConfigDAO'

export function registerConfigHandlers(): void {
  // 2. Instanciamos a classe
  const configDAO = new ConfigDAO()

  ipcMain.handle(IpcChannels.ConfigGet, async (_evt, chave: ConfigKey): Promise<Result<string | null>> => {
    try {
      return ok(configDAO.get(chave))
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.ConfigSet, async (_evt, chave: ConfigKey, valor: string): Promise<Result<void>> => {
    try {
      configDAO.set(chave, valor)
      return ok(undefined)
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.ConfigDelete, async (_evt, chave: ConfigKey): Promise<Result<void>> => {
    try {
      configDAO.delete(chave)
      return ok(undefined)
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.ConfigGetAll, async (): Promise<Result<Record<string, string>>> => {
    try {
      return ok(configDAO.getAll())
    } catch (err) {
      return fail((err as Error).message)
    }
  })
}