import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '../shared/ipc-channels'
import type {
  BisApi,
  ProdutoLocal,
  ConfigKey,
  LoginPosInput,
  VendaInput,
  SyncStatus,
  QuebraInput,
  SyncWorkerStatus,
  FechoInput,
  DevolucaoInput,
  RececaoInput,
  EnvioInput,
  RececaoTransferenciaInput
} from '../shared/types'

const api: BisApi = {
  config: {
    get:    (chave: ConfigKey)                => ipcRenderer.invoke(IpcChannels.ConfigGet, chave),
    set:    (chave: ConfigKey, valor: string) => ipcRenderer.invoke(IpcChannels.ConfigSet, chave, valor),
    delete: (chave: ConfigKey)                => ipcRenderer.invoke(IpcChannels.ConfigDelete, chave),
    getAll: ()                                => ipcRenderer.invoke(IpcChannels.ConfigGetAll)
  },
  catalogo: {
    listar:     ()                         => ipcRenderer.invoke(IpcChannels.CatalogoListar),
    porEan:     (ean: string)              => ipcRenderer.invoke(IpcChannels.CatalogoPorEan, ean),
    porId:      (id: number)               => ipcRenderer.invoke(IpcChannels.CatalogoPorId, id),
    pesquisar:  (termo: string)            => ipcRenderer.invoke(IpcChannels.CatalogoPesquisar, termo),
    upsertMany: (produtos: ProdutoLocal[]) => ipcRenderer.invoke(IpcChannels.CatalogoUpsertMany, produtos),
    contar:     ()                         => ipcRenderer.invoke(IpcChannels.CatalogoContar),
    sync:       ()                         => ipcRenderer.invoke(IpcChannels.CatalogoSync)
  },
  fornecedores: {
    listar:  ()             => ipcRenderer.invoke(IpcChannels.FornecedoresListar),
    porId:   (id: number)   => ipcRenderer.invoke(IpcChannels.FornecedoresPorId, id),
    contar:  ()             => ipcRenderer.invoke(IpcChannels.FornecedoresContar),
    sync:    ()             => ipcRenderer.invoke(IpcChannels.FornecedoresSync)
  },
  // [+ Stock lookup]
  stock: {
    porProduto: (produtoId: number) => ipcRenderer.invoke(IpcChannels.StockPorProduto, produtoId),
    batch:      (ids: number[])     => ipcRenderer.invoke(IpcChannels.StockBatch, ids)
  },
  auth: {
    loginPos:    (input: LoginPosInput) => ipcRenderer.invoke(IpcChannels.AuthLoginPos, input),
    logout:      ()                     => ipcRenderer.invoke(IpcChannels.AuthLogout),
    sessaoAtual: ()                     => ipcRenderer.invoke(IpcChannels.AuthSessaoAtual)
  },
  vendas: {
    criar:           (input: VendaInput)  => ipcRenderer.invoke(IpcChannels.VendasCriar, input),
    contarPorStatus: (status: SyncStatus) => ipcRenderer.invoke(IpcChannels.VendasContarPorStatus, status),
    listarRecentes:  (limite: number)     => ipcRenderer.invoke(IpcChannels.VendasListarRecentes, limite)
  },
  quebras: {
    registar: (input: QuebraInput) => ipcRenderer.invoke(IpcChannels.QuebrasRegistar, input)
  },
  sync: {
    getStatus: () => ipcRenderer.invoke(IpcChannels.SyncGetStatus),
    forcar:    () => ipcRenderer.invoke(IpcChannels.SyncForcar),
    onStatusChanged: (callback: (status: SyncWorkerStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: SyncWorkerStatus): void => {
        callback(status)
      }
      ipcRenderer.on(IpcChannels.SyncStatusChanged, listener)
      return () => {
        ipcRenderer.removeListener(IpcChannels.SyncStatusChanged, listener)
      }
    }
  },
  fecho: {
    calcularTeorico: () => ipcRenderer.invoke(IpcChannels.FechoCalcularTeorico),
    registar: (input: FechoInput) => ipcRenderer.invoke(IpcChannels.FechoRegistar, input)
  },
  devolucoes: {
    obterVenda: (vendaId: string) =>
      ipcRenderer.invoke(IpcChannels.DevolucoesObterVenda, vendaId),
    registar: (input: DevolucaoInput) =>
      ipcRenderer.invoke(IpcChannels.DevolucoesRegistar, input)
  },
  rececoes: {
    registar: (input: RececaoInput) =>
      ipcRenderer.invoke(IpcChannels.RececoesRegistar, input)
  },
  transferencias: {
    registarEnvio:   (input: EnvioInput) =>
      ipcRenderer.invoke(IpcChannels.TransferenciasRegistarEnvio, input),
    obterGuia:       (id: string) =>
      ipcRenderer.invoke(IpcChannels.TransferenciasObterGuia, id),
    registarRececao: (input: RececaoTransferenciaInput) =>
      ipcRenderer.invoke(IpcChannels.TransferenciasRegistarRececao, input),
    listarLojas:     () =>
      ipcRenderer.invoke(IpcChannels.TransferenciasListarLojas),
    sincronizarGuias: () =>
      ipcRenderer.invoke(IpcChannels.TransferenciasSincronizarGuias),
    listarGuiasPendentes: () =>
      ipcRenderer.invoke(IpcChannels.TransferenciasListarGuiasPendentes)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[Preload] Erro ao expor APIs:', error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
