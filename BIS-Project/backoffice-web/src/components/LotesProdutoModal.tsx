/**
 * LotesProdutoModal — Modal com histórico de recepções de um produto.
 *
 * Melhorias v2:
 *   - Banner de alerta no header quando há lotes vencidos/críticos
 *   - Linha destacada com fundo colorido por estado de validade
 *   - 4 KPIs: Total recebido, Recepções, Vencidos, A expirar ≤30d
 *   - Dias até expirar com cor dinâmica
 */

import { useEffect, useState } from 'react'
import { InventarioService } from '../services/InventarioService'
import type { LotesProduto, RecepcaoLote, EstadoValidade } from '../services/InventarioService'

interface Props {
  produtoId: number
  onClose:   () => void
}

export function LotesProdutoModal({ produtoId, onClose }: Props) {
  const [data, setData]       = useState<LotesProduto | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    InventarioService.obterLotesProduto(produtoId)
      .then((d) => { if (!cancelado) { setData(d); setLoading(false) } })
      .catch((e) => { if (!cancelado) { setErro((e as Error).message); setLoading(false) } })
    return () => { cancelado = true }
  }, [produtoId])

  const numVencidos = data?.recepcoes.filter(r => r.estadoValidade === 'Vencido').length  ?? 0
  const numCriticos = data?.recepcoes.filter(r => r.estadoValidade === 'Critico').length  ?? 0
  const numAlerta   = data?.recepcoes.filter(r => r.estadoValidade === 'Alerta').length   ?? 0
  const temProblema = numVencidos > 0 || numCriticos > 0

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Histórico de Lotes</h2>
              {temProblema && (
                <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                  ⛔ {numVencidos > 0 ? `${numVencidos} vencido(s)` : `${numCriticos} crítico(s)`}
                </span>
              )}
              {!temProblema && numAlerta > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  ⚠ {numAlerta} a expirar em breve
                </span>
              )}
            </div>
            {data && (
              <div className="text-sm text-slate-600 mt-0.5 flex items-center gap-2">
                {data.artigo}
                {data.perecivel && (
                  <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded">
                    Perecível
                  </span>
                )}
              </div>
            )}
            {data && <div className="text-xs text-slate-500 font-mono mt-0.5">{data.ean}</div>}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl px-2">
            ×
          </button>
        </div>

        {/* Banner de alerta */}
        {temProblema && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center gap-2 text-sm text-red-800">
            <span>⛔</span>
            <span className="font-semibold">Atenção: </span>
            {numVencidos > 0 && <span>{numVencidos} lote(s) vencido(s) — retirar de circulação. </span>}
            {numCriticos > 0 && <span>{numCriticos} lote(s) expiram nos próximos 7 dias. </span>}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12 text-slate-500 text-sm">A carregar histórico...</div>
          )}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">Erro: {erro}</div>
          )}
          {data && !loading && data.recepcoes.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm font-medium text-slate-900">Sem recepções registadas</div>
              <div className="text-xs text-slate-500 mt-1">
                {data.perecivel
                  ? 'Faça uma receção no POS com Lote e Validade para começar.'
                  : 'Nenhuma recepção foi feita para este produto ainda.'}
              </div>
            </div>
          )}

          {data && !loading && data.recepcoes.length > 0 && (
            <>
              {/* 4 KPIs */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <KpiBox label="Total recebido"    valor={`${data.totalRecebido} un.`}   cor="slate" />
                <KpiBox label="Recepções"          valor={data.numRecepcoes}              cor="slate" />
                <KpiBox label="Vencidos"           valor={numVencidos}                    cor={numVencidos > 0 ? 'red' : 'slate'} />
                <KpiBox label="A expirar ≤30d"     valor={numCriticos + numAlerta}        cor={numCriticos > 0 ? 'red' : numAlerta > 0 ? 'amber' : 'slate'} />
              </div>

              {/* Tabela */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Data Recepção</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Loja</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Lote</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Validade</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Qtd.</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Estado</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recepcoes.map((r) => (
                      <LinhaRecepcao key={`${r.rececaoId}-${r.lojaNome}`} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ Sub-componentes ═══════════════════════

function LinhaRecepcao({ r }: { r: RecepcaoLote }) {
  const dataRec = new Date(r.dataRececao).toLocaleDateString('pt-PT')
  const horaRec = new Date(r.dataRececao).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const bgLinha =
    r.estadoValidade === 'Vencido'  ? 'bg-red-50 hover:bg-red-100'    :
    r.estadoValidade === 'Critico'  ? 'bg-orange-50 hover:bg-orange-100' :
    r.estadoValidade === 'Alerta'   ? 'bg-amber-50 hover:bg-amber-100' :
    'hover:bg-slate-50'

  return (
    <tr className={bgLinha}>
      <td className="px-4 py-3 align-top">
        <div className="text-slate-900 text-sm">{dataRec}</div>
        <div className="text-xs text-slate-500">{horaRec}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="text-slate-900 font-medium">{r.lojaNome}</div>
        {r.operadorNome && <div className="text-xs text-slate-500">{r.operadorNome}</div>}
      </td>
      <td className="px-4 py-3 align-top">
        {r.lote
          ? <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded">{r.lote}</span>
          : <span className="text-slate-400 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 align-top">
        {r.dataValidade ? (
          <div>
            <div className="text-slate-900 text-sm">
              {new Date(r.dataValidade).toLocaleDateString('pt-PT')}
            </div>
            {r.diasAteExpirar !== null && (
              <div className={`text-xs font-medium ${
                r.diasAteExpirar <  0  ? 'text-red-700' :
                r.diasAteExpirar <= 7  ? 'text-orange-700' :
                r.diasAteExpirar <= 30 ? 'text-amber-700' :
                'text-slate-500'
              }`}>
                {r.diasAteExpirar < 0  ? `⛔ Vencido há ${Math.abs(r.diasAteExpirar)} dias` :
                 r.diasAteExpirar === 0 ? '⚠ Expira hoje' :
                 `em ${r.diasAteExpirar} dias`}
              </div>
            )}
          </div>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums font-semibold text-slate-900">
        +{r.quantidade}
      </td>
      <td className="px-4 py-3 align-top">
        <BadgeEstado estado={r.estadoValidade} />
      </td>
      <td className="px-4 py-3 align-top">
        {r.documento
          ? <span className="text-xs text-slate-600 font-mono">{r.documento}</span>
          : <span className="text-slate-400 text-xs">—</span>}
      </td>
    </tr>
  )
}

function BadgeEstado({ estado }: { estado: EstadoValidade }) {
  const cfg = {
    Vencido:     { bg: 'bg-red-200',    text: 'text-red-900',    label: '⛔ Vencido'  },
    Critico:     { bg: 'bg-red-100',    text: 'text-red-800',    label: '⛔ Crítico'  },
    Alerta:      { bg: 'bg-amber-100',  text: 'text-amber-800',  label: '⚠ Alerta'   },
    OK:          { bg: 'bg-green-100',  text: 'text-green-800',  label: '✓ OK'        },
    SemValidade: { bg: 'bg-slate-100',  text: 'text-slate-600',  label: '— sem val.'  }
  }[estado]

  return (
    <span className={`${cfg.bg} ${cfg.text} text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap`}>
      {cfg.label}
    </span>
  )
}

function KpiBox({ label, valor, cor }: { label: string; valor: string | number; cor: 'slate' | 'red' | 'amber' }) {
  const cores = {
    red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-900',   sub: 'text-red-700'   },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', sub: 'text-amber-700' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', sub: 'text-slate-600' }
  }[cor]
  return (
    <div className={`${cores.bg} ${cores.border} border rounded-lg p-3`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${cores.sub}`}>{label}</div>
      <div className={`text-xl font-bold mt-0.5 tabular-nums ${cores.text}`}>{valor}</div>
    </div>
  )
}
