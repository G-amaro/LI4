/**
 * services/transferencias.ts — chamadas aos endpoints do backoffice
 * para o relatório de transferências entre lojas.
 *
 * Adapta o caminho do `api` consoante a tua estrutura actual de services.
 */

import { api } from './api'  // ou onde tens a tua instância axios configurada

// ─── Tipos ─────────────────────────────────────────────────────────

export interface TransferenciaRelatorio {
  envioId:             string
  dataEnvio:           string
  lojaOrigemId:        number
  lojaOrigemNome:      string
  lojaDestinoId:       number
  lojaDestinoNome:     string
  documentoReferencia: string | null
  numeroLinhas:        number
  unidadesEnviadas:    number
  status:              'EmTransito' | 'Recebida' | 'Divergencia'
  rececaoId:           string | null
  dataRececao:         string | null
  unidadesRecebidas:   number | null
  diferencaUnidades:   number
}

export interface TransferenciasKpis {
  total:           number
  emTransito:      number
  recebidas:       number
  comDivergencia:  number
  unidadesTotais:  number
}

export interface TransferenciaLinhaComparativa {
  produtoId:          number
  ean:                string
  artigo:             string
  categoria:          string
  quantidadeEnviada:  number
  quantidadeRecebida: number | null
  diferenca:          number
}

export interface TransferenciaDetalhe {
  envioId:             string
  dataEnvio:           string
  lojaOrigemNome:      string
  lojaDestinoNome:     string
  operadorEnvioNome:   string | null
  documentoReferencia: string | null
  observacoesEnvio:    string | null

  rececaoId:           string | null
  dataRececao:         string | null
  operadorRececaoNome: string | null
  observacoesRececao:  string | null

  status:              'EmTransito' | 'Recebida' | 'Divergencia'
  linhas:              TransferenciaLinhaComparativa[]
}

// ─── Filtros ───────────────────────────────────────────────────────

export interface FiltrosTransferencias {
  dataInicio?:    string  // ISO date 'YYYY-MM-DD'
  dataFim?:       string
  lojaOrigemId?:  number
  lojaDestinoId?: number
  status?:        'Todos' | 'EmTransito' | 'Recebida' | 'Divergencia'
}

// ─── Endpoints ─────────────────────────────────────────────────────

export async function listarTransferencias(
  f: FiltrosTransferencias = {}
): Promise<TransferenciaRelatorio[]> {
  const r = await api.get<TransferenciaRelatorio[]>('/api/relatorios/transferencias', {
    params: {
      dataInicio:    f.dataInicio,
      dataFim:       f.dataFim,
      lojaOrigemId:  f.lojaOrigemId,
      lojaDestinoId: f.lojaDestinoId,
      status:        f.status
    }
  })
  return r.data
}

export async function obterKpisTransferencias(
  f: Pick<FiltrosTransferencias, 'dataInicio' | 'dataFim'> = {}
): Promise<TransferenciasKpis> {
  const r = await api.get<TransferenciasKpis>('/api/relatorios/transferencias/kpis', {
    params: { dataInicio: f.dataInicio, dataFim: f.dataFim }
  })
  return r.data
}

export async function obterDetalheTransferencia(
  envioId: string
): Promise<TransferenciaDetalhe> {
  const r = await api.get<TransferenciaDetalhe>(`/api/relatorios/transferencias/${envioId}`)
  return r.data
}
