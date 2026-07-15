/**
 * services/LojasService.ts — chamadas aos endpoints /api/lojas
 */

import axios from 'axios'
import { api } from './api'

// ─── Tipos ─────────────────────────────────────────────────────────

export interface LojaCard {
  id:                     number
  nome:                   string
  localidade:             string | null
  isSede:                 boolean
  numeroOperadores:       number
  numeroProdutosCatalogo: number
  vendasHoje:             number
  transacoesHoje:         number
  ultimaSincronizacao:    string | null
  produtosEmAlerta:       number
  produtosCriticos:       number
}

export interface LojaKpis {
  vendasHoje:         number
  transacoesHoje:     number
  vendasSemana:       number
  transacoesSemana:   number
  ticketMedio:        number
  unidadesVendidas7d: number
  quebrasUltimos7d:   number
}

export interface LojaOperador {
  id:          number
  nome:        string
  nif:         string
  perfil:      string
  estadoConta: string
  ultimoLogin: string | null
}

export interface LojaTopProduto {
  produtoId:        number
  artigo:           string
  unidadesVendidas: number
  receita:          number
}

export interface LojaStockCritico {
  produtoId: number
  artigo:    string
  categoria: string
  stock:     number
  estado:    'Critico' | 'Alerta'
}

export interface LojaActividadeDiaria {
  dia:        string    // ISO date
  vendas:     number
  transacoes: number
}

export interface LojaDetalhe {
  id:                  number
  nome:                string
  localidade:          string | null
  isSede:              boolean
  ultimaSincronizacao: string | null
  kpis:                LojaKpis
  operadores:          LojaOperador[]
  topProdutos:         LojaTopProduto[]
  stockCritico:        LojaStockCritico[]
  actividade7Dias:     LojaActividadeDiaria[]
}

// ─── Service ───────────────────────────────────────────────────────

export class LojasService {
  static async listar(): Promise<LojaCard[]> {
    try {
      const r = await api.get<LojaCard[]>('/api/lojas')
      return r.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao listar lojas.')
    }
  }

  static async obterDetalhe(id: number): Promise<LojaDetalhe> {
    try {
      const r = await api.get<LojaDetalhe>(`/api/lojas/${id}`)
      return r.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter detalhe da loja.')
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function traduzirErro(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return new Error('API da Sede inacessível.')
    }
    if (error.response?.status === 401) return new Error('Sessão expirada.')
    if (error.response?.status === 403) return new Error('Sem permissão.')
    if (error.response?.status === 404) return new Error('Loja não encontrada.')
  }
  return new Error(fallback)
}

export function formatarTempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca'

  const data    = new Date(iso)
  const agora   = new Date()
  const diffMin = Math.floor((agora.getTime() - data.getTime()) / 60_000)

  if (diffMin < 1)  return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} min`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `há ${diffHr}h`

  const diffDias = Math.floor(diffHr / 24)
  return `há ${diffDias} dia${diffDias === 1 ? '' : 's'}`
}
