/**
 * TransferenciasPage (UC10) — Transferências entre Lojas.
 *
 * Redesign Fase 3:
 *   - Header azul-marinho consistente com outras páginas
 *   - Tabs com badge de guias pendentes
 *   - Cards ricos para guias pendentes (nome da loja, tempo em trânsito)
 *   - Barra de progresso visual na confirmação de recepção
 *   - Envio em 2 colunas (pesquisa/lista | resumo/acção)
 *   - Ecrãs de sucesso consistentes
 *
 * Toda a lógica está preservada da versão anterior.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { Toast, ToastData } from '../components/Toast'
import logoUrl from '../assets/logo.png'
import { ProdutoImagem } from '../components/ProdutoImagem'
import type {
  OperadorSessao,
  ProdutoLocal,
  EnvioInput,
  GuiaEnvio,
  RececaoTransferenciaInput,
  TransferenciaResultado
} from '../../../shared/types'

interface TransferenciasPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

type Tab = 'envio' | 'rececao'

// ─── Helpers ──────────────────────────────────────────────────────


/** Tempo em trânsito de forma legível */
function tempoEmTransito(dataMovimento: string): string {
  const diffMs  = Date.now() - new Date(dataMovimento).getTime()
  const minutos = Math.floor(diffMs / 60_000)
  if (minutos < 60)  return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24)    return `${horas}h`
  const dias = Math.floor(horas / 24)
  return `${dias} dia${dias === 1 ? '' : 's'}`
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function TransferenciasPage({ operador, onVoltar }: TransferenciasPageProps) {
  const [tab, setTab]                         = useState<Tab>('envio')
  const [toast, setToast]                     = useState<ToastData | null>(null)
  const [numGuiasPendentes, setNumGuiasPendentes] = useState(0)

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ─── HEADER ─── */}
      <header className="bg-blue-900 text-white flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="bg-blue-800 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded transition-colors"
            >
              ← Voltar
            </button>
            <div className="bg-white rounded p-1 flex-shrink-0">
              <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold">Transferências · {operador.lojaBaseNome}</div>
              <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
            </div>
          </div>
          <SyncStatusBadge tema="dark" />
        </div>

        {/* Tabs no header */}
        <div className="flex gap-1 px-4 pb-0">
          <TabBtn
            activo={tab === 'envio'}
            onClick={() => setTab('envio')}
            icone="📤"
            label="Enviar"
            cor="indigo"
          />
          <TabBtn
            activo={tab === 'rececao'}
            onClick={() => setTab('rececao')}
            icone="📥"
            label="Receber"
            cor="emerald"
            badge={numGuiasPendentes > 0 ? numGuiasPendentes : undefined}
          />
        </div>
      </header>

      {/* ─── CONTEÚDO ─── */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'envio' && (
          <TabEnvio
            operador={operador}
            setToast={setToast}
          />
        )}
        {tab === 'rececao' && (
          <TabRececao
            operador={operador}
            setToast={setToast}
            onNumPendentesChange={setNumGuiasPendentes}
          />
        )}
      </main>

      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ─── Tab button ────────────────────────────────────────────────────

interface TabBtnProps {
  activo:  boolean
  onClick: () => void
  icone:   string
  label:   string
  cor:     'indigo' | 'emerald'
  badge?:  number
}

function TabBtn({ activo, onClick, icone, label, cor, badge }: TabBtnProps) {
  const activeCor = cor === 'indigo'
    ? 'bg-white text-indigo-900 border-t-2 border-x border-indigo-200'
    : 'bg-white text-emerald-900 border-t-2 border-x border-emerald-200'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
        activo
          ? activeCor
          : 'text-blue-200 hover:text-white hover:bg-blue-800/40'
      }`}
    >
      <span>{icone}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  TAB 1 — ENVIO
// ═══════════════════════════════════════════════════════════════════

interface LinhaEnvio {
  produtoId:        number
  ean:              string
  artigo:           string
  categoria:        string
  stockDisponivel:  number
  quantidade:       number
  imagemUrl?:       string | null
}

function TabEnvio({
  operador,
  setToast
}: {
  operador: OperadorSessao
  setToast: (t: ToastData | null) => void
}) {
  const [lojasDestino, setLojasDestino]       = useState<Array<{ id: number; nome: string }>>([])
  const [lojaDestinoId, setLojaDestinoId]     = useState<number>(0)
  const [documento, setDocumento]             = useState('')
  const [observacoes, setObservacoes]         = useState('')
  const [termo, setTermo]                     = useState('')
  const [sugestoes, setSugestoes]             = useState<ProdutoLocal[]>([])
  const [mostraSugestoes, setMostraSugestoes] = useState(false)
  const [linhas, setLinhas]                   = useState<LinhaEnvio[]>([])
  const [aConfirmar, setAConfirmar]           = useState(false)
  const [resultado, setResultado]             = useState<TransferenciaResultado | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await window.api.transferencias.listarLojas()
      if (r.ok) {
        // Excluir a loja actual da lista de destinos
        const outras = r.data.filter((l) => l.id !== operador.lojaBaseId)
        setLojasDestino(outras)
        if (outras.length > 0) setLojaDestinoId(outras[0].id)
      }
    })()
  }, [operador.lojaBaseId])

  useEffect(() => {
    let cancelado = false
    if (termo.trim().length < 2) { setSugestoes([]); return }
    const delay = setTimeout(async () => {
      const r = await window.api.catalogo.pesquisar(termo.trim())
      if (!cancelado && r.ok) {
        const jaAdicionados = new Set(linhas.map((l) => l.produtoId))
        setSugestoes(r.data.filter((p) => !jaAdicionados.has(p.id)).slice(0, 8))
      }
    }, 150)
    return () => { cancelado = true; clearTimeout(delay) }
  }, [termo, linhas])

  const adicionar = async (produto: ProdutoLocal): Promise<void> => {
  const stockRes  = await window.api.stock.porProduto(produto.id)
  const stockDisp = stockRes.ok ? stockRes.data : 0

  setLinhas([...linhas, {
    produtoId:       produto.id,
    ean:             produto.ean,
    artigo:          produto.artigo,
    categoria:       produto.categoria,
    stockDisponivel: stockDisp,
    quantidade:      1,
    imagemUrl:       produto.imagemUrl ?? null
  }])
  setTermo('')
  setSugestoes([])
  setMostraSugestoes(false)
}

  const alterarQtd = (produtoId: number, qtd: number): void => {
    setLinhas(linhas.map((l) =>
      l.produtoId === produtoId ? { ...l, quantidade: Math.max(1, Math.floor(qtd) || 1) } : l
    ))
  }

  const ajustarQtd = (produtoId: number, delta: number): void => {
    setLinhas(linhas.map((l) =>
      l.produtoId === produtoId ? { ...l, quantidade: Math.max(1, l.quantidade + delta) } : l
    ))
  }

  const remover = (produtoId: number): void => {
    setLinhas(linhas.filter((l) => l.produtoId !== produtoId))
  }

  const handleConfirmar = async (): Promise<void> => {
    if (linhas.length === 0) { setToast({ kind: 'error', message: 'Adicione pelo menos um artigo.' }); return }
    if (lojaDestinoId < 1)  { setToast({ kind: 'error', message: 'Seleccione a loja destino.' }); return }

    // Validar stock suficiente
    const semStock = linhas.find((l) => l.quantidade > l.stockDisponivel)
    if (semStock) {
      setToast({ kind: 'error', message: `Stock insuficiente: "${semStock.artigo}" (disponível: ${semStock.stockDisponivel})` })
      return
    }

    const input: EnvioInput = {
      operadorId:          operador.id,
      lojaDestinoId,
      documentoReferencia: documento.trim() || null,
      observacoes:         observacoes.trim() || null,
      linhas: linhas.map((l) => ({ produtoId: l.produtoId, quantidade: l.quantidade }))
    }

    setAConfirmar(true)
    const r = await window.api.transferencias.registarEnvio(input)
    setAConfirmar(false)

    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    setResultado(r.data)
  }

  const reset = (): void => {
    setDocumento(''); setObservacoes(''); setTermo('')
    setSugestoes([]); setLinhas([]); setResultado(null)
  }

  const totalUnidades = useMemo(() => linhas.reduce((acc, l) => acc + l.quantidade, 0), [linhas])
  const lojaNomeDestino = lojasDestino.find((l) => l.id === lojaDestinoId)?.nome ?? '—'

  // ─── Ecrã de sucesso ─────────────────────────────────────────────
  if (resultado) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-700 text-white px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-indigo-700 text-3xl font-bold flex-shrink-0">
              📤
            </div>
            <div>
              <div className="text-xl font-bold">Guia emitida com sucesso!</div>
              <div className="text-sm text-indigo-200 mt-0.5">
                {totalUnidades} unid. → {lojaNomeDestino}
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
              Guia de Transferência
            </div>

            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
              <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wide mb-1">
                ID da Guia — partilhe com a loja destino
              </div>
              <div className="text-indigo-900 font-mono text-sm break-all select-all bg-white rounded px-3 py-2 border border-indigo-200">
                {resultado.id}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <InfoRow label="Data"          valor={new Date(resultado.dataMovimento).toLocaleString('pt-PT')} />
              <InfoRow label="Destino"       valor={lojaNomeDestino} />
              <InfoRow label="Artigos"       valor={String(resultado.numeroLinhas)} />
              <InfoRow label="Unidades"      valor={`−${resultado.totalUnidades}`} destaque="indigo" />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-800">
              <span>⚠</span>
              Pendente de sincronização com a Sede
            </div>

            <button
              type="button"
              onClick={reset}
              className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-3 rounded-xl mt-2 transition"
            >
              Novo Envio
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Formulário de envio ──────────────────────────────────────────
  return (
    <div className="h-full grid grid-cols-[1fr_minmax(200px,260px)] gap-3 p-3 overflow-hidden" style={{ maxHeight: 'calc(100vh - 112px)' }}>

      {/* COLUNA ESQUERDA — destino + pesquisa + lista */}
      <div className="flex flex-col gap-3 overflow-hidden">

        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Loja Destino <span className="text-red-500">*</span>
              </label>
              <select
                value={lojaDestinoId}
                onChange={(e) => setLojaDestinoId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
              >
                {lojasDestino.length === 0 && <option value={0}>Sem lojas</option>}
                {lojasDestino.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Nº Guia <span className="text-slate-400 normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="GT-2026-04-28-001"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Observações <span className="text-slate-400 normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Reforço de stock..."
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Pesquisa + lista */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">

          {/* Header da lista */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={termo}
                onChange={(e) => { setTermo(e.target.value); setMostraSugestoes(true) }}
                onFocus={() => setMostraSugestoes(true)}
                onBlur={() => setTimeout(() => setMostraSugestoes(false), 150)}
                placeholder="Pesquisar produto por nome ou EAN..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
              />

              {mostraSugestoes && sugestoes.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-10">
                  {sugestoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void adicionar(p)}
                      className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 border-b border-slate-100 last:border-0 flex items-center gap-3"
                    >
                      <ProdutoImagem produtoId={p.id} imagemUrl={p.imagemUrl} categoria={p.categoria} className="w-8 h-8" emojiSize="text-2xl" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{p.artigo}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.ean}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cabeçalho tabela */}
          <div className="grid grid-cols-[1fr_120px_120px_28px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex-shrink-0">
            <span>Artigo</span>
            <span className="text-right">Stock Disp.</span>
            <span className="text-center">QTD Envio</span>
            <span></span>
          </div>

          {/* Linhas */}
          <div className="flex-1 overflow-y-auto">
            {linhas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <div className="text-4xl">📤</div>
                <div>Pesquise e adicione produtos acima</div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {linhas.map((linha) => {
                  const emFalta = linha.quantidade > linha.stockDisponivel
                  return (
                    <li
                      key={linha.produtoId}
                      className={`grid grid-cols-[1fr_120px_120px_28px] gap-2 px-4 py-3 items-center ${
                        emFalta ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Artigo */}
                      <div>
                        <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-2">
                          <ProdutoImagem produtoId={linha.produtoId} imagemUrl={linha.imagemUrl} categoria={linha.categoria} className="w-6 h-6" emojiSize="text-base" />
                          <span className="truncate">{linha.artigo}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{linha.ean}</div>
                      </div>

                      {/* Stock disponível */}
                      <div className="text-right">
                        <span className={`text-sm font-bold tabular-nums ${
                          emFalta ? 'text-red-600' : 'text-slate-700'
                        }`}>
                          {linha.stockDisponivel}
                        </span>
                        <div className="text-[10px] text-slate-500">disponível</div>
                        {emFalta && (
                          <div className="text-[10px] text-red-600 font-semibold">⚠ insuficiente</div>
                        )}
                      </div>

                      {/* Controlo de quantidade */}
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => ajustarQtd(linha.produtoId, -1)}
                          disabled={linha.quantidade <= 1}
                          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded text-sm font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={linha.quantidade}
                          onChange={(e) => alterarQtd(linha.produtoId, Number(e.target.value))}
                          className={`w-12 text-center text-base font-bold tabular-nums rounded border focus:outline-none py-1 ${
                            emFalta
                              ? 'bg-red-50 border-red-400 text-red-800'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => ajustarQtd(linha.produtoId, +1)}
                          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded text-sm font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Remover */}
                      <button
                        type="button"
                        onClick={() => remover(linha.produtoId)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA — resumo + confirmar */}
      <div className="flex flex-col gap-3">

        {/* Info da transferência */}
        {lojaDestinoId > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <div className="text-xs text-indigo-700 uppercase tracking-wide font-semibold">Destino</div>
            <div className="text-lg font-bold text-indigo-900 mt-0.5">{lojaNomeDestino}</div>
            <div className="text-xs text-indigo-600 mt-1">
              {operador.lojaBaseNome} → {lojaNomeDestino}
            </div>
          </div>
        )}

        {/* Alertas */}
        {linhas.some((l) => l.quantidade > l.stockDisponivel) && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-800">
            <div className="font-semibold flex items-center gap-1.5">
              <span>⚠</span> Stock insuficiente
            </div>
            <div className="mt-0.5">Reduza as quantidades assinaladas a vermelho.</div>
          </div>
        )}

        <div className="flex-1" />

        {/* Totais */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-600 uppercase tracking-wide font-semibold">A sair</div>
          <div className="text-3xl font-bold text-indigo-900 tabular-nums mt-0.5">−{totalUnidades}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {linhas.length} {linhas.length === 1 ? 'artigo' : 'artigos'}
          </div>
        </div>

        {/* Botão confirmar */}
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={aConfirmar || linhas.length === 0 || linhas.some((l) => l.quantidade > l.stockDisponivel)}
          className="bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-6 px-3 font-bold text-base shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2"
        >
          <span className="text-3xl">📤</span>
          <span>{aConfirmar ? 'A processar...' : 'Gerar Guia'}</span>
          {linhas.length > 0 && !aConfirmar && (
            <span className="text-xs font-normal text-indigo-200">e registar saída</span>
          )}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  TAB 2 — RECEPÇÃO
// ═══════════════════════════════════════════════════════════════════

type GuiaPendente = {
  id:                   string
  lojaOrigemId:         number
  dataMovimento:        string
  documentoReferencia:  string | null
  numeroLinhas:         number
  totalUnidades:        number
}

function TabRececao({
  operador,
  setToast,
  onNumPendentesChange
}: {
  operador:              OperadorSessao
  setToast:              (t: ToastData | null) => void
  onNumPendentesChange:  (n: number) => void
}) {
  const [idGuia, setIdGuia]                     = useState('')
  const [aProcurar, setAProcurar]               = useState(false)
  const [guia, setGuia]                         = useState<GuiaEnvio | null>(null)
  const [quantidades, setQuantidades]           = useState<Record<number, number>>({})
  const [observacoes, setObservacoes]           = useState('')
  const [aConfirmar, setAConfirmar]             = useState(false)
  const [resultado, setResultado]               = useState<TransferenciaResultado | null>(null)
  const [aBuscar, setABuscar]                   = useState(false)
  const [guiasPendentes, setGuiasPendentes]     = useState<GuiaPendente[]>([])
  const [lojasDict, setLojasDict]               = useState<Record<number, string>>({})

  const refrescarPendentes = useCallback(async (): Promise<void> => {
    const r = await window.api.transferencias.listarGuiasPendentes()
    if (r.ok) {
      setGuiasPendentes(r.data)
      onNumPendentesChange(r.data.length)
    }
  }, [onNumPendentesChange])

  useEffect(() => {
    void refrescarPendentes()
    // Carregar mapa loja_id → nome
    void (async () => {
      const r = await window.api.transferencias.listarLojas()
      if (r.ok) {
        const dict: Record<number, string> = {}
        r.data.forEach((l) => { dict[l.id] = l.nome })
        setLojasDict(dict)
      }
    })()
  }, [refrescarPendentes])

  const handleBuscarGuias = async (): Promise<void> => {
    setABuscar(true)
    setToast(null)
    const r = await window.api.transferencias.sincronizarGuias()
    setABuscar(false)

    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    await refrescarPendentes()

    const { novas, total } = r.data
    if (novas === 0 && total === 0) {
      setToast({ kind: 'success', message: 'Sem novas guias em trânsito.' })
    } else if (novas === 0) {
      setToast({ kind: 'info', message: `${total} guia(s) já conhecida(s).` })
    } else {
      setToast({ kind: 'success', message: `${novas} nova(s) guia(s) importada(s)!` })
    }
  }

  const handleProcurar = async (): Promise<void> => {
    const id = idGuia.trim()
    if (!id) { setToast({ kind: 'error', message: 'Indique o ID da guia.' }); return }
    setAProcurar(true)
    const r = await window.api.transferencias.obterGuia(id)
    setAProcurar(false)
    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    if (!r.data) { setToast({ kind: 'error', message: 'Guia não encontrada.' }); return }
    if (r.data.jaRecebida) { setToast({ kind: 'error', message: 'Esta guia já foi recebida.' }); return }
    abrirGuia(r.data)
  }

  const abrirGuiaDireta = async (guiaId: string): Promise<void> => {
    setAProcurar(true)
    const r = await window.api.transferencias.obterGuia(guiaId)
    setAProcurar(false)
    if (!r.ok || !r.data) { setToast({ kind: 'error', message: 'Erro ao abrir guia.' }); return }
    abrirGuia(r.data)
  }

  const abrirGuia = (g: GuiaEnvio): void => {
    setGuia(g)
    const qtdsIniciais: Record<number, number> = {}
    for (const l of g.linhas) qtdsIniciais[l.produtoId] = l.quantidade
    setQuantidades(qtdsIniciais)
  }

  const alterarQtd = (produtoId: number, qtd: number): void => {
    setQuantidades({ ...quantidades, [produtoId]: Math.max(0, Math.floor(qtd) || 0) })
  }

  const handleConfirmar = async (): Promise<void> => {
    if (!guia) return
    const linhas = Object.entries(quantidades)
      .filter(([, qtd]) => qtd > 0)
      .map(([produtoId, quantidade]) => ({ produtoId: Number(produtoId), quantidade }))

    if (linhas.length === 0) { setToast({ kind: 'error', message: 'Indique pelo menos um artigo recebido.' }); return }

    const input: RececaoTransferenciaInput = {
      operadorId:           operador.id,
      transferenciaEnvioId: guia.id,
      observacoes:          observacoes.trim() || null,
      linhas
    }

    setAConfirmar(true)
    const r = await window.api.transferencias.registarRececao(input)
    setAConfirmar(false)

    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    setResultado(r.data)
    void refrescarPendentes()
  }

  const reset = (): void => {
    setIdGuia(''); setGuia(null); setQuantidades({})
    setObservacoes(''); setResultado(null)
  }

  const totalRecebido = useMemo(
    () => Object.values(quantidades).reduce((acc, q) => acc + q, 0),
    [quantidades]
  )

  const nomeLoja = (id: number) => lojasDict[id] ?? `Loja #${id}`

  // ─── Ecrã de sucesso ─────────────────────────────────────────────
  if (resultado) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-emerald-600 text-white px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-emerald-600 text-3xl font-bold flex-shrink-0">
              ✓
            </div>
            <div>
              <div className="text-xl font-bold">Recepção concluída!</div>
              <div className="text-sm text-emerald-100 mt-0.5">
                Stock actualizado em {operador.lojaBaseNome}
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <InfoRow label="Data"              valor={new Date(resultado.dataMovimento).toLocaleString('pt-PT')} />
            <InfoRow label="Artigos recebidos" valor={String(resultado.numeroLinhas)} />
            <InfoRow label="Unidades totais"   valor={`+${resultado.totalUnidades}`} destaque="emerald" />
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-800">
              <span>⚠</span> Pendente de sincronização com a Sede
            </div>
            <button
              type="button"
              onClick={reset}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl mt-2 transition"
            >
              Receber outra guia
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Detalhe de guia (confirmar quantidades) ─────────────────────
  if (guia) {
    const temDivergencia = guia.linhas.some((l) => (quantidades[l.produtoId] ?? 0) < l.quantidade)

    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">

        {/* Cabeçalho da guia */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <div>
                  <div className="text-base font-bold text-slate-900">
                    De: {nomeLoja(guia.lojaOrigemId)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {guia.id.slice(0, 16)}...
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                <span>📅 {new Date(guia.dataEnvio).toLocaleString('pt-PT')}</span>
                {guia.documentoReferencia && <span>📄 {guia.documentoReferencia}</span>}
                {guia.observacoes && <span>💬 {guia.observacoes}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuia(null)}
              className="text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              ← outra guia
            </button>
          </div>
        </div>

        {/* Linhas com barra de progresso */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Confirmar quantidades recebidas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ajuste se recebeu menos do que foi enviado
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {guia.linhas.map((linha) => {
              const recebido    = quantidades[linha.produtoId] ?? 0
              const divergencia = recebido - linha.quantidade
              const pct         = linha.quantidade > 0 ? Math.round((recebido / linha.quantidade) * 100) : 0
              const okTudo      = divergencia === 0
              const emFalta     = divergencia < 0

              return (
                <div key={linha.produtoId} className={`px-5 py-4 ${emFalta ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-start gap-4 mb-3">
                    <ProdutoImagem produtoId={linha.produtoId} imagemUrl={linha.imagemUrl} categoria={linha.categoria} className="w-8 h-8 flex-shrink-0" emojiSize="text-2xl" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{linha.artigo}</div>
                      <div className="text-xs text-slate-500 font-mono">{linha.ean}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => alterarQtd(linha.produtoId, recebido - 1)}
                        className="w-8 h-8 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={linha.quantidade}
                        value={recebido}
                        onChange={(e) => alterarQtd(linha.produtoId, Number(e.target.value))}
                        className={`w-14 text-center text-lg font-bold tabular-nums rounded-lg border-2 py-1 focus:outline-none ${
                          emFalta
                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                            : 'border-slate-200 bg-slate-50 text-slate-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => alterarQtd(linha.produtoId, recebido + 1)}
                        disabled={recebido >= linha.quantidade}
                        className="w-8 h-8 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${okTudo ? 'bg-emerald-500' : emFalta ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="text-xs w-32 text-right flex items-center justify-end gap-1.5">
                      <span className="text-slate-500">Enviadas: <span className="font-semibold text-slate-700">{linha.quantidade}</span></span>
                      {okTudo  && <span className="text-emerald-600 font-semibold">✓ OK</span>}
                      {emFalta && <span className="text-amber-700 font-semibold">⚠ {divergencia}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Divergência — aviso + justificação */}
        {temDivergencia && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <span>⚠</span>
              Diferenças detectadas — justifique abaixo
            </div>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: 2 unidades de Coca-Cola chegaram danificadas..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border-2 border-amber-300 bg-white rounded-lg focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>
        )}

        {!temDivergencia && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Observações <span className="text-slate-400 normal-case font-normal">(opcional)</span>
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre a recepção..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>
        )}

        {/* Confirmar */}
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-700 uppercase tracking-wide font-semibold">
              A dar entrada em stock
            </div>
            <div className="text-3xl font-bold text-emerald-900 tabular-nums mt-0.5">
              +{totalRecebido} unid.
            </div>
            {temDivergencia && (
              <div className="text-xs text-amber-700 mt-1">⚠ Com {guia.linhas.length > 0 ? 'diferenças' : ''}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={aConfirmar || totalRecebido === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all"
          >
            {aConfirmar ? 'A processar...' : 'Confirmar Recepção'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Lista de guias pendentes ─────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">

      {/* Verificar novas guias */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Guias em Trânsito</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {guiasPendentes.length === 0
              ? 'Nenhuma guia pendente — clique para verificar'
              : `${guiasPendentes.length} guia(s) à espera de recepção`}
          </div>
        </div>
        <button
          type="button"
          onClick={handleBuscarGuias}
          disabled={aBuscar}
          className="bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span className={aBuscar ? 'animate-spin inline-block' : ''}>↻</span>
          {aBuscar ? 'A verificar...' : 'Verificar novas guias'}
        </button>
      </div>

      {/* Cartões de guias pendentes */}
      {guiasPendentes.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <div className="text-base font-semibold text-slate-600">Sem guias pendentes</div>
          <div className="text-sm text-slate-500 mt-1">
            Clique "Verificar novas guias" para sincronizar com a Sede.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {guiasPendentes.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="p-4 flex items-center gap-4">
                {/* Ícone + info */}
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  📦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      De: {nomeLoja(g.lojaOrigemId)}
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Em Trânsito
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>📅 {new Date(g.dataMovimento).toLocaleDateString('pt-PT')}</span>
                    <span>·</span>
                    <span>{g.numeroLinhas} {g.numeroLinhas === 1 ? 'artigo' : 'artigos'}</span>
                    <span>·</span>
                    <span>{g.totalUnidades} unid.</span>
                    <span>·</span>
                    <span className="text-amber-600 font-medium">⏱ {tempoEmTransito(g.dataMovimento)}</span>
                  </div>
                  {g.documentoReferencia && (
                    <div className="text-[10px] text-slate-400 font-mono mt-1">{g.documentoReferencia}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void abrirGuiaDireta(g.id)}
                  disabled={aProcurar}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
                >
                  Receber →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input manual (offline / papel) */}
      <details className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <summary className="px-4 py-3 cursor-pointer text-sm text-slate-600 hover:text-slate-900 select-none font-medium">
          📋 Introduzir ID manualmente (offline / papel)
        </summary>
        <div className="px-4 pb-4 pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={idGuia}
              onChange={(e) => setIdGuia(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleProcurar() }}
              placeholder="Cola o UUID da guia de transferência..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 font-mono rounded-lg focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleProcurar}
              disabled={aProcurar}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-4 rounded-lg"
            >
              {aProcurar ? '...' : 'Abrir'}
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}

// ─── Sub-componente reutilizável ───────────────────────────────────

function InfoRow({
  label, valor, destaque
}: {
  label: string; valor: string; destaque?: 'indigo' | 'emerald'
}) {
  return (
    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${
        destaque === 'indigo'  ? 'text-indigo-700 text-lg tabular-nums' :
        destaque === 'emerald' ? 'text-emerald-700 text-lg tabular-nums' :
        'text-slate-900'
      }`}>
        {valor}
      </span>
    </div>
  )
}
