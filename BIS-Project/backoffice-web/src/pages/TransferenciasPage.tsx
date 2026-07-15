/**
 * TransferenciasPage.tsx — Relatório de Transferências entre Lojas (UC10).
 *
 * Estrutura:
 *   - 4 KPIs no topo (Total / Em trânsito / Recebidas / Divergências)
 *   - Filtros: data (botões rápidos + date pickers), loja origem, destino, status
 *   - Tabela de envios com linha clicável → modal de detalhe
 */

import { useEffect, useMemo, useState } from 'react'
import {
  listarTransferencias,
  obterKpisTransferencias
} from '../services/transferencias'
import type {
  TransferenciaRelatorio,
  TransferenciasKpis,
  FiltrosTransferencias
} from '../services/transferencias'
import { TransferenciaDetalheModal } from '../components/TransferenciaDetalheModal'

// Mock — substitui pelo service real do teu projecto que lista lojas
// (ou hardcoded coerente com o seed da Sede)
const LOJAS = [
  { id: 1, nome: 'Sede' },
  { id: 2, nome: 'Fraião' },
  { id: 3, nome: 'Centro' },
  { id: 4, nome: 'Gualtar' }
]

type IntervaloRapido = '7d' | '30d' | '90d' | 'tudo' | 'custom'

export function TransferenciasPage() {
  const [intervalo, setIntervalo]       = useState<IntervaloRapido>('30d')
  const [dataInicio, setDataInicio]     = useState<string>(diasAtras(30))
  const [dataFim, setDataFim]           = useState<string>(hoje())
  const [lojaOrigemId, setLojaOrigemId] = useState<number>(0)
  const [lojaDestinoId, setLojaDestinoId] = useState<number>(0)
  const [status, setStatus]             = useState<'Todos' | 'EmTransito' | 'Recebida' | 'Divergencia'>('Todos')

  const [transferencias, setTransferencias] = useState<TransferenciaRelatorio[]>([])
  const [kpis, setKpis]                     = useState<TransferenciasKpis | null>(null)
  const [loading, setLoading]               = useState(true)
  const [erro, setErro]                     = useState<string | null>(null)

  const [envioSelecionado, setEnvioSelecionado] = useState<string | null>(null)

  // ─── Filtros derivados ────────────────────────────────────────

  const filtros = useMemo<FiltrosTransferencias>(() => ({
    dataInicio:    intervalo === 'tudo' ? undefined : dataInicio,
    dataFim:       intervalo === 'tudo' ? undefined : dataFim,
    lojaOrigemId:  lojaOrigemId  > 0 ? lojaOrigemId  : undefined,
    lojaDestinoId: lojaDestinoId > 0 ? lojaDestinoId : undefined,
    status:        status
  }), [intervalo, dataInicio, dataFim, lojaOrigemId, lojaDestinoId, status])

  // ─── Carregar dados quando filtros mudam ─────────────────────

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setErro(null)

    Promise.all([
      listarTransferencias(filtros),
      obterKpisTransferencias({ dataInicio: filtros.dataInicio, dataFim: filtros.dataFim })
    ])
      .then(([lista, k]) => {
        if (cancelado) return
        setTransferencias(lista)
        setKpis(k)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelado) return
        setErro((e as Error).message)
        setLoading(false)
      })

    return () => { cancelado = true }
  }, [filtros])

  // ─── Handlers de intervalo rápido ─────────────────────────────

  const aplicarIntervalo = (i: IntervaloRapido): void => {
    setIntervalo(i)
    if (i === '7d')      { setDataInicio(diasAtras(7));  setDataFim(hoje()) }
    else if (i === '30d'){ setDataInicio(diasAtras(30)); setDataFim(hoje()) }
    else if (i === '90d'){ setDataInicio(diasAtras(90)); setDataFim(hoje()) }
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Transferências entre Lojas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Movimentações de stock entre lojas — envios, recepções e divergências
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Total"
          value={kpis?.total ?? 0}
          color="bg-slate-100 text-slate-900"
        />
        <KpiCard
          label="Em trânsito"
          value={kpis?.emTransito ?? 0}
          color="bg-amber-100 text-amber-900"
          highlight={(kpis?.emTransito ?? 0) > 0}
        />
        <KpiCard
          label="Recebidas"
          value={kpis?.recebidas ?? 0}
          color="bg-green-100 text-green-900"
        />
        <KpiCard
          label="Com divergência"
          value={kpis?.comDivergencia ?? 0}
          color="bg-red-100 text-red-900"
          highlight={(kpis?.comDivergencia ?? 0) > 0}
        />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        {/* Linha 1: botões de intervalo rápido */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-2">PERÍODO:</span>
          {(['7d', '30d', '90d', 'tudo'] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => aplicarIntervalo(i)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                intervalo === i
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {labelIntervalo(i)}
            </button>
          ))}
        </div>

        {/* Linha 2: date pickers + filtros adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setIntervalo('custom') }}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
              disabled={intervalo === 'tudo'}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setIntervalo('custom') }}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
              disabled={intervalo === 'tudo'}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Loja origem</label>
            <select
              value={lojaOrigemId}
              onChange={(e) => setLojaOrigemId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value={0}>Todas</option>
              {LOJAS.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Loja destino</label>
            <select
              value={lojaDestinoId}
              onChange={(e) => setLojaDestinoId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value={0}>Todas</option>
              {LOJAS.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="Todos">Todos</option>
              <option value="EmTransito">Em trânsito</option>
              <option value="Recebida">Recebida</option>
              <option value="Divergencia">Divergência</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading && (
          <div className="px-6 py-12 text-center text-slate-500">A carregar...</div>
        )}

        {erro && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
            Erro: {erro}
          </div>
        )}

        {!loading && !erro && transferencias.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-sm text-slate-500">
              Nenhuma transferência encontrada com estes filtros.
            </div>
          </div>
        )}

        {!loading && !erro && transferencias.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Data</th>
                <th className="text-left px-4 py-3 font-medium">Origem</th>
                <th className="text-left px-4 py-3 font-medium">Destino</th>
                <th className="text-right px-4 py-3 font-medium">Linhas</th>
                <th className="text-right px-4 py-3 font-medium">Enviadas</th>
                <th className="text-right px-4 py-3 font-medium">Recebidas</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transferencias.map((t) => (
                <tr
                  key={t.envioId}
                  onClick={() => setEnvioSelecionado(t.envioId)}
                  className="hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3 text-slate-700">
                    <div>{new Date(t.dataEnvio).toLocaleDateString('pt-PT')}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(t.dataEnvio).toLocaleTimeString('pt-PT', {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{t.lojaOrigemNome}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{t.lojaDestinoNome}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{t.numeroLinhas}</td>
                  <td className="px-4 py-3 text-right text-slate-900 tabular-nums font-semibold">
                    {t.unidadesEnviadas}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.unidadesRecebidas == null ? (
                      <span className="text-slate-400">—</span>
                    ) : t.diferencaUnidades === 0 ? (
                      <span className="text-green-700 font-semibold">{t.unidadesRecebidas}</span>
                    ) : (
                      <span className="text-red-700 font-semibold">{t.unidadesRecebidas}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    {t.documentoReferencia ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de detalhe */}
      {envioSelecionado && (
        <TransferenciaDetalheModal
          envioId={envioSelecionado}
          onClose={() => setEnvioSelecionado(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-componentes ───────────────────────────────────────────────

function KpiCard({
  label, value, color, highlight = false
}: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${color} ${highlight ? 'ring-2 ring-current/20' : ''}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: 'EmTransito' | 'Recebida' | 'Divergencia' }) {
  if (status === 'Recebida') {
    return (
      <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        ✓ Recebida
      </span>
    )
  }
  if (status === 'Divergencia') {
    return (
      <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        ⚠ Divergência
      </span>
    )
  }
  return (
    <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
      ⏳ Em trânsito
    </span>
  )
}

// ─── Helpers de data ────────────────────────────────────────────────

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function labelIntervalo(i: IntervaloRapido): string {
  if (i === '7d')   return 'Últimos 7 dias'
  if (i === '30d')  return 'Últimos 30 dias'
  if (i === '90d')  return 'Últimos 90 dias'
  if (i === 'tudo') return 'Tudo'
  return 'Personalizado'
}
