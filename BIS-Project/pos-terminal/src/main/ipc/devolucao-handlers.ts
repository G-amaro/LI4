/**
 * Devolução Controller — ponte IPC entre Renderer e DevolucaoFacade.
 * Responsabilidade exclusiva: receber eventos IPC e delegar à Facade.
 */

import { ipcMain }         from 'electron'
import { DevolucaoFacade } from '../business/DevolucaoFacade'
import { IpcChannels }     from '../../shared/ipc-channels'
import type { IDevolucaoFacade } from '../business/interfaces/IDevolucaoFacade'
import type { DevolucaoInput }   from '../../shared/types'

export function registerDevolucaoHandlers(): void {
  const facade: IDevolucaoFacade = new DevolucaoFacade()

  ipcMain.handle(IpcChannels.DevolucoesObterVenda, (_evt, vendaId: string) =>
    facade.obterVendaPorId(vendaId)
  )

  ipcMain.handle(IpcChannels.DevolucoesRegistar, (_evt, input: DevolucaoInput) =>
    facade.registarDevolucao(input)
  )
}
