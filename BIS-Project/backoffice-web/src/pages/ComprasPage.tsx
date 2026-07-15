/**
 * ComprasPage — Histórico de receções com fornecedor e custo.
 * Fase 4.3.
 */

import { useEffect, useState } from 'react'
import { ComprasService, type Compra, type ComprasKpis } from '../services/ComprasService'
import { FornecedorService, type Fornecedor } from '../services/FornecedorService'

export function ComprasPage() {
  const [compras, setCompras]         = useState<Compra[]>([])
  const [kpis, setKpis]               = useState<ComprasKpis | null>(null)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading]         = useState(true)
  const [erro, setErro]               = useState<string | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  // Filtros
  const [filtroFornecedor, setFiltroFornecedor] = useState<number | ''>('')
  const [filtroDe, setFiltroDe]                 = useState('')
  const [filtroAte, setFiltroAte]               = useState('')

  const carregar = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [comprasData, kpisData, fornsData] = await Promise.all([
        ComprasService.listar({
          fornecedorId: filtroFornecedor || undefined,
          de:  filtroDe  || undefined,
          ate: filtroAte || undefined
        }),
        ComprasService.kpis(),
        FornecedorService.listar()
      ])
      setCompras(comprasData)
      setKpis(kpisData)
      setFornecedores(fornsData)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const totalCustoFiltrado = compras.reduce((acc, c) => acc + c.custoTotal, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
        <p className="text-sm text-slate-500 mt-1">Histórico de receções de mercadoria com custo</p>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Gasto este mês"
            valor={`${kpis.totalGastoMes.toFixed(2)} €`}
            cor="emerald"
          />
          <KpiCard
            label="Receções este mês"
            valor={String(kpis.numRececoesMes)}
            cor="blue"
          />
          <KpiCard
            label="Fornecedor principal"
            valor={kpis.fornecedorTopNome ?? '—'}
            subvalor={kpis.fornecedorTopNome ? `${kpis.fornecedorTopGasto.toFixed(2)} €` : undefined}
            cor="slate"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Fornecedor
            </label>
            <select
              value={filtroFornecedor}
              onChange={(e) => setFiltroFornecedor(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              De
            </label>
            <input
              type="date"
              value={filtroDe}
              onChange={(e) => setFiltroDe(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Até
            </label>
            <input
              type="date"
              value={filtroAte}
              onChange={(e) => setFiltroAte(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={carregar}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {erro}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">A carregar compras...</div>
      ) : compras.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-sm text-slate-500">Nenhuma compra encontrada.</div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Data</th>
                  <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-semibold">Loja</th>
                  <th className="text-left px-4 py-3 font-semibold">Operador</th>
                  <th className="text-right px-4 py-3 font-semibold">Linhas</th>
                  <th className="text-right px-4 py-3 font-semibold">Custo Total</th>
                  <th className="text-center px-4 py-3 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compras.map((c) => (
                  <>
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {new Date(c.dataRececao).toLocaleDateString('pt-PT')}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(c.dataRececao).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {c.documentoReferencia && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.documentoReferencia}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {c.fornecedorNome ?? <span className="text-slate-400 font-normal">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.lojaNome}</td>
                      <td className="px-4 py-3 text-slate-700">{c.operadorNome}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{c.numeroLinhas}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-800">
                        {c.custoTotal.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          {expandidoId === c.id ? '▲ Fechar' : '▼ Ver'}
                        </button>
                      </td>
                    </tr>

                    {/* Linhas expandidas */}
                    {expandidoId === c.id && (
                      <tr key={`${c.id}-detalhe`}>
                        <td colSpan={7} className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Artigos recebidos
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left py-1 font-semibold">Artigo</th>
                                <th className="text-left py-1 font-semibold">EAN</th>
                                <th className="text-left py-1 font-semibold">Lote</th>
                                <th className="text-left py-1 font-semibold">Validade</th>
                                <th className="text-right py-1 font-semibold">Qtd</th>
                                <th className="text-right py-1 font-semibold">€/un</th>
                                <th className="text-right py-1 font-semibold">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {c.linhas.map((l, i) => (
                                <tr key={i} className="text-slate-700">
                                  <td className="py-1.5 font-medium">{l.artigo}</td>
                                  <td className="py-1.5 font-mono text-slate-500">{l.ean}</td>
                                  <td className="py-1.5">
                                    {l.lote
                                      ? <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{l.lote}</span>
                                      : <span className="text-slate-400">—</span>}
                                  </td>
                                  <td className="py-1.5">
                                    {l.dataValidade
                                      ? new Date(l.dataValidade).toLocaleDateString('pt-PT')
                                      : <span className="text-slate-400">—</span>}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">{l.quantidade}</td>
                                  <td className="py-1.5 text-right tabular-nums">{l.precoCusto.toFixed(2)} €</td>
                                  <td className="py-1.5 text-right tabular-nums font-semibold text-emerald-800">
                                    {l.subtotal.toFixed(2)} €
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-slate-300">
                                <td colSpan={6} className="py-2 text-right font-bold text-slate-800">Total</td>
                                <td className="py-2 text-right font-bold text-emerald-800 tabular-nums">
                                  {c.custoTotal.toFixed(2)} €
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                    Total ({compras.length} receção(ões))
                  </td>
                  <td className="px-4 py-3 text-right text-base font-bold text-emerald-800 tabular-nums">
                    {totalCustoFiltrado.toFixed(2)} €
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────

function KpiCard({
  label, valor, subvalor, cor
}: {
  label: string; valor: string; subvalor?: string; cor: 'emerald' | 'blue' | 'slate'
}) {
  const cores = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', sub: 'text-emerald-700' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-900',    sub: 'text-blue-700'    },
    slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-900',   sub: 'text-slate-600'   }
  }[cor]

  return (
    <div className={`${cores.bg} ${cores.border} border rounded-xl p-4`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${cores.sub}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${cores.text}`}>{valor}</div>
      {subvalor && <div className={`text-xs mt-0.5 ${cores.sub}`}>{subvalor}</div>}
    </div>
  )
}
