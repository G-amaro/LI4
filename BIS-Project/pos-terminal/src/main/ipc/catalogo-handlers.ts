/**
 * Catálogo Controller — ponte IPC entre o Renderer e a CatalogoFacade.
 *
 * Responsabilidade exclusiva: receber eventos IPC e delegar à Facade.
 * Não contém lógica de negócio nem acesso directo a dados.
 */

import { ipcMain }        from 'electron'
import { CatalogoFacade } from '../business/CatalogoFacade'
import { IpcChannels }    from '../../shared/ipc-channels'
import type { ICatalogoFacade } from '../business/interfaces/ICatalogoFacade'
import type { ProdutoLocal }    from '../../shared/types'

export function registerCatalogoHandlers(): void {
  const facade: ICatalogoFacade = new CatalogoFacade()

  ipcMain.handle(IpcChannels.CatalogoListar,     (_evt)                           => facade.listar())
  ipcMain.handle(IpcChannels.CatalogoPorEan,     (_evt, ean: string)              => facade.porEan(ean))
  ipcMain.handle(IpcChannels.CatalogoPorId,      (_evt, id: number)               => facade.porId(id))
  ipcMain.handle(IpcChannels.CatalogoPesquisar,  (_evt, termo: string)            => facade.pesquisar(termo))
  ipcMain.handle(IpcChannels.CatalogoContar,     (_evt)                           => facade.contar())
  ipcMain.handle(IpcChannels.CatalogoUpsertMany, (_evt, produtos: ProdutoLocal[]) => facade.upsertMany(produtos))
  ipcMain.handle(IpcChannels.CatalogoSync,       (_evt)                           => facade.sincronizar())
}
