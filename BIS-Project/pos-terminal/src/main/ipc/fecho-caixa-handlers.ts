/**
 * Fecho de Caixa Controller — ponte IPC entre o Renderer e a FechoCaixaFacade.
 * Responsabilidade exclusiva: receber eventos IPC e delegar à Facade.
 */

import { ipcMain }          from 'electron'
import { FechoCaixaFacade } from '../business/FechoCaixaFacade'
import { IpcChannels }      from '../../shared/ipc-channels'
import type { IFechoCaixaFacade } from '../business/interfaces/IFechoCaixaFacade'
import type { FechoInput }        from '../../shared/types'

export function registerFechoCaixaHandlers(): void {
  const facade: IFechoCaixaFacade = new FechoCaixaFacade()

  ipcMain.handle(IpcChannels.FechoCalcularTeorico, (_evt) =>
    facade.calcularTeorico()
  )

  ipcMain.handle(IpcChannels.FechoRegistar, (_evt, input: FechoInput) =>
    facade.registar(input)
  )
}
