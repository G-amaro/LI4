/**
 * ApiClient — Wrapper HTTP para comunicação com o BIS.Api (Sede).
 *
 * Responsabilidades:
 *   - Singleton com base URL lido do ConfigDAO
 *   - Injeta JWT automaticamente em todas as requests (interceptor Axios)
 *   - Timeout curto (5s) para operações simples, maior (15s) para batches
 *   - Erros HTTP convertidos em mensagens legíveis em português
 *
 * Não faz retry — essa responsabilidade é do SyncWorker (backoff externo).
 *
 * Correspondência arquitectural:
 *   Camada de Serviços → ApiClient (comunicação externa com a Sede)
 */

import axios from 'axios'
import type { AxiosInstance, AxiosError } from 'axios'
import { ConfigDAO } from '../data/ConfigDAO'
import type { VendaCompleta } from '../../shared/types'
import type {FechoParaSync} from '../../shared/types'
import type {QuebraParaSync} from '../../shared/types'
import type { FornecedorLocal } from '../../shared/types'


const DEFAULT_BASE_URL = 'http://13.48.156.89:5254' // ← porta HTTP do backend
const TIMEOUT_DEFAULT  = 5_000                   // 5s para operações simples
const TIMEOUT_BATCH    = 15_000                  // 15s para batches de sync

// ─── Tipos de resposta do BIS.Api ────────────────────────────────────

export interface BackendLoginResponse {
  token:      string
  expiresAt:  string
  utilizador: {
    id:           number
    nome:         string
    nif:          string
    email:        string | null
    perfil:       string
    lojaBaseId:   number
    lojaBaseNome: string
  }
}

export interface BackendProdutoResponse {
  id:         number
  ean:        string
  artigo:     string
  categoria:  string
  precoCusto: number
  pvp:        number
  perecivel:  boolean
  taxaIVA:    number
  imagemUrl?: string | null
}

export interface BackendSyncResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}
export interface DevolucaoParaSync {
  id:               string
  vendaOriginalId:  string
  operadorId:       number
  dataDevolucao:    string
  valorReembolsado: number
  motivo:           string | null
  linhas: Array<{
    produtoId:     number
    quantidade:    number
    precoUnitario: number
    subtotal:      number
  }>
}

// Tipo de resposta:

export interface BackendSyncDevolucoesResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}

export interface RececaoParaSync {
  id:                   string
  operadorId:           number
  dataRececao:          string
  documentoReferencia:  string | null
  linhas: Array<{
    produtoId:  number
    quantidade: number
    lote:         string | null
    dataValidade: string | null
  }>
}

export interface BackendSyncRececoesResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}

// ─── Classe ──────────────────────────────────────────────────────────

export class ApiClient {
  private instance:       AxiosInstance | null = null
  private currentBaseUrl: string | null = null

  private readonly configDAO: ConfigDAO

  constructor() {
    this.configDAO = new ConfigDAO()
  }

  // ─── Gestão da instância Axios ───────────────────────────────────

  private getAxios(): AxiosInstance {
    const baseUrl = this.configDAO.get('api_base_url') ?? DEFAULT_BASE_URL

    if (!this.instance || this.currentBaseUrl !== baseUrl) {
      this.instance = axios.create({
        baseURL: baseUrl,
        timeout: TIMEOUT_DEFAULT,
        headers: { 'Content-Type': 'application/json' }
      })

      // Interceptor: injeta JWT automaticamente
      this.instance.interceptors.request.use((config) => {
        const token = this.configDAO.get('jwt_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      })

      this.currentBaseUrl = baseUrl
      console.log(`[ApiClient] Base URL: ${baseUrl}`)
    }

    return this.instance
  }

  // ─── Auth ────────────────────────────────────────────────────────

  public async loginPos(
    nif:    string,
    pin:    string,
    lojaId: number
  ): Promise<BackendLoginResponse> {
    try {
      const resp = await this.getAxios().post<BackendLoginResponse>(
        '/api/auth/pos-login',
        { nif, pin, lojaId }
      )
      return resp.data
    } catch (err) {
      throw this.toReadableError(err, 'Não foi possível fazer login.')
    }
  }

  // ─── Catálogo ────────────────────────────────────────────────────

  public async getCatalogo(): Promise<BackendProdutoResponse[]> {
    try {
      const resp = await this.getAxios().get<BackendProdutoResponse[]>('/api/produtos')
      return resp.data
    } catch (err) {
      throw this.toReadableError(err, 'Falha ao descarregar catálogo.')
    }
  }

public async descarregarFornecedores(): Promise<FornecedorLocal[]> {
  try {
    const resp = await this.getAxios().get<Array<{
      id:    number
      nome:  string
      nif:   string | null
      ativo: boolean
    }>>('/api/sync/fornecedores', { timeout: TIMEOUT_BATCH })
 
    const agora = new Date().toISOString()
    return resp.data.map((f) => ({
      id:           f.id,
      nome:         f.nome,
      nif:          f.nif,
      ativo:        f.ativo,
      atualizadoEm: agora
    }))
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao descarregar fornecedores da Sede.')
  }
}

  // ─── Sync de Vendas ──────────────────────────────────────────────

  /**
   * Envia um batch de vendas pendentes para a Sede.
   *
   * O endpoint é idempotente por Guid — se a ligação cair após a Sede
   * persistir mas antes do POS receber o 200 OK, o próximo envio dos
   * mesmos Guids é ignorado na Sede (totalDuplicadas) mas contabilizado
   * como sucesso do ponto de vista do POS.
   *
   * @param lojaId ID da loja (lido do config pela SincronizacaoFacade)
   * @param vendas Lista de vendas completas (com linhas incluídas)
   */
  public async enviarVendas(
    lojaId: number,
    vendas: VendaCompleta[]
  ): Promise<BackendSyncResponse> {
    const payload = {
      lojaId,
      vendas: vendas.map((v) => ({
        id:              v.id,
        lojaId:          v.lojaId,
        operadorId:      v.operadorId,
        dataTransacao:   v.criadoEm,
        valorTotal:      v.valorTotal,
        metodoPagamento: v.metodoPagamento,
        nifCliente:      v.nifCliente,
        linhas: v.linhas.map((l) => ({
          produtoId:     l.produtoId,
          quantidade:    l.quantidade,
          precoUnitario: l.precoUnitario,
          subtotal:      l.subtotal
        }))
      }))
    }

    try {
      const resp = await this.getAxios().post<BackendSyncResponse>(
        '/api/sync/vendas',
        payload,
        { timeout: TIMEOUT_BATCH }   // override: batches precisam de mais tempo
      )
      return resp.data
    } catch (err) {
      throw this.toReadableError(err, 'Falha ao sincronizar vendas com a Sede.')
    }
  }

  // ─── Ping ────────────────────────────────────────────────────────

  /** Teste rápido de conectividade (2s timeout). */
  public async ping(): Promise<boolean> {
    try {
      await this.getAxios().get('/api/produtos', { timeout: 2_000 })
      return true
    } catch {
      return false
    }
  }

  // ─── Helper ──────────────────────────────────────────────────────

  private toReadableError(err: unknown, fallback: string): Error {
    if (axios.isAxiosError(err)) {
      const axErr = err as AxiosError<{ message?: string }>

      if (axErr.code === 'ECONNABORTED' || axErr.code === 'ERR_NETWORK') {
        return new Error('Sede inacessível — verifique a ligação à rede.')
      }

      const status     = axErr.response?.status
      const backendMsg = axErr.response?.data?.message

      if (status === 401) return new Error(backendMsg ?? 'Sessão expirada. Faça login novamente.')
      if (status === 403) return new Error(backendMsg ?? 'Sem permissão.')
      if (status === 400) return new Error(backendMsg ?? 'Dados inválidos.')
      if (backendMsg)     return new Error(backendMsg)

      return new Error(`${fallback} (HTTP ${status ?? '?'})`)
    }
    return new Error(fallback)
  }

  public async enviarQuebras(
  lojaId:  number,
  quebras: QuebraParaSync[]
  ): Promise<BackendSyncQuebrasResponse> {
  const payload = {
    lojaId,
    quebras: quebras.map((q) => ({
      id:          q.id,
      lojaId:      q.lojaId,
      operadorId:  q.operadorId,
      produtoId:   q.produtoId,
      quantidade:  q.quantidade,
      valorPerdido: q.valorPerdido,
      motivo:      q.motivo,
      dataRegisto: q.dataRegisto
    }))
  }
 
  try {
    const resp = await this.getAxios().post<BackendSyncQuebrasResponse>(
      '/api/sync/quebras',
      payload,
      { timeout: TIMEOUT_BATCH }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao sincronizar quebras com a Sede.')
  }
  }
 
  public async enviarFechos(
  lojaId: number,
  fechos: FechoParaSync[]
  ): Promise<BackendSyncFechosResponse> {
  const payload = {
    lojaId,
    fechos: fechos.map((f) => ({
      id:                f.id,
      lojaId:            f.lojaId,
      operadorId:        f.operadorId,
      dataFecho:         f.dataFecho,
      teoricoNumerario:  f.teoricoNumerario,
      teoricoMultibanco: f.teoricoMultibanco,
      teoricoMbway:      f.teoricoMbway,
      teoricoTotal:      f.teoricoTotal,
      contadoNumerario:  f.contadoNumerario,
      contadoMultibanco: f.contadoMultibanco,
      contadoMbway:      f.contadoMbway,
      contadoTotal:      f.contadoTotal,
      discrepancia:      f.discrepancia,
      temDiscrepancia:   f.temDiscrepancia,
      justificacao:      f.justificacao
    }))
  }
 
  try {
    const resp = await this.getAxios().post<BackendSyncFechosResponse>(
      '/api/sync/fechos',
      payload,
      { timeout: TIMEOUT_BATCH }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao sincronizar fechos de caixa com a Sede.')
  }
  }

  /**
 * Envia lote de transferências (envios e/ou recepções) para a Sede.
 * Idempotência por GUID — podes enviar 2x o mesmo ID sem efeitos colaterais.
 */
public async enviarTransferencias(
  lojaId:          number,
  transferencias:  TransferenciaParaSync[]
): Promise<BackendSyncTransferenciasResponse> {
  const payload = {
    lojaId,
    transferencias: transferencias.map((t) => ({
      id:                   t.id,
      tipoMovimento:        t.tipoMovimento,
      lojaOrigemId:         t.lojaOrigemId,
      lojaDestinoId:        t.lojaDestinoId,
      operadorId:           t.operadorId,
      dataMovimento:        t.dataMovimento,
      transferenciaEnvioId: t.transferenciaEnvioId,
      documentoReferencia:  t.documentoReferencia,
      observacoes:          t.observacoes,
      linhas:               t.linhas
    }))
  }
 
  try {
    const resp = await this.getAxios().post<BackendSyncTransferenciasResponse>(
      '/api/sync/transferencias',
      payload,
      { timeout: TIMEOUT_BATCH }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao sincronizar transferências com a Sede.')
  }
}
 
/**
 * Obtém da Sede as guias de ENVIO destinadas a esta loja que ainda
 * não foram recebidas. Usado para popular o SQLite local e permitir
 * registo de recepção offline.
 *
 * @param lojaDestinoId — sempre a loja actual (a do JWT)
 * @returns lista (pode ser vazia se não há guias em trânsito)
 */
public async obterTransferenciasPendentes(
  lojaDestinoId: number
): Promise<GuiaPendenteDaSede[]> {
  try {
    const resp = await this.getAxios().get<GuiaPendenteDaSede[]>(
      '/api/sync/transferencias/pendentes',
      {
        params:  { lojaDestinoId },
        timeout: TIMEOUT_BATCH
      }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao obter transferências pendentes.')
  }
}

  public async enviarDevolucoes(
  lojaId:      number,
  devolucoes:  DevolucaoParaSync[]
): Promise<BackendSyncDevolucoesResponse> {
  const payload = { lojaId, devolucoes }
  try {
    const resp = await this.getAxios().post<BackendSyncDevolucoesResponse>(
      '/api/sync/devolucoes',
      payload,
      { timeout: TIMEOUT_BATCH }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao sincronizar devoluções com a Sede.')
  }
}
  public async enviarRececoes(
  lojaId:    number,
  rececoes:  RececaoParaSync[]
): Promise<BackendSyncRececoesResponse> {
  const payload = { lojaId, rececoes }
  try {
    const resp = await this.getAxios().post<BackendSyncRececoesResponse>(
      '/api/sync/rececoes',
      payload,
      { timeout: TIMEOUT_BATCH }
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao sincronizar receções com a Sede.')
  }
}

  public async descarregarStock(lojaId: number): Promise<Array<{ produtoId: number; quantidade: number }>> {
  try {
    const resp = await this.getAxios().get<Array<{ produtoId: number; quantidade: number }>>(
      `/api/sync/stock?lojaId=${lojaId}`
    )
    return resp.data
  } catch (err) {
    throw this.toReadableError(err, 'Falha ao descarregar stock da Sede.')
  }
}

}

// ─── Tipos de payload (adicionar junto a QuebraParaSync, FechoParaSync) ──
 
export interface TransferenciaParaSync {
  id:                    string
  tipoMovimento:         'Envio' | 'Rececao'    // bate certo com o enum C# em JSON
  lojaOrigemId:          number
  lojaDestinoId:         number
  operadorId:            number
  dataMovimento:         string                   // ISO-8601
  transferenciaEnvioId:  string | null            // null em ENVIO, preenchido em RECECAO
  documentoReferencia:   string | null
  observacoes:           string | null
  linhas: Array<{
    produtoId:  number
    quantidade: number
  }>
}
 
// ─── Tipos de resposta ───────────────────────────────────────────────
 
export interface BackendSyncTransferenciasResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}
 
export interface GuiaPendenteDaSede {
  id:                  string
  lojaOrigemId:        number
  lojaOrigemNome:      string
  lojaDestinoId:       number
  dataMovimento:       string
  documentoReferencia: string | null
  observacoes:         string | null
  linhas: Array<{
    produtoId:  number
    ean:        string
    artigo:     string
    categoria:  string
    quantidade: number
  }>
}
 

export interface BackendSyncQuebrasResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}
 
export interface BackendSyncFechosResponse {
  processadoEm:    string
  totalRecebidas:  number
  totalInseridas:  number
  totalDuplicadas: number
  erros:           Array<{ vendaId: string; motivo: string }>
  sucesso:         boolean
}


// Singleton exportado — toda a aplicação partilha esta instância
export const apiClient = new ApiClient()

