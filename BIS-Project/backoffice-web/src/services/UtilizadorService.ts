/**
 * UtilizadorService — wrapper das chamadas ao endpoint /api/utilizadores.
 */

import axios from 'axios'
import { api } from './api'
import type { Utilizador, CriarUtilizadorInput } from '../types/utilizador'

export class UtilizadorService {
  /** Lista todos os utilizadores do sistema. */
  static async listar(): Promise<Utilizador[]> {
    try {
      const response = await api.get<Utilizador[]>('/api/utilizadores')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter a lista de utilizadores.')
    }
  }

  /** Cria um novo utilizador. */
  static async criar(input: CriarUtilizadorInput): Promise<Utilizador> {
    try {
      // O backend espera o enum como número (PerfilUtilizador),
      // mas aceita também o nome da string — enviamos a string para clareza
      const response = await api.post<Utilizador>('/api/utilizadores', input)
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao criar utilizador.')
    }
  }

  /**
   * Kill Switch — alterna o estado Ativo ↔ Inativo.
   * @returns Utilizador com o novo estado
   */
  static async toggleStatus(id: number): Promise<Utilizador> {
    try {
      const response = await api.put<Utilizador>(`/api/utilizadores/${id}/toggle-status`)
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao alterar estado do utilizador.')
    }
  }
}

function traduzirErro(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return new Error('API da Sede inacessível. Verifique se o backend está a correr.')
    }

    const backendMsg = error.response?.data?.message
    if (backendMsg) return new Error(backendMsg)

    if (error.response?.status === 409) {
      return new Error('Conflito — o NIF ou email já existem no sistema.')
    }
    if (error.response?.status === 404) {
      return new Error('Utilizador não encontrado.')
    }
    if (error.response?.status === 400) {
      const errors = error.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const firstField = Object.values(errors)[0]
        if (Array.isArray(firstField) && firstField.length > 0) {
          return new Error(firstField[0] as string)
        }
      }
      return new Error('Dados inválidos.')
    }
  }
  return new Error(fallback)
}
