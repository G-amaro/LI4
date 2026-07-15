/**
 * RelatoriosService — wrapper das chamadas ao endpoint /api/relatorios.
 */

import axios from 'axios'
import { api } from './api'
import type {
  ResumoFinanceiro,
  FechoCaixaRelatorio,
  QuebraRelatorio
} from '../types/relatorios'

export class RelatoriosService {
  static async obterResumo(): Promise<ResumoFinanceiro> {
    try {
      const response = await api.get<ResumoFinanceiro>('/api/relatorios/resumo')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter o resumo financeiro.')
    }
  }

  static async listarFechos(): Promise<FechoCaixaRelatorio[]> {
    try {
      const response = await api.get<FechoCaixaRelatorio[]>('/api/relatorios/fechos')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter auditoria de fechos de caixa.')
    }
  }

  static async listarQuebras(): Promise<QuebraRelatorio[]> {
    try {
      const response = await api.get<QuebraRelatorio[]>('/api/relatorios/quebras')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter o relatório de quebras.')
    }
  }
}

function traduzirErro(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return new Error('API da Sede inacessível. Verifique se o backend está a correr.')
    }
    if (error.response?.status === 401) return new Error('Sessão expirada.')
    if (error.response?.status === 403) return new Error('Sem permissão para aceder aos relatórios.')
  }
  return new Error(fallback)
}
