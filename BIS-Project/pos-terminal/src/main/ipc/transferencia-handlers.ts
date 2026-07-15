/**
 * Transferência Controller — ponte IPC entre Renderer e TransferenciaFacade.
 */

import { ipcMain }              from 'electron'
import { TransferenciaFacade }  from '../business/TransferenciaFacade'
import { IpcChannels }          from '../../shared/ipc-channels'
import type { ITransferenciaFacade }      from '../business/interfaces/ITransferenciaFacade'
import type { EnvioInput, RececaoTransferenciaInput } from '../../shared/types'

export function registerTransferenciaHandlers(): void {
  const facade: ITransferenciaFacade = new TransferenciaFacade()

  ipcMain.handle(IpcChannels.TransferenciasRegistarEnvio, (_evt, input: EnvioInput) =>
    facade.registarEnvio(input)
  )

  ipcMain.handle(IpcChannels.TransferenciasObterGuia, (_evt, id: string) =>
    facade.obterGuia(id)
  )

  ipcMain.handle(IpcChannels.TransferenciasRegistarRececao, (_evt, input: RececaoTransferenciaInput) =>
    facade.registarRececao(input)
  )

  ipcMain.handle(IpcChannels.TransferenciasListarLojas, () =>
    facade.listarLojas()
  )

  ipcMain.handle(IpcChannels.TransferenciasSincronizarGuias, () =>
  facade.sincronizarGuiasPendentes()
  )
  ipcMain.handle(IpcChannels.TransferenciasListarGuiasPendentes, () =>
  facade.listarGuiasPendentes()
  )
}
