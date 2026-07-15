import axios from 'axios'
import { api } from './api'
import type { DashboardResumo } from '../types/dashboard'

export class DashboardService {
  static async obterResumo(): Promise<DashboardResumo> {
    try {
      const response = await api.get<DashboardResumo>('/api/dashboard/resumo')
      return response.data   // corrigido: era [response.data]
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          throw new Error('API da Sede inacessível. Verifique se o backend está a correr.')
        }
        if (error.response?.status === 401) throw new Error('Sessão expirada. Faça login novamente.')
        if (error.response?.status === 403) throw new Error('Sem permissão para aceder ao Dashboard.')
      }
      throw new Error('Erro inesperado ao obter o resumo do Dashboard.')
    }
  }
}
