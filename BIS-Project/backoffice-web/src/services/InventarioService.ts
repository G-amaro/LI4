/**
 * services/inventario.ts — chamadas ao endpoint /api/inventario
 *
 * Substitui o teu service actual que estava a usar mock determinístico.
 * O endpoint do backend agora calcula o stock real a partir das tabelas.
 *
 * IMPORTANTE: Adapta o import do `api` ao padrão da tua casa
 * (vê outros services como relatorios.ts).
 */

import axios from 'axios'
import { api } from './api'

// ─── Tipos ─────────────────────────────────────────────────────────

export interface InventarioLoja {
  id:   number
  nome: string
}

export interface InventarioArtigo {
  id:           number
  ean:          string
  artigo:       string
  categoria:    string
  total:        number
  minimoGlobal: number
  estado:       'Critico' | 'Alerta' | 'OK'
  stockPorLoja: Record<number, number>   // lojaId → quantidade
}

export interface InventarioKpis {
  totalArtigos: number
  criticos:     number
  alertas:      number
  ok:           number
}

export interface InventarioConsolidado {
  lojas:      InventarioLoja[]
  artigos:    InventarioArtigo[]
  kpis:       InventarioKpis
  syncStatus: Record<number, string | null>   // lojaId → ISO date ou null
  geradoEm:   string
}

export type EstadoValidade = 'Vencido' | 'Critico' | 'Alerta' | 'OK' | 'SemValidade'
 
export interface RecepcaoLote {
  rececaoId:       string
  dataRececao:     string
  lote:            string | null
  dataValidade:    string | null
  quantidade:      number
  lojaId:          number
  lojaNome:        string
  documento:       string | null
  operadorNome:    string | null
  estadoValidade:  EstadoValidade
  diasAteExpirar:  number | null
}
 
export interface LotesProduto {
  produtoId:     number
  ean:           string
  artigo:        string
  categoria:     string
  perecivel:     boolean
  recepcoes:     RecepcaoLote[]
  totalRecebido: number
  numRecepcoes:  number
}
// ─── Service ───────────────────────────────────────────────────────

export class InventarioService {
  static async obterInventario(): Promise<InventarioConsolidado> {
    try {
      const response = await api.get<InventarioConsolidado>('/api/inventario')
      return response.data
    } catch (error) {
      throw traduzirErro(error, 'Erro ao obter inventário consolidado.')
    }
  }
  static async obterLotesProduto(produtoId: number): Promise<LotesProduto> {
  try {
    const response = await api.get<LotesProduto>(`/api/inventario/lotes/${produtoId}`)
    return response.data
  } catch (error) {
    throw traduzirErro(error, 'Erro ao obter lotes do produto.')
  }
}
}

// ─── Helpers ───────────────────────────────────────────────────────

function traduzirErro(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return new Error('API da Sede inacessível. Verifique se o backend está a correr.')
    }
    if (error.response?.status === 401) return new Error('Sessão expirada.')
    if (error.response?.status === 403) return new Error('Sem permissão para aceder ao inventário.')
  }
  return new Error(fallback)
}

/**
 * Helper utilitário — formata "há X minutos / horas / dias" a partir
 * de um timestamp ISO. Usado no rodapé da página para mostrar quando
 * cada loja sincronizou pela última vez.
 */
export function formatarTempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca'

  const data    = new Date(iso)
  const agora   = new Date()
  const diffMs  = agora.getTime() - data.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1)    return 'agora mesmo'
  if (diffMin < 60)   return `há ${diffMin} min`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)    return `há ${diffHr}h`

  const diffDias = Math.floor(diffHr / 24)
  return `há ${diffDias} dia${diffDias === 1 ? '' : 's'}`
}
