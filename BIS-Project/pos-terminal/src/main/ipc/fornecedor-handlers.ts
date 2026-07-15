/**
 * Fornecedor Controller — ponte IPC entre Renderer e FornecedorFacade.
 * Fase 4: fornecedores read-only no POS (criação/edição só no backoffice).
 */

import { ipcMain }          from 'electron'
import { FornecedorFacade } from '../business/FornecedorFacade'
import { FornecedorDAO }    from '../data/FornecedorDAO'
import { ConfigDAO }        from '../data/ConfigDAO'
import { getDb }            from '../database/connection'
import { IpcChannels }      from '../../shared/ipc-channels'

export function registerFornecedoresHandlers(): void {
  const db       = getDb()
  const dao      = new FornecedorDAO(db)
  const configDAO = new ConfigDAO()
  const facade   = new FornecedorFacade(dao, configDAO)

  ipcMain.handle(IpcChannels.FornecedoresListar, () =>
    facade.listar()
  )

  ipcMain.handle(IpcChannels.FornecedoresPorId, (_evt, id: number) =>
    facade.porId(id)
  )

  ipcMain.handle(IpcChannels.FornecedoresContar, () =>
    facade.contar()
  )

  ipcMain.handle(IpcChannels.FornecedoresSync, () =>
    facade.sincronizar()
  )
}
