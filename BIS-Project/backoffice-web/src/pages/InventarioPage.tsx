/**
 * InventarioPage — Visão Unificada de Inventário (UC06).
 *
 * Composição do ecrã:
 * - 4 KPI Cards: Total / Crítico / Alerta / OK
 * - Barra de pesquisa
 * - Tabela com stock por loja (Dinâmica)
 * - Células coloridas conforme o estado de stock individual por loja
 *
 * Regras de frontend respeitadas:
 * - export function (sem FC nem React.FC)
 * - Tailwind puro
 * - Estados loading e erro sem ecrãs brancos
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { InventarioService, formatarTempoRelativo } from '../services/InventarioService'
import type { InventarioConsolidado } from '../services/InventarioService'
import { LotesProdutoModal } from '../components/LotesProdutoModal'

// Limiares alinhados com o backend (apenas para colorir células)
const LIMITE_CRITICO_LOJA = 0
const LIMITE_ALERTA_LOJA  = 5

export function InventarioPage() {
  const [dados,   setDados]   = useState<InventarioConsolidado | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)
  const [filtro,  setFiltro]  = useState('')
  const [produtoLotesAberto, setProdutoLotesAberto] = useState<number | null>(null)

  // Filtros novos
  const [lojaFiltro, setLojaFiltro] = useState<number | 'todas'>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos')

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setErro(null)
    try {
      const resposta = await InventarioService.obterInventario()
      setDados(resposta)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // ─── Filtragem ────────────────────────────────────────────────
  const itensFiltrados = useMemo(() => {
    if (!dados) return []
    const termo = filtro.trim().toLowerCase()
    
    return dados.artigos.filter((a) => {
      // Filtro texto
      if (termo && !(
        a.ean.toLowerCase().includes(termo) ||
        a.artigo.toLowerCase().includes(termo) ||
        a.categoria.toLowerCase().includes(termo)
      )) return false
      
      // Filtro loja
      if (lojaFiltro !== 'todas' && (a.stockPorLoja[lojaFiltro] ?? 0) === 0) return false
      
      // Filtro categoria
      if (categoriaFiltro !== 'todas' && a.categoria !== categoriaFiltro) return false
      
      // Filtro estado
      if (estadoFiltro !== 'todos' && a.estado !== estadoFiltro) return false
      
      return true
    })
  }, [dados, filtro, lojaFiltro, categoriaFiltro, estadoFiltro])

  // Listas para os dropdowns
  const categorias = useMemo(() =>
    dados ? Array.from(new Set(dados.artigos.map((a) => a.categoria))).sort() : [], [dados]
  )

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="p-8 space-y-6">

      {/* ─── Cabeçalho ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inventário</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visão unificada de stock nas lojas da BragaConvenience
        </p>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────────────── */}
      <section className="grid grid-cols-4 gap-4">
        <KPICard
          label="Total Artigos"
          valor={dados?.artigos.length ?? 0}
          cor="slate"
          icone="📦"
          loading={loading}
        />
        <KPICard
          label="Crítico (sem stock)"
          valor={dados?.kpis?.criticos ?? 0}
          cor="red"
          icone="⚠"
          loading={loading}
        />
        <KPICard
          label="Alerta (stock baixo)"
          valor={dados?.kpis?.alertas ?? 0}
          cor="amber"
          icone="⚡"
          loading={loading}
        />
        <KPICard
          label="OK"
          valor={dados?.kpis?.ok ?? 0}
          cor="green"
          icone="✓"
          loading={loading}
        />
      </section>

      {/* ─── Filtros ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Tabs de loja */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLojaFiltro('todas')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              lojaFiltro === 'todas'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Todas as lojas
          </button>
          {dados?.lojas.map((loja) => (
            <button
              key={loja.id}
              type="button"
              onClick={() => setLojaFiltro(loja.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                lojaFiltro === loja.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {loja.nome}
            </button>
          ))}
        </div>

        {/* Linha 2: dropdowns + pesquisa */}
        <div className="flex gap-3">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-slate-700"
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-slate-700"
          >
            <option value="todos">Todos os estados</option>
            <option value="Critico">⚠ Crítico</option>
            <option value="Alerta">⚡ Alerta</option>
            <option value="OK">✓ OK</option>
          </select>

          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Pesquisar por EAN, artigo ou categoria..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Botão limpar filtros — só aparece quando há filtro activo */}
          {(lojaFiltro !== 'todas' || categoriaFiltro !== 'todas' || estadoFiltro !== 'todos' || filtro) && (
            <button
              type="button"
              onClick={() => {
                setLojaFiltro('todas')
                setCategoriaFiltro('todas')
                setEstadoFiltro('todos')
                setFiltro('')
              }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition whitespace-nowrap"
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* ─── Estados ─────────────────────────────────────────────── */}
      {loading && !dados && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar inventário...</div>
        </div>
      )}

      {erro && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold mb-2">Erro ao carregar inventário</div>
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

      {/* ─── Tabela ─────────────────────────────────────────────── */}
      {!loading && !erro && dados && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {itensFiltrados.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-3xl mb-2">📦</div>
                <div className="text-sm font-medium text-slate-900">
                  {dados.artigos.length === 0
                    ? 'Nenhum produto no catálogo'
                    : 'Nenhum produto corresponde ao filtro'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {dados.artigos.length === 0
                    ? 'Crie produtos no Catálogo para começar.'
                    : 'Tente um termo diferente.'}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <Th>EAN</Th>
                      <Th>Artigo</Th>
                      <Th>Categoria</Th>
                      <Th className="text-right">Total</Th>
                      {/* Colunas Dinâmicas de Lojas */}
                      {dados.lojas.map(l => (
                        <Th key={l.id} className="text-right">{l.nome.toUpperCase()}</Th>
                      ))}
                      <Th className="text-center">Estado</Th>
                      <Th className="text-center">Ações</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itensFiltrados.map((item) => (
                      <tr key={item.ean} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-xs font-mono text-slate-600">{item.ean}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.artigo}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right tabular-nums">
                          {item.total}
                        </td>
                        {/* Valores Dinâmicos de Stock */}
                        {dados.lojas.map(loja => {
                          const stock = item.stockPorLoja[loja.id] ?? 0;
                          return (
                            <td key={loja.id} className={`px-4 py-3 text-sm text-right tabular-nums ${corStock(stock)}`}>
                              {stock}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          <EstadoBadge estado={item.estado} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setProdutoLotesAberto(item.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            Ver Lotes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé da tabela */}
            {itensFiltrados.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  A mostrar {itensFiltrados.length} de {dados.artigos.length} artigos
                  {lojaFiltro !== 'todas' && ` · ${dados.lojas.find(l => l.id === lojaFiltro)?.nome}`}
                  {categoriaFiltro !== 'todas' && ` · ${categoriaFiltro}`}
                  {estadoFiltro !== 'todos' && ` · ${estadoFiltro}`}
                </span>
                <button
                  type="button"
                  onClick={carregar}
                  className="text-slate-600 hover:text-slate-900 font-medium"
                >
                  ↻ Actualizar
                </button>
              </div>
            )}
          </div>

          {/* Estado de Sincronização */}
          <div className="text-xs text-slate-500 mt-4 px-2">
            Última sincronização:{' '}
            {dados.lojas.map(l => (
              <span key={l.id} className="ml-3">
                {l.nome}: <span className="font-medium">{formatarTempoRelativo(dados.syncStatus[l.id] ?? null)}</span>
              </span>
            ))}
          </div>
          {/* Modal de lotes */}
          {produtoLotesAberto !== null && (
            <LotesProdutoModal
              produtoId={produtoLotesAberto}
              onClose={() => setProdutoLotesAberto(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════ SUBCOMPONENTES ═══════════════════════

interface KPICardProps {
  label:   string
  valor:   number
  cor:     'slate' | 'red' | 'amber' | 'green'
  icone:   string
  loading: boolean
}

function KPICard({ label, valor, cor, icone, loading }: KPICardProps) {
  const cores = {
    slate: { bg: 'bg-slate-50',  border: 'border-slate-200', text: 'text-slate-900', accent: 'bg-slate-100' },
    red:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   accent: 'bg-red-100'   },
    amber: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-100' },
    green: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-100' }
  }[cor]

  return (
    <div className={`${cores.bg} ${cores.border} border rounded-xl p-5 flex items-start gap-4`}>
      <div className={`w-11 h-11 ${cores.accent} rounded-lg flex items-center justify-center text-xl`}>
        {icone}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</div>
        <div className={`text-3xl font-semibold mt-1 tabular-nums ${cores.text}`}>
          {loading ? '—' : valor}
        </div>
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const config = {
    Critico: { bg: 'bg-red-100',   text: 'text-red-800',   label: 'Crítico' },
    Alerta:  { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Alerta' },
    OK:      { bg: 'bg-green-100', text: 'text-green-800', label: 'OK' }
  }[estado as 'Critico' | 'Alerta' | 'OK'] || { bg: 'bg-slate-100', text: 'text-slate-800', label: estado }

  return (
    <span className={`inline-block ${config.bg} ${config.text} text-xs font-medium px-2.5 py-1 rounded-full`}>
      {config.label}
    </span>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3 ${className}`}>
      {children}
    </th>
  )
}

// ═══════════════════════ HELPERS ═══════════════════════

/** Retorna a classe Tailwind de cor para um valor de stock individual de loja. */
function corStock(stock: number): string {
  if (stock <= LIMITE_CRITICO_LOJA) return 'text-red-700 font-semibold'
  if (stock <= LIMITE_ALERTA_LOJA)  return 'text-amber-700 font-medium'
  return 'text-green-700'
}