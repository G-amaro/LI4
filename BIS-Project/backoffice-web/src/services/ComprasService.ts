/**
 * ComprasService — listagem de receções com fornecedor + custo.
 * Fase 4.3 — Backoffice.
 */

import { api } from './api'

// ─── Tipos ─────────────────────────────────────────────────────────

export interface LinhaCompra {
  produtoId:   number
  ean:         string
  artigo:      string
  categoria:   string
  quantidade:  number
  precoCusto:  number
  subtotal:    number
  lote:        string | null
  dataValidade: string | null
}

export interface Compra {
  id:                   string
  dataRececao:          string
  documentoReferencia:  string | null
  lojaId:               number
  lojaNome:             string
  operadorNome:         string
  fornecedorId:         number | null
  fornecedorNome:       string | null
  numeroLinhas:         number
  totalUnidades:        number
  custoTotal:           number
  linhas:               LinhaCompra[]
}

export interface ComprasKpis {
  totalGastoMes:    number
  numRececoesMes:   number
  fornecedorTopNome: string | null
  fornecedorTopGasto: number
}

export interface ComprasFiltros {
  lojaId?:       number
  fornecedorId?: number
  de?:           string   // ISO date
  ate?:          string   // ISO date
}

// ─── Service ───────────────────────────────────────────────────────

export const ComprasService = {

  async listar(filtros: ComprasFiltros = {}): Promise<Compra[]> {
    const params = new URLSearchParams()
    if (filtros.lojaId)       params.set('lojaId',       String(filtros.lojaId))
    if (filtros.fornecedorId) params.set('fornecedorId', String(filtros.fornecedorId))
    if (filtros.de)            params.set('de',           filtros.de)
    if (filtros.ate)           params.set('ate',          filtros.ate)
    const query = params.toString() ? `?${params}` : ''
    const r = await api.get<Compra[]>(`/api/compras${query}`)
    return r.data
  },

  async kpis(): Promise<ComprasKpis> {
    const r = await api.get<ComprasKpis>('/api/compras/kpis')
    return r.data
  }
}
