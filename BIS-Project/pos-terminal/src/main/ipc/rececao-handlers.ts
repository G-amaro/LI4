/**
 * Receção Controller — ponte IPC entre Renderer e RececaoFacade.
 * Responsabilidade exclusiva: receber eventos IPC e delegar à Facade.
 */

import { ipcMain }       from 'electron'
import { RececaoFacade } from '../business/RececaoFacade'
import { IpcChannels }   from '../../shared/ipc-channels'
import type { IRececaoFacade } from '../business/interfaces/IRececaoFacade'
import type { RececaoInput }   from '../../shared/types'

export function registerRececaoHandlers(): void {
  const facade: IRececaoFacade = new RececaoFacade()

  ipcMain.handle(IpcChannels.RececoesRegistar, (_evt, input: RececaoInput) =>
    facade.registarRececao(input)
  )
}
