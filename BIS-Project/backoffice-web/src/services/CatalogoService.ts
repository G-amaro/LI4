/**
 * CatalogoService — wrapper das chamadas ao endpoint /api/catalogo.
 * Traduz respostas HTTP em tipos TypeScript e erros em mensagens legíveis.
 */

import axios from 'axios'
import { api } from './api'
import type { Produto, CriarProdutoInput } from '../types/catalogo'

export class CatalogoService {
  /** Lista todos os produtos do catálogo central. */
  static async listar(): Promise<Produto[]> {
    try {
      const response = await api.get<Produto[]>('/api/catalogo')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter o catálogo.')
    }
  }

  /** Cria um novo produto no catálogo central. */
  static async criar(input: CriarProdutoInput): Promise<Produto> {
    try {
      const response = await api.post<Produto>('/api/catalogo', input)
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao criar o produto.')
    }
  }
  static async editar(id: number, input: CriarProdutoInput): Promise<Produto> {
  try {
    const { data } = await api.put<Produto>(`/api/catalogo/${id}`, input)
    return data
  } catch (error) {
    throw traduzirErro(error, 'Erro ao actualizar o produto.')
  }
}
 
}



/** Converte erros do axios em Error com mensagem amigável. */
function traduzirErro(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return new Error('API da Sede inacessível. Verifique se o backend está a correr.')
    }
    const backendMsg = error.response?.data?.message
    if (backendMsg) return new Error(backendMsg)

    if (error.response?.status === 409) {
      return new Error('Já existe um produto com esse código EAN.')
    }
    if (error.response?.status === 400) {
      // Validação do ModelState — extrair primeiro erro
      const errors = error.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const firstField = Object.values(errors)[0]
        if (Array.isArray(firstField) && firstField.length > 0) {
          return new Error(firstField[0] as string)
        }
      }
      return new Error('Dados inválidos. Verifique os campos.')
    }
  }
  return new Error(fallback)
}
