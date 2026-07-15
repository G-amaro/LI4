/**
 * Vendas Controller — ponte IPC entre o Renderer e a VendaFacade.
 *
 * Responsabilidade exclusiva: receber eventos IPC e delegar à Facade.
 * Não contém lógica de negócio nem acesso directo a dados.
 *
 * Correspondência arquitectural:
 *   Renderer → IPC → [este ficheiro] → IVendaFacade → VendaFacade
 */

import { ipcMain }     from 'electron'
import { VendaFacade } from '../business/VendaFacade'
import { IpcChannels } from '../../shared/ipc-channels'
import type { IVendaFacade } from '../business/interfaces/IVendaFacade'
import type { SyncStatus, VendaInput } from '../../shared/types'

export function registerVendasHandlers(): void {
  const facade: IVendaFacade = new VendaFacade()

  ipcMain.handle(IpcChannels.VendasCriar,           (_evt, input: VendaInput)   => facade.registarNovaVenda(input))
  ipcMain.handle(IpcChannels.VendasContarPorStatus, (_evt, status: SyncStatus)  => facade.contarPorStatus(status))
  ipcMain.handle(IpcChannels.VendasListarRecentes,  (_evt, limite: number)      => facade.listarRecentes(limite))
}
