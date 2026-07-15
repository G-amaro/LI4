/**
 * LojaDetalhePage — Detalhe completo de uma loja.
 *
 * Mostra:
 *   - 4 KPI cards (vendas hoje / semana / ticket médio / quebras)
 *   - Gráfico SVG de actividade dos últimos 7 dias
 *   - Top 5 produtos vendidos
 *   - Stock crítico + alertas
 *   - Equipa (operadores)
 *
 * Sem dependências externas — gráfico desenhado em SVG puro.
 */

import { useCallback, useEffect, useState } from 'react'
import { LojasService, formatarTempoRelativo } from '../services/LojasService'
import type {
  LojaDetalhe,
  LojaActividadeDiaria,
  LojaStockCritico
} from '../services/LojasService'

interface LojaDetalhePageProps {
  lojaId:   number
  onVoltar: () => void
}

export function LojaDetalhePage({ lojaId, onVoltar }: LojaDetalhePageProps) {
  const [detalhe, setDetalhe] = useState<LojaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState<string | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setErro(null)
    try {
      const r = await LojasService.obterDetalhe(lojaId)
      setDetalhe(r)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [lojaId])

  useEffect(() => { void carregar() }, [carregar])

  if (loading && !detalhe) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar detalhe...</div>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="p-8 space-y-4">
        <button onClick={onVoltar} className="text-sm text-slate-600 hover:text-slate-900">
          ← Voltar a Lojas
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold">Erro</div>
          <div className="text-sm text-red-700 mt-1">{erro}</div>
        </div>
      </div>
    )
  }

  if (!detalhe) return null

  return (
    <div className="p-8 space-y-6">
      <button onClick={onVoltar} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
        ← Voltar a Lojas
      </button>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-900">{detalhe.nome}</h1>
            {detalhe.isSede && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded">
                Sede
              </span>
            )}
          </div>
          {detalhe.localidade && (
            <p className="text-sm text-slate-500 mt-1">{detalhe.localidade}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Última sincronização</div>
          <div className="text-sm font-medium text-slate-900 mt-0.5">
            {formatarTempoRelativo(detalhe.ultimaSincronizacao)}
          </div>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Vendas hoje"
          valor={`${detalhe.kpis.vendasHoje.toFixed(2)}€`}
          sublabel={`${detalhe.kpis.transacoesHoje} transacções`}
          cor="blue"
        />
        <KpiCard
          label="Vendas 7 dias"
          valor={`${detalhe.kpis.vendasSemana.toFixed(2)}€`}
          sublabel={`${detalhe.kpis.transacoesSemana} transacções`}
          cor="slate"
        />
        <KpiCard
          label="Ticket médio"
          valor={`${detalhe.kpis.ticketMedio.toFixed(2)}€`}
          cor="green"
        />
        <KpiCard
          label="Quebras 7 dias"
          valor={detalhe.kpis.quebrasUltimos7d}
          sublabel={`${detalhe.kpis.unidadesVendidas7d} unid. vendidas`}
          cor={detalhe.kpis.quebrasUltimos7d > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Gráfico de actividade — full width */}
      <Cartao titulo="Actividade dos últimos 7 dias">
        <GraficoActividade dados={detalhe.actividade7Dias} />
      </Cartao>

      {/* Top produtos + stock crítico — lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Cartao titulo="Top 5 produtos vendidos (7 dias)">
          {detalhe.topProdutos.length === 0 ? (
            <Vazio mensagem="Sem vendas nos últimos 7 dias." />
          ) : (
            <div className="divide-y divide-slate-100">
              {detalhe.topProdutos.map((p, idx) => (
                <div key={p.produtoId} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="bg-slate-100 text-slate-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{p.artigo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      {p.unidadesVendidas} unid.
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {p.receita.toFixed(2)}€
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao titulo={`Stock crítico (${detalhe.stockCritico.length})`}>
          {detalhe.stockCritico.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm text-slate-600">Sem alertas de stock</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {detalhe.stockCritico.map((s) => (
                <LinhaStockCritico key={s.produtoId} stock={s} />
              ))}
            </div>
          )}
        </Cartao>
      </div>

      {/* Equipa */}
      <Cartao titulo={`Equipa (${detalhe.operadores.length})`}>
        {detalhe.operadores.length === 0 ? (
          <Vazio mensagem="Sem operadores registados." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
            {detalhe.operadores.map((op) => (
              <div key={op.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {iniciais(op.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{op.nome}</div>
                  <div className="text-xs text-slate-500">
                    {op.perfil} · NIF {op.nif}
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                  {op.ultimoLogin ? formatarTempoRelativo(op.ultimoLogin) : 'nunca entrou'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  )
}

// ═══════════════════════ GRÁFICO SVG ═══════════════════════

function GraficoActividade({ dados }: { dados: LojaActividadeDiaria[] }) {
  if (dados.length === 0) {
    return <Vazio mensagem="Sem dados de actividade." />
  }

  const maxVendas = Math.max(...dados.map(d => d.vendas), 1)  // mínimo 1 para evitar divisão por zero

  // Dimensões do SVG (proporcionalmente responsivas via viewBox)
  const W = 700
  const H = 220
  const PAD_X = 50
  const PAD_TOP = 30
  const PAD_BOTTOM = 40
  const chartW = W - 2 * PAD_X
  const chartH = H - PAD_TOP - PAD_BOTTOM
  const barW   = (chartW / dados.length) * 0.7
  const barGap = (chartW / dados.length) * 0.3

  return (
    <div className="py-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Linhas de grelha horizontais */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD_TOP + chartH * (1 - frac)
          const valor = maxVendas * frac
          return (
            <g key={frac}>
              <line
                x1={PAD_X} x2={W - PAD_X}
                y1={y}     y2={y}
                stroke="#e2e8f0"
                strokeDasharray={frac === 0 ? '' : '2 4'}
              />
              <text
                x={PAD_X - 8} y={y + 4}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
              >
                {valor.toFixed(0)}€
              </text>
            </g>
          )
        })}

        {/* Barras */}
        {dados.map((d, i) => {
          const x = PAD_X + i * (barW + barGap) + barGap / 2
          const altura = (d.vendas / maxVendas) * chartH
          const y = PAD_TOP + chartH - altura
          const corBarra = d.vendas > 0 ? '#3b82f6' : '#cbd5e1'

          return (
            <g key={i}>
              {/* Barra */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={altura || 2}
                rx={4}
                fill={corBarra}
              />
              {/* Valor por cima */}
              {d.vendas > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize="10"
                  fill="#475569"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {d.vendas.toFixed(0)}€
                </text>
              )}
              {/* Label do dia */}
              <text
                x={x + barW / 2}
                y={H - PAD_BOTTOM + 16}
                fontSize="11"
                fill="#64748b"
                textAnchor="middle"
              >
                {nomeDia(d.dia)}
              </text>
              <text
                x={x + barW / 2}
                y={H - PAD_BOTTOM + 30}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {d.transacoes}{d.transacoes === 1 ? ' tx' : ' tx'}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function nomeDia(iso: string): string {
  const d = new Date(iso)
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

// ═══════════════════════ COMPONENTES ═══════════════════════

function KpiCard({
  label, valor, sublabel, cor
}: {
  label: string; valor: string | number; sublabel?: string; cor: 'blue' | 'slate' | 'green' | 'red'
}) {
  const cores = {
    blue:  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-900',   sub: 'text-blue-700' },
    slate: { bg: 'bg-white',     border: 'border-slate-200',  text: 'text-slate-900',  sub: 'text-slate-500' },
    green: { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  sub: 'text-green-700' },
    red:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    sub: 'text-red-700' }
  }[cor]

  return (
    <div className={`${cores.bg} ${cores.border} border rounded-xl p-5`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${cores.sub}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${cores.text}`}>{valor}</div>
      {sublabel && <div className={`text-xs mt-1 ${cores.sub}`}>{sublabel}</div>}
    </div>
  )
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

function Vazio({ mensagem }: { mensagem: string }) {
  return (
    <div className="py-8 text-center text-sm text-slate-400">{mensagem}</div>
  )
}

function LinhaStockCritico({ stock }: { stock: LojaStockCritico }) {
  const cfg = stock.estado === 'Critico'
    ? { bg: 'bg-red-100', text: 'text-red-800', label: 'Crítico' }
    : { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Alerta' }

  return (
    <div className="py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{stock.artigo}</div>
        <div className="text-xs text-slate-500">{stock.categoria}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`${cfg.bg} ${cfg.text} text-xs font-semibold px-2 py-0.5 rounded-full`}>
          {cfg.label}
        </span>
        <span className="text-sm font-bold text-slate-900 tabular-nums w-8 text-right">
          {stock.stock}
        </span>
      </div>
    </div>
  )
}

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}
