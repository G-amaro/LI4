/**
 * RelatoriosPage — Relatórios Financeiros (UC12).
 *
 * Filtros funcionais (client-side):
 *   - Data De / Até (intervalo)
 *   - Loja (dinâmica, extraída dos dados)
 *   - Motivo (só na tab de quebras)
 *
 * KPI Cards actualizam com os filtros aplicados.
 * Tabs com contagem filtrada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RelatoriosService } from '../services/RelatoriosService'
import type {
  ResumoFinanceiro,
  FechoCaixaRelatorio,
  QuebraRelatorio
} from '../types/relatorios'

type TabAtiva = 'auditoria' | 'quebras'

export function RelatoriosPage() {
  const [resumo,  setResumo]  = useState<ResumoFinanceiro | null>(null)
  const [fechos,  setFechos]  = useState<FechoCaixaRelatorio[]>([])
  const [quebras, setQuebras] = useState<QuebraRelatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)
  const [tab,     setTab]     = useState<TabAtiva>('auditoria')

  // Filtros
  const [filtroDe,     setFiltroDe]     = useState('')
  const [filtroAte,    setFiltroAte]    = useState('')
  const [filtroLoja,   setFiltroLoja]   = useState('todas')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setErro(null)
    try {
      const [r, f, q] = await Promise.all([
        RelatoriosService.obterResumo(),
        RelatoriosService.listarFechos(),
        RelatoriosService.listarQuebras()
      ])
      setResumo(r)
      setFechos(f)
      setQuebras(q)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  // ─── Lojas únicas (para dropdown dinâmico) ───────────────────────
  const lojasUnicas = useMemo(() => {
    const set = new Set([
      ...fechos.map((f) => f.loja),
      ...quebras.map((q) => q.loja)
    ])
    return Array.from(set).sort()
  }, [fechos, quebras])

  // ─── Motivos únicos ──────────────────────────────────────────────
  const motivosUnicos = useMemo(() =>
    Array.from(new Set(quebras.map((q) => q.motivo))).sort()
  , [quebras])

  // ─── Filtro: helper de data ──────────────────────────────────────
  const dentroDoPeriodo = (dataStr: string): boolean => {
    // dataStr pode ser "DD/MM/YYYY" ou "YYYY-MM-DD"
    let d: Date
    if (dataStr.includes('/')) {
      const [dia, mes, ano] = dataStr.split('/')
      d = new Date(`${ano}-${mes}-${dia}`)
    } else {
      d = new Date(dataStr)
    }
    if (isNaN(d.getTime())) return true // se não conseguir parsear, não filtra

    if (filtroDe) {
      const de = new Date(filtroDe)
      if (d < de) return false
    }
    if (filtroAte) {
      const ate = new Date(filtroAte)
      ate.setHours(23, 59, 59)
      if (d > ate) return false
    }
    return true
  }

  // ─── Dados filtrados ─────────────────────────────────────────────
  const fechosFiltrados = useMemo(() =>
    fechos.filter((f) => {
      if (filtroLoja !== 'todas' && f.loja !== filtroLoja) return false
      if (!dentroDoPeriodo(f.data)) return false
      return true
    })
  , [fechos, filtroLoja, filtroDe, filtroAte])

  const quebrasFiltradas = useMemo(() =>
    quebras.filter((q) => {
      if (filtroLoja   !== 'todas' && q.loja   !== filtroLoja)   return false
      if (filtroMotivo !== 'todos' && q.motivo !== filtroMotivo) return false
      if (!dentroDoPeriodo(q.data)) return false
      return true
    })
  , [quebras, filtroLoja, filtroMotivo, filtroDe, filtroAte])

  // ─── KPIs dos dados filtrados ────────────────────────────────────
  const totalDiscrepanciasFiltrado = useMemo(() =>
    fechosFiltrados.reduce((acc, f) => acc + f.discrepancia, 0)
  , [fechosFiltrados])

  const totalQuebrasFiltrado = useMemo(() =>
    quebrasFiltradas.reduce((acc, q) => acc + q.perdaTotal, 0)
  , [quebrasFiltradas])

  // ─── Há filtros activos? ─────────────────────────────────────────
  const temFiltroActivo = !!(filtroDe || filtroAte ||
  filtroLoja !== 'todas' || filtroMotivo !== 'todos')

  const limparFiltros = () => {
    setFiltroDe('')
    setFiltroAte('')
    setFiltroLoja('todas')
    setFiltroMotivo('todos')
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">

      {/* ─── Cabeçalho ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-500 mt-1">
            Auditoria de fechos de caixa e perdas por quebras
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

      {/* ─── Filtros ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-5 gap-3 items-end">

          {/* De */}
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

          {/* Até */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Até
            </label>
            <input
              type="date"
              value={filtroAte}
              min={filtroDe || undefined}
              onChange={(e) => setFiltroAte(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Loja */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Loja
            </label>
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
            >
              <option value="todas">Todas as lojas</option>
              {lojasUnicas.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Motivo (só relevante para quebras) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Motivo <span className="text-slate-400 normal-case font-normal">(quebras)</span>
            </label>
            <select
              value={filtroMotivo}
              onChange={(e) => setFiltroMotivo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
            >
              <option value="todos">Todos os motivos</option>
              {motivosUnicos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Limpar */}
          <div>
            <button
              type="button"
              onClick={limparFiltros}
              disabled={!temFiltroActivo}
              className="w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ✕ Limpar filtros
            </button>
          </div>
        </div>

        {/* Indicador de filtros activos */}
        {temFiltroActivo && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span>🔍</span>
            <span className="font-semibold">Filtros activos:</span>
            {filtroDe && <span>De {filtroDe}</span>}
            {filtroAte && <span>até {filtroAte}</span>}
            {filtroLoja   !== 'todas' && <span>· Loja: {filtroLoja}</span>}
            {filtroMotivo !== 'todos' && <span>· Motivo: {filtroMotivo}</span>}
          </div>
        )}
      </div>

      {/* ─── Estados de loading / erro ─────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar relatórios...</div>
        </div>
      )}

      {erro && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold mb-2">Erro ao carregar relatórios</div>
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

      {/* ─── KPIs + Tabs ───────────────────────────────────────── */}
      {!loading && !erro && resumo && (
        <>
          {/* KPI Cards — valores filtrados */}
          <section className="grid grid-cols-2 gap-4">
            <KPICard
              label="Discrepâncias em Loja"
              valor={totalDiscrepanciasFiltrado}
              variante="vermelho"
              sublabel={`${fechosFiltrados.length} fecho(s) no período${temFiltroActivo ? ' filtrado' : ''}`}
            />
            <KPICard
              label="Valor Total de Quebras"
              valor={totalQuebrasFiltrado}
              variante="cinzento"
              sublabel={`${quebrasFiltradas.length} quebra(s) no período${temFiltroActivo ? ' filtrado' : ''}`}
              forcaSinalPositivo
            />
          </section>

          {/* Tabs com contagem filtrada */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <TabPill
              ativa={tab === 'auditoria'}
              onClick={() => setTab('auditoria')}
              label="Auditoria de fechos de caixa"
              contagem={fechosFiltrados.length}
              total={fechos.length}
              filtrado={temFiltroActivo}
            />
            <TabPill
              ativa={tab === 'quebras'}
              onClick={() => setTab('quebras')}
              label="Relatório de quebras"
              contagem={quebrasFiltradas.length}
              total={quebras.length}
              filtrado={temFiltroActivo}
            />
          </div>

          {/* Tabelas com dados filtrados */}
          {tab === 'auditoria' && (
            <TabelaAuditoria fechos={fechosFiltrados} temFiltro={temFiltroActivo} />
          )}
          {tab === 'quebras' && (
            <TabelaQuebras quebras={quebrasFiltradas} temFiltro={temFiltroActivo} />
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════ KPI CARD ═══════════════════════

interface KPICardProps {
  label:              string
  valor:              number
  variante:           'vermelho' | 'cinzento'
  sublabel:           string
  forcaSinalPositivo?: boolean
}

function KPICard({ label, valor, variante, sublabel, forcaSinalPositivo }: KPICardProps) {
  const cores = variante === 'vermelho'
    ? { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   muted: 'text-red-600' }
    : { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', muted: 'text-slate-600' }

  const valorFormatado = forcaSinalPositivo
    ? formatarMoeda(Math.abs(valor))
    : (valor < 0 ? `-${formatarMoeda(Math.abs(valor))}` : formatarMoeda(valor))

  return (
    <div className={`${cores.bg} ${cores.border} border rounded-xl p-5`}>
      <div className={`text-xs font-medium ${cores.muted} uppercase tracking-wide`}>{label}</div>
      <div className={`text-3xl font-semibold mt-2 tabular-nums ${cores.text}`}>{valorFormatado}</div>
      <div className={`text-xs ${cores.muted} mt-1`}>{sublabel}</div>
    </div>
  )
}

// ═══════════════════════ TAB PILL ═══════════════════════

interface TabPillProps {
  ativa:    boolean
  onClick:  () => void
  label:    string
  contagem: number
  total:    number
  filtrado: boolean
}

function TabPill({ ativa, onClick, label, contagem, total, filtrado }: TabPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition relative -mb-px ${
        ativa
          ? 'bg-white text-slate-900 border border-slate-200 border-b-white'
          : 'text-slate-500 hover:text-slate-700 border border-transparent'
      }`}
    >
      {label}
      <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${
        ativa ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
      }`}>
        {filtrado && contagem !== total ? `${contagem}/${total}` : contagem}
      </span>
    </button>
  )
}

// ═══════════════════════ TABELA AUDITORIA ═══════════════════════

function TabelaAuditoria({ fechos, temFiltro }: { fechos: FechoCaixaRelatorio[]; temFiltro: boolean }) {
  if (fechos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-3xl mb-2">💰</div>
        <div className="text-sm font-medium text-slate-900">
          {temFiltro ? 'Nenhum fecho corresponde aos filtros' : 'Sem fechos de caixa'}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {temFiltro ? 'Tente alargar o período ou alterar os filtros.' : 'Os fechos registados no POS aparecerão aqui.'}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Data</Th>
              <Th>Loja</Th>
              <Th>Operador (Turno)</Th>
              <Th className="text-right">Valor teórico (Sistema)</Th>
              <Th className="text-right">Valor declarado (Gaveta)</Th>
              <Th className="text-right">Discrepância</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fechos.map((f, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 text-sm text-slate-700">{f.data}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.loja}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{f.operadorTurno}</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">
                  {formatarMoeda(f.valorTeorico)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">
                  {formatarMoeda(f.valorDeclarado)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <DiscrepanciaValor valor={f.discrepancia} />
                </td>
              </tr>
            ))}
          </tbody>
          {/* Rodapé com totais */}
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-slate-600 text-right uppercase tracking-wide">
                Total discrepância ({fechos.length} {fechos.length === 1 ? 'fecho' : 'fechos'})
              </td>
              <td className="px-4 py-2 text-right">
                <DiscrepanciaValor
                  valor={fechos.reduce((acc, f) => acc + f.discrepancia, 0)}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function DiscrepanciaValor({ valor }: { valor: number }) {
  if (Math.abs(valor) < 0.01) {
    return <span className="text-sm font-semibold text-green-700">{formatarMoeda(0)}</span>
  }
  return (
    <span className="text-sm font-semibold text-red-700">
      {valor < 0 ? '-' : '+'}{formatarMoeda(Math.abs(valor))}
    </span>
  )
}

// ═══════════════════════ TABELA QUEBRAS ═══════════════════════

function TabelaQuebras({ quebras, temFiltro }: { quebras: QuebraRelatorio[]; temFiltro: boolean }) {
  if (quebras.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="text-3xl mb-2">📉</div>
        <div className="text-sm font-medium text-slate-900">
          {temFiltro ? 'Nenhuma quebra corresponde aos filtros' : 'Sem quebras registadas'}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {temFiltro ? 'Tente alargar o período ou alterar os filtros.' : 'As quebras registadas no POS aparecerão aqui.'}
        </div>
      </div>
    )
  }

  const totalPerda = quebras.reduce((acc, q) => acc + q.perdaTotal, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Data</Th>
              <Th>Loja</Th>
              <Th>Artigo</Th>
              <Th className="text-right">QTD</Th>
              <Th className="text-right">Perda €</Th>
              <Th>Motivo</Th>
              <Th>Operador</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quebras.map((q, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 text-sm text-slate-700">{q.data}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{q.loja}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.artigo}</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{q.quantidade}</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums">
                  <div className="text-slate-400 text-xs">{formatarMoeda(q.precoCusto)} × {q.quantidade}</div>
                  <div className="font-semibold text-red-700">−{formatarMoeda(q.perdaTotal)}</div>
                </td>
                <td className="px-4 py-3"><MotivoBadge motivo={q.motivo} /></td>
                <td className="px-4 py-3 text-sm text-slate-700">{q.operadorTurno}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-slate-600 text-right uppercase tracking-wide">
                Total ({quebras.length} {quebras.length === 1 ? 'quebra' : 'quebras'})
              </td>
              <td className="px-4 py-2 text-right text-sm font-bold text-red-700 tabular-nums">
                −{formatarMoeda(totalPerda)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function MotivoBadge({ motivo }: { motivo: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    'Furto':                   { bg: 'bg-red-100',    text: 'text-red-800'    },
    'Furto / Desaparecimento': { bg: 'bg-red-100',    text: 'text-red-800'    },
    'Dano Físico':             { bg: 'bg-orange-100', text: 'text-orange-800' },
    'Dano / Quebra Física':    { bg: 'bg-orange-100', text: 'text-orange-800' },
    'Validade':                { bg: 'bg-amber-100',  text: 'text-amber-800'  },
    'Validade Expirada':       { bg: 'bg-amber-100',  text: 'text-amber-800'  },
  }
  const c = config[motivo] ?? { bg: 'bg-slate-100', text: 'text-slate-700' }
  return (
    <span className={`inline-block ${c.bg} ${c.text} text-xs font-medium px-2.5 py-1 rounded-full`}>
      {motivo}
    </span>
  )
}

// ═══════════════════════ HELPERS ═══════════════════════

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3 ${className}`}>
      {children}
    </th>
  )
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2
  }).format(valor)
}
