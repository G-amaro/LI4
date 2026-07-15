/**
 * Sync Controller — ponte IPC para o SyncWorker.
 *
 * Expõe dois handlers invokable (getStatus, forcar) e faz bridge
 * dos eventos do worker para o renderer via webContents.send().
 *
 * Recebe o SyncWorker já instanciado — não cria a sua própria instância.
 * (A composição é responsabilidade do main/index.ts)
 */

import { ipcMain, WebContents } from 'electron'
import { IpcChannels }  from '../../shared/ipc-channels'
import { ok, fail }     from '../../shared/types'
import type { SyncWorkerStatus } from '../../shared/types'
import type { SyncWorker } from '../services/SyncWorker'

export function registerSyncHandlers(
  worker: SyncWorker,
  getWebContents: () => WebContents | null
): void {
  // ─── Invokable ─────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SyncGetStatus, () => {
    try {
      return ok(worker.obterStatus())
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.SyncForcar, async () => {
    try {
      const status = await worker.forcarSync()
      return ok(status)
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  // ─── Bridge eventos do worker → renderer ──────────────────────
  worker.on('status', (status: SyncWorkerStatus) => {
    const wc = getWebContents()
    if (wc && !wc.isDestroyed()) {
      wc.send(IpcChannels.SyncStatusChanged, status)
    }
  })
}
