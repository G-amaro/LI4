/**
 * DashboardPage — Dashboard executivo do backoffice BIS.
 *
 * Estrutura fiel ao protótipo:
 *   - 4 cards de topo (Faturação hoje, Estado Lojas, Transferências, Alertas)
 *   - Gráfico de barras SVG por loja/dia (últimos 7 dias)
 *   - Tabela de últimas transferências com estado
 *   - Contadores de entidades (lojas, produtos, operadores)
 *
 * Sem dependências externas — gráfico SVG puro.
 */

import { useCallback, useEffect, useState } from 'react'
import { DashboardService } from '../services/DashboardService'
import type { DashboardResumo, VendasPorLojaEDia } from '../types/dashboard'

// ─── Paleta de cores por loja (índice) ─────────────────────────────
const CORES_LOJA = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function corLoja(idx: number): string {
  return CORES_LOJA[idx % CORES_LOJA.length]
}

function formatarMoeda(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// ─── Gráfico de barras SVG ─────────────────────────────────────────

interface BarraProps {
  vendasPorLojaEDia: VendasPorLojaEDia[]
}

function GraficoBarras({ vendasPorLojaEDia }: BarraProps) {
  // Descobrir lojas únicas e dias únicos
  const lojasUnicas = Array.from(
    new Map(vendasPorLojaEDia.map((v) => [v.lojaId, v.lojaNome])).entries()
  ).map(([id, nome]) => ({ id, nome }))

  const diasUnicos = Array.from(new Set(vendasPorLojaEDia.map((v) => v.data))).sort()

  if (diasUnicos.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
        Sem dados de vendas nos últimos 7 dias
      </div>
    )
  }

  // Construir mapa: dia → lojaId → valor
  const mapa: Record<string, Record<number, number>> = {}
  for (const d of diasUnicos) mapa[d] = {}
  for (const v of vendasPorLojaEDia) {
    if (!mapa[v.data]) mapa[v.data] = {}
    mapa[v.data][v.lojaId] = v.valor
  }

  const maxValor = Math.max(
    ...vendasPorLojaEDia.map((v) => v.valor), 1
  )

  // Dimensões do SVG
  const W          = 600
  const H          = 200
  const PADDING_L  = 50
  const PADDING_R  = 10
  const PADDING_T  = 10
  const PADDING_B  = 30
  const chartW     = W - PADDING_L - PADDING_R
  const chartH     = H - PADDING_T - PADDING_B
  const numDias    = diasUnicos.length
  const numLojas   = lojasUnicas.length
  const grupoW     = chartW / numDias
  const barW       = Math.min(20, (grupoW * 0.8) / Math.max(numLojas, 1))
  const gapBarra   = 2

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 220 }}
        aria-label="Gráfico de faturação por loja"
      >
        {/* Linhas de grade */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = PADDING_T + chartH * (1 - pct)
          return (
            <g key={pct}>
              <line x1={PADDING_L} y1={y} x2={W - PADDING_R} y2={y}
                stroke="#e2e8f0" strokeWidth={0.5} />
              <text x={PADDING_L - 4} y={y + 4} textAnchor="end"
                fontSize={9} fill="#94a3b8">
                {pct === 0 ? '0' : `${Math.round(maxValor * pct)}€`}
              </text>
            </g>
          )
        })}

        {/* Barras por dia */}
        {diasUnicos.map((dia, dIdx) => {
          const grupoX  = PADDING_L + dIdx * grupoW + grupoW / 2
          const startX  = grupoX - (numLojas * (barW + gapBarra)) / 2 + gapBarra / 2

          return (
            <g key={dia}>
              {/* Etiqueta do dia no eixo X */}
              <text
                x={grupoX}
                y={H - 5}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
              >
                {formatarData(dia)}
              </text>

              {/* Barra por loja */}
              {lojasUnicas.map((loja, lIdx) => {
                const valor  = mapa[dia][loja.id] ?? 0
                const barH   = (valor / maxValor) * chartH
                const x      = startX + lIdx * (barW + gapBarra)
                const y      = PADDING_T + chartH - barH
                const cor    = corLoja(lIdx)

                return (
                  <g key={loja.id}>
                    <rect
                      x={x} y={y}
                      width={barW} height={barH}
                      fill={cor}
                      rx={2}
                      opacity={valor > 0 ? 1 : 0.15}
                    />
                    {valor > 0 && barH > 14 && (
                      <text
                        x={x + barW / 2}
                        y={y + barH / 2 + 3}
                        textAnchor="middle"
                        fontSize={7}
                        fill="white"
                        fontWeight="bold"
                      >
                        {Math.round(valor)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Eixo Y */}
        <line
          x1={PADDING_L} y1={PADDING_T}
          x2={PADDING_L} y2={PADDING_T + chartH}
          stroke="#cbd5e1" strokeWidth={1}
        />
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-2 px-2">
        {lojasUnicas.map((loja, idx) => (
          <div key={loja.id} className="flex items-center gap-1.5 text-xs text-slate-600">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: corLoja(idx) }}
            />
            <span>{loja.nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card de topo ──────────────────────────────────────────────────

interface TopCardProps {
  titulo:    string
  valor:     string
  sub?:      string
  icone:     string
  cor:       'blue' | 'green' | 'amber' | 'red'
  badge?:    string
  badgeCor?: 'green' | 'amber' | 'red' | 'blue'
}

function TopCard({ titulo, valor, sub, icone, cor, badge, badgeCor }: TopCardProps) {
  const cores = {
    blue:  { border: 'border-blue-200',  bg: 'bg-blue-50',  icon: 'bg-blue-100 text-blue-700',  text: 'text-blue-900'  },
    green: { border: 'border-green-200', bg: 'bg-green-50', icon: 'bg-green-100 text-green-700', text: 'text-green-900' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-900' },
    red:   { border: 'border-red-200',   bg: 'bg-red-50',   icon: 'bg-red-100 text-red-700',     text: 'text-red-900'   }
  }[cor]

  const badgeCores: Record<string, string> = {
    green: 'bg-green-500 text-white',
    amber: 'bg-amber-500 text-white',
    red:   'bg-red-500 text-white',
    blue:  'bg-blue-500 text-white'
  }

  return (
    <div className={`${cores.bg} ${cores.border} border rounded-xl p-5 flex items-start gap-4`}>
      <div className={`${cores.icon} w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
        {icone}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{titulo}</div>
        <div className={`text-2xl font-black ${cores.text} mt-0.5 tabular-nums`}>{valor}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5 truncate">{sub}</div>}
        {badge && (
          <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCores[badgeCor ?? 'blue']}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function DashboardPage() {
  const [dados, setDados]   = useState<DashboardResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]     = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const resumo = await DashboardService.obterResumo()
      setDados(resumo)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  if (loading && !dados) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500 min-h-96">
        <div className="text-3xl animate-spin">⟳</div>
        <div className="text-sm">A carregar dashboard...</div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="p-8 space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="text-red-800 font-semibold">Erro ao carregar dashboard</div>
          <div className="text-red-600 text-sm mt-1">{erro}</div>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          ↻ Tentar novamente
        </button>
      </div>
    )
  }

  if (!dados) return null

const variacao    = dados.percentVariacaoVendas ?? 0
const variacaoPos = variacao >= 0
const variacaoStr = `${variacaoPos ? '+' : ''}${variacao.toFixed(1)}% vs ontem`

  return (
    <div className="space-y-6">

      {/* Título + botão refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Geral</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          Atualizar
        </button>
      </div>

      {/* ── CARDS DO TOPO ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <TopCard
          titulo="Faturação hoje"
          valor={formatarMoeda(dados.totalVendasHoje ?? 0)}
          sub={variacaoStr}
          icone="💰"
          cor="blue"
          badge={variacaoPos ? `↑ ${variacaoStr}` : `↓ ${Math.abs(dados.percentVariacaoVendas).toFixed(1)}% vs ontem`}
          badgeCor={variacaoPos ? 'green' : 'red'}
        />
        <TopCard
          titulo="Estado das Lojas"
          valor={`${dados.lojasOnline}/${dados.lojasTotal ?? 0} Online`}
          sub={(dados.lojasOnline ?? 0) < (dados.lojasTotal ?? 0)
            ? `${dados.lojasTotal - dados.lojasOnline} offline/sem sync`
            : 'Todas sincronizadas'}
          icone="🏪"
          cor="green"
          badge={dados.lojasOnline < dados.lojasTotal ? 'Sincronização pendente < 15 min' : 'Todas OK'}
          badgeCor={dados.lojasOnline < dados.lojasTotal ? 'amber' : 'green'}
        />
        <TopCard
          titulo="Transferências pendentes"
          valor={String(dados.transferenciasPendentes ?? 0)}
          sub="A aguardar recepção"
          icone="🔄"
          cor={dados.transferenciasPendentes > 0 ? 'amber' : 'green'}
          badge={dados.transferenciasPendentes > 0 ? 'A aguardar recepção' : 'Tudo concluído'}
          badgeCor={dados.transferenciasPendentes > 0 ? 'amber' : 'green'}
        />
        <TopCard
          titulo="Quebras (total)"
          valor={formatarMoeda(dados.totalQuebras ?? 0)}
          sub={`Discrepâncias: ${formatarMoeda(Math.abs(dados.totalDiscrepancias))}`}
          icone="⚠"
          cor={dados.totalQuebras > 100 ? 'red' : 'amber'}
        />
      </div>

      {/* ── GRÁFICO + TRANSFERÊNCIAS ──────────────────────────────── */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">

        {/* Gráfico de barras */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Faturação por Loja — Últimos 7 Dias
            </h2>
            <span className="text-xs text-slate-400">€ / dia</span>
          </div>
          <GraficoBarras vendasPorLojaEDia={dados.vendasPorLojaEDia} />
        </div>

        {/* Top lojas + mini stats */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Top Lojas</h2>
          <div className="space-y-2">
            {dados.topLojas.map((loja, idx) => {
              const maxReceita = dados.topLojas[0]?.receita || 1
              const pct = Math.round((loja.receita / maxReceita) * 100)
              return (
                <div key={loja.id}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: corLoja(idx) }}
                      />
                      <span className="font-medium text-slate-800">{loja.nome}</span>
                      <span className="text-xs text-slate-400">{loja.numeroVendas} vendas</span>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatarMoeda(loja.receita)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: corLoja(idx) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Contadores */}
          <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-black text-slate-900">{dados.numeroLojas}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Lojas</div>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900">{dados.numeroProdutos}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Produtos</div>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900">{dados.numeroOperadores}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Operadores</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ÚLTIMAS TRANSFERÊNCIAS ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Últimas Transferências de Stock
          </h2>
          <span className="text-xs text-slate-400">
            {dados.ultimasTransferencias.length} registos
          </span>
        </div>

        {dados.ultimasTransferencias.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhuma transferência registada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">Origem</th>
                <th className="text-left px-4 py-3 font-semibold">Destino</th>
                <th className="text-left px-4 py-3 font-semibold">Data Envio</th>
                <th className="text-right px-4 py-3 font-semibold">Unidades</th>
                <th className="text-center px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados.ultimasTransferencias.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.lojaOrigemNome}</td>
                  <td className="px-4 py-3 text-slate-700">{t.lojaDestinoNome}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(t.dataMovimento).toLocaleDateString('pt-PT', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {t.totalUnidades}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                      t.estado === 'Concluída'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {t.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
