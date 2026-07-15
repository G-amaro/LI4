/**
 * LojasPage — Grelha de cards das lojas (Sede + operacionais).
 */

import { useCallback, useEffect, useState } from 'react'
import { LojasService, formatarTempoRelativo } from '../services/LojasService'
import type { LojaCard } from '../services/LojasService'

interface LojasPageProps {
  onSelecionarLoja: (id: number) => void
}

export function LojasPage({ onSelecionarLoja }: LojasPageProps) {
  const [lojas, setLojas]     = useState<LojaCard[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState<string | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setErro(null)
    try {
      const r = await LojasService.listar()
      setLojas(r)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lojas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral da rede BragaConvenience — clique numa loja para ver detalhe
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="text-sm text-slate-600 hover:text-slate-900 font-medium"
        >
          ↻ Actualizar
        </button>
      </div>

      {loading && lojas.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar lojas...</div>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold mb-2">Erro</div>
          <div className="text-sm text-red-700 mb-4">{erro}</div>
          <button
            type="button"
            onClick={carregar}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !erro && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {lojas.map((l) => (
            <CardLoja
              key={l.id}
              loja={l}
              onClick={() => onSelecionarLoja(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ CARD ═══════════════════════

function CardLoja({ loja, onClick }: { loja: LojaCard; onClick: () => void }) {
  const temAlertas = loja.produtosCriticos > 0 || loja.produtosEmAlerta > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-2xl p-6 text-left hover:shadow-lg hover:border-slate-300 transition-all w-full group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 group-hover:text-blue-700 transition">
              {loja.nome}
            </h2>
            {loja.isSede && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded">
                Sede
              </span>
            )}
          </div>
          {loja.localidade && (
            <p className="text-xs text-slate-500 mt-0.5">{loja.localidade}</p>
          )}
        </div>
        <EstadoSyncBadge ultimaSync={loja.ultimaSincronizacao} />
      </div>

      {/* KPI principal */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
          Vendas hoje
        </div>
        <div className="text-3xl font-bold text-blue-900 mt-1 tabular-nums">
          {loja.vendasHoje.toFixed(2)}€
        </div>
        <div className="text-xs text-blue-700 mt-0.5">
          {loja.transacoesHoje} {loja.transacoesHoje === 1 ? 'transacção' : 'transacções'}
        </div>
      </div>

      {/* Mini-KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MiniKpi icone="👥" label="Operadores" valor={loja.numeroOperadores} />
        <MiniKpi icone="📦" label="Catálogo" valor={loja.numeroProdutosCatalogo} />
      </div>

      {/* Alertas */}
      {temAlertas && (
        <div className="space-y-1.5 mb-4">
          {loja.produtosCriticos > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
              <span>⛔</span>
              <span className="text-red-800">
                <span className="font-semibold">{loja.produtosCriticos}</span>{' '}
                {loja.produtosCriticos === 1 ? 'produto crítico' : 'produtos críticos'} (sem stock)
              </span>
            </div>
          )}
          {loja.produtosEmAlerta > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
              <span>⚠</span>
              <span className="text-amber-800">
                <span className="font-semibold">{loja.produtosEmAlerta}</span>{' '}
                {loja.produtosEmAlerta === 1 ? 'produto' : 'produtos'} em alerta
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
        <span>Sync: <span className="font-medium text-slate-700">{formatarTempoRelativo(loja.ultimaSincronizacao)}</span></span>
        <span className="text-slate-400 group-hover:text-blue-600 transition">Ver detalhe →</span>
      </div>
    </button>
  )
}

function MiniKpi({ icone, label, valor }: { icone: string; label: string; valor: string | number }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span>{icone}</span>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-semibold text-slate-900 mt-1 tabular-nums">{valor}</div>
    </div>
  )
}

function EstadoSyncBadge({ ultimaSync }: { ultimaSync: string | null }) {
  if (!ultimaSync) {
    return (
      <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
        Sem actividade
      </span>
    )
  }

  const diffMin = (Date.now() - new Date(ultimaSync).getTime()) / 60_000
  let cfg: { bg: string; text: string; dot: string; label: string }

  if (diffMin <= 5)         cfg = { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Online'  }
  else if (diffMin <= 60)   cfg = { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Atraso'  }
  else                      cfg = { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Offline' }

  return (
    <span className={`${cfg.bg} ${cfg.text} text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1.5`}>
      <span className={`w-1.5 h-1.5 ${cfg.dot} rounded-full`} />
      {cfg.label}
    </span>
  )
}
