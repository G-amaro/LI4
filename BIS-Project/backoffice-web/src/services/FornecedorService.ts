/**
 * FornecedorService — CRUD de fornecedores via API REST.
 * Fase 4.3 — Backoffice.
 */

import { api } from './api'

// ─── Tipos ─────────────────────────────────────────────────────────

export interface Fornecedor {
  id:           number
  nome:         string
  nif:          string | null
  telefone:     string | null
  email:        string | null
  morada:       string | null
  observacoes:  string | null
  ativo:        boolean
  criadoEm:     string
  atualizadoEm: string
  numRececoes:  number
  totalGasto:   number
}

export interface CriarFornecedorInput {
  nome:        string
  nif?:        string
  telefone?:   string
  email?:      string
  morada?:     string
  observacoes?: string
}

export interface AtualizarFornecedorInput extends CriarFornecedorInput {
  ativo: boolean
}

// ─── Service ───────────────────────────────────────────────────────

export const FornecedorService = {

  async listar(apenasAtivos = false): Promise<Fornecedor[]> {
    const params = apenasAtivos ? '?ativo=true' : ''
    const r = await api.get<Fornecedor[]>(`/api/fornecedores${params}`)
    return r.data
  },

  async obter(id: number): Promise<Fornecedor> {
    const r = await api.get<Fornecedor>(`/api/fornecedores/${id}`)
    return r.data
  },

  async criar(input: CriarFornecedorInput): Promise<Fornecedor> {
    const r = await api.post<Fornecedor>('/api/fornecedores', input)
    return r.data
  },

  async atualizar(id: number, input: AtualizarFornecedorInput): Promise<void> {
    await api.put(`/api/fornecedores/${id}`, input)
  },

  async eliminar(id: number): Promise<void> {
    await api.delete(`/api/fornecedores/${id}`)
  }
}
