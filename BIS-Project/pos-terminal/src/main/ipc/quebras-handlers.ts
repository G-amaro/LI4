/**
 * Quebras Controller — ponte IPC entre o Renderer e a QuebraFacade.
 * Responsabilidade exclusiva: receber o evento IPC e delegar à Facade.
 */

import { ipcMain }      from 'electron'
import { QuebraFacade } from '../business/QuebraFacade'
import { IpcChannels }  from '../../shared/ipc-channels'
import type { IQuebraFacade } from '../business/interfaces/IQuebraFacade'
import type { QuebraInput }   from '../../shared/types'

export function registerQuebrasHandlers(): void {
  const facade: IQuebraFacade = new QuebraFacade()

  ipcMain.handle(IpcChannels.QuebrasRegistar, (_evt, input: QuebraInput) =>
    facade.registarQuebra(input)
  )
}
