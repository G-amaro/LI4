/**
 * IPC handlers para canal "fornecedores:*" — Fase 4.
 *
 * Controller fino — delega tudo na FornecedorFacade.
 */

import { ipcMain } from 'electron'
import type { IFornecedorFacade } from '../business/interfaces/IFornecedorFacade'

export function registarFornecedoresIpc(facade: IFornecedorFacade): void {

  ipcMain.handle('fornecedores:listar', async () => {
    return facade.listar()
  })

  ipcMain.handle('fornecedores:porId', async (_e, id: number) => {
    return facade.porId(id)
  })

  ipcMain.handle('fornecedores:contar', async () => {
    return facade.contar()
  })

  ipcMain.handle('fornecedores:sync', async () => {
    return facade.sincronizar()
  })

  console.log('[IPC] Handlers de fornecedores registados.')
}
