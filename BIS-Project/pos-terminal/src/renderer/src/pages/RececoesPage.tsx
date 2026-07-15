/**
 * RececoesPage (UC09 + Fase 3.4 + Fase 4) — Receção de Mercadoria.
 *
 * Layout 3 colunas (estilo VendaPage).
 *
 * Fase 4 — adições:
 *   - Selector de fornecedor obrigatório no cabeçalho
 *     (pesquisa bloqueada enquanto não seleccionado)
 *   - Campo "Preço de Custo" no modal de adição/edição
 *     (pré-preenchido com Produto.precoCusto, editável)
 *   - fornecedorId + precoCusto enviados no RececaoInput
 */

import { useEffect, useMemo, useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { Toast, ToastData } from '../components/Toast'
import logoUrl from '../assets/logo.png'
import { ProdutoImagem } from '../components/ProdutoImagem'
import type {
  FornecedorLocal,
  OperadorSessao,
  ProdutoLocal,
  RececaoInput,
  RececaoResultado
} from '../../../shared/types'

interface RececoesPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

interface LinhaGrelha {
  produtoId:    number
  ean:          string
  artigo:       string
  categoria:    string
  perecivel:    boolean
  precoCusto:   number
  taxaIVA:      number
  imagemUrl?:   string | null
  quantidade:   number
  lote:         string | null
  dataValidade: string | null
}

type Fase = 'edicao' | 'concluido'

// ═══════════════════════ HELPERS ═══════════════════════


// ═══════════════════════ COMPONENT ═══════════════════════

export function RececoesPage({ operador, onVoltar }: RececoesPageProps) {
  const [fase, setFase] = useState<Fase>('edicao')

  // ── Cabeçalho ──────────────────────────────────────────────────
  const [documento, setDocumento]         = useState('')
  const [fornecedores, setFornecedores]   = useState<FornecedorLocal[]>([])
  const [fornecedorId, setFornecedorId]   = useState<number | null>(null)  // [+ Fase 4]

  // ── Pesquisa ────────────────────────────────────────────────────
  const [termoPesquisa, setTermoPesquisa]     = useState('')
  const [sugestoes, setSugestoes]             = useState<ProdutoLocal[]>([])

  // ── Linhas ──────────────────────────────────────────────────────
  const [linhas, setLinhas] = useState<LinhaGrelha[]>([])

  // ── Modal de adição/edição ──────────────────────────────────────
  const [modalProduto, setModalProduto] = useState<{
    produto:     ProdutoLocal
    modo:        'adicionar' | 'editar'
    linha?:      LinhaGrelha
  } | null>(null)

  const [aConfirmar, setAConfirmar] = useState(false)
  const [resultado, setResultado]   = useState<RececaoResultado | null>(null)
  const [toast, setToast]           = useState<ToastData | null>(null)

  // ── Carregar fornecedores [Fase 4] ──────────────────────────────
  useEffect(() => {
  const load = async (): Promise<void> => {
    // Tenta listar primeiro
    const r = await window.api.fornecedores.listar()
    if (r.ok && r.data.length > 0) {
      setFornecedores(r.data)
      return
    }

    // Se vazio, sincroniza automaticamente com a Sede
    console.log('[RececoesPage] Fornecedores vazios — a sincronizar...')
    const syncR = await window.api.fornecedores.sync()
    if (syncR.ok) {
      const r2 = await window.api.fornecedores.listar()
      if (r2.ok) setFornecedores(r2.data)
    }
  }
  void load()
}, [])

  // ── Pesquisa com debounce ───────────────────────────────────────
  useEffect(() => {
    let cancelado = false

    const termo = termoPesquisa.trim()
    if (termo.length < 2 || !fornecedorId) {
      setSugestoes([])
      return
    }

    const delay = setTimeout(async () => {
      const r = await window.api.catalogo.pesquisar(termo)
      if (!cancelado && r.ok) {
        const idsJaAdicionados = new Set(linhas.map((l) => l.produtoId))
        const filtrados = r.data.filter((p) => !idsJaAdicionados.has(p.id)).slice(0, 8)
        setSugestoes(filtrados)
      }
    }, 150)

    return () => {
      cancelado = true
      clearTimeout(delay)
    }
  }, [termoPesquisa, linhas, fornecedorId])

  // ── Handlers ────────────────────────────────────────────────────

  const abrirModalAdicionar = (produto: ProdutoLocal): void => {
    if (linhas.some((l) => l.produtoId === produto.id)) {
      setToast({ kind: 'error', message: `${produto.artigo} já está na lista. Edite a linha existente.` })
      return
    }
    setModalProduto({ produto, modo: 'adicionar' })
    setTermoPesquisa('')
    setSugestoes([])
  }

  const abrirModalEditar = (linha: LinhaGrelha): void => {
    const produto: ProdutoLocal = {
      id:           linha.produtoId,
      ean:          linha.ean,
      artigo:       linha.artigo,
      categoria:    linha.categoria,
      perecivel:    linha.perecivel,
      precoCusto:   linha.precoCusto,
      pvp:          0,
      taxaIVA:      linha.taxaIVA ?? 23,
      imagemUrl:    linha.imagemUrl ?? null,
      atualizadoEm: ''
    }
    setModalProduto({ produto, modo: 'editar', linha })
  }

  const confirmarModal = (
    qtd:          number,
    lote:         string | null,
    dataValidade: string | null,
    precoCusto:   number             // [+ Fase 4]
  ): void => {
    if (!modalProduto) return

    if (modalProduto.modo === 'adicionar') {
      const novaLinha: LinhaGrelha = {
        produtoId:    modalProduto.produto.id,
        ean:          modalProduto.produto.ean,
        artigo:       modalProduto.produto.artigo,
        categoria:    modalProduto.produto.categoria,
        perecivel:    modalProduto.produto.perecivel,
        precoCusto,
        taxaIVA:      modalProduto.produto.taxaIVA ?? 23,
        imagemUrl:    modalProduto.produto.imagemUrl ?? null,
        quantidade:   qtd,
        lote,
        dataValidade
      }
      setLinhas([...linhas, novaLinha])
    } else {
      setLinhas(linhas.map((l) =>
        l.produtoId === modalProduto.produto.id
          ? { ...l, quantidade: qtd, lote, dataValidade, precoCusto }
          : l
      ))
    }

    setModalProduto(null)
  }

  const ajustarQuantidade = (produtoId: number, delta: number): void => {
    setLinhas(linhas.map((l) =>
      l.produtoId === produtoId
        ? { ...l, quantidade: Math.max(1, l.quantidade + delta) }
        : l
    ))
  }

  const removerLinha = (produtoId: number): void => {
    setLinhas(linhas.filter((l) => l.produtoId !== produtoId))
  }

  const limparTudo = (): void => {
    if (linhas.length === 0) return
    if (confirm('Tem a certeza que pretende limpar todas as linhas?')) {
      setLinhas([])
      setDocumento('')
      setFornecedorId(null)
      setToast({ kind: 'info', message: 'Receção limpa.' })
    }
  }

  const handleConfirmar = async (): Promise<void> => {
    if (!fornecedorId) {
      setToast({ kind: 'error', message: 'Seleccione um fornecedor antes de confirmar.' })
      return
    }
    if (linhas.length === 0) {
      setToast({ kind: 'error', message: 'Adicione pelo menos um artigo antes de confirmar.' })
      return
    }

    const linhasInvalidas = linhas.filter(
      (l) => l.perecivel && (!l.lote || !l.dataValidade)
    )
    if (linhasInvalidas.length > 0) {
      const nomes  = linhasInvalidas.map((l) => l.artigo).slice(0, 2).join(', ')
      const sufixo = linhasInvalidas.length > 2 ? `... (+${linhasInvalidas.length - 2})` : ''
      setToast({ kind: 'error', message: `Lote/Validade em falta: ${nomes}${sufixo}` })
      return
    }

    const input: RececaoInput = {
      operadorId:           operador.id,
      documentoReferencia:  documento.trim() || null,
      fornecedorId:         fornecedorId,          // [+ Fase 4]
      linhas: linhas.map((l) => ({
        produtoId:    l.produtoId,
        quantidade:   l.quantidade,
        lote:         l.lote ?? null,
        dataValidade: l.dataValidade ?? null,
        precoCusto:   l.precoCusto               // [+ Fase 4]
      }))
    }

    setAConfirmar(true)
    const r = await window.api.rececoes.registar(input)
    setAConfirmar(false)

    if (!r.ok) {
      setToast({ kind: 'error', message: r.error })
      return
    }

    setResultado(r.data)
    setFase('concluido')
  }

  const reset = (): void => {
    setDocumento('')
    setFornecedorId(null)
    setTermoPesquisa('')
    setSugestoes([])
    setLinhas([])
    setResultado(null)
    setFase('edicao')
  }

  // ── Derivações ──────────────────────────────────────────────────

  const totalUnidades = useMemo(
    () => linhas.reduce((acc, l) => acc + l.quantidade, 0),
    [linhas]
  )
  const numLotesEmFalta = useMemo(
    () => linhas.filter((l) => l.perecivel && (!l.lote || !l.dataValidade)).length,
    [linhas]
  )
  const totalCusto = useMemo(
    () => linhas.reduce((acc, l) => acc + l.precoCusto * l.quantidade, 0),
    [linhas]
  )
  const fornecedorSeleccionado = useMemo(
    () => fornecedores.find((f) => f.id === fornecedorId) ?? null,
    [fornecedores, fornecedorId]
  )

  // ════════════════════════════════════════════════════════════════
  //  RENDER — FASE CONCLUÍDA
  // ════════════════════════════════════════════════════════════════

  if (fase === 'concluido' && resultado) {
    return (
      <div className="h-screen w-full bg-slate-100 flex flex-col overflow-hidden">
        <header className="bg-blue-900 text-white flex-shrink-0">
          <div className="px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded p-1 flex-shrink-0">
                <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
              </div>
              <div>
                <div className="text-sm font-semibold">Receção de Mercadoria · {operador.lojaBaseNome}</div>
                <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
              </div>
            </div>
            <SyncStatusBadge tema="dark" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-emerald-600 text-white px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-emerald-600 text-3xl font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <div className="text-xl font-bold">Receção registada</div>
                <div className="text-sm text-emerald-100 mt-0.5">
                  {fornecedorSeleccionado?.nome ?? 'Fornecedor'} · Stock actualizado
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Comprovativo</div>
              <Linha label="Referência"       valor={resultado.id.slice(0, 8) + '...'} mono />
              <Linha label="Data"             valor={new Date(resultado.dataRececao).toLocaleString('pt-PT')} />
              <Linha label="Linhas"           valor={String(resultado.numeroLinhas)} />
              <Linha label="Fornecedor"       valor={fornecedorSeleccionado?.nome ?? '—'} />
              <div className="border-t border-slate-200 pt-3">
                <Linha label="Unidades totais" valor={`+${resultado.totalUnidades}`} destaque />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 flex items-center gap-2 text-xs text-amber-800">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Pendente de sincronização com a Sede
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={onVoltar}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all"
                >
                  Nova Receção
                </button>
              </div>
            </div>
          </div>
        </main>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER — FASE EDIÇÃO
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">

      {/* HEADER */}
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
              <div className="text-sm font-semibold">Receção de Mercadoria · {operador.lojaBaseNome}</div>
              <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-200">
              {linhas.length} linha{linhas.length === 1 ? '' : 's'} · {totalUnidades} unid.
            </span>
            <SyncStatusBadge tema="dark" />
          </div>
        </div>
      </header>

      {/* CORPO 3 COLUNAS */}
      <main className="flex-1 grid grid-cols-[minmax(420px,1fr)_2fr_minmax(180px,220px)] gap-3 p-3 overflow-hidden">

        {/* ─── COLUNA ESQUERDA — TALÃO ─── */}
        <section className="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden border border-slate-200">
          <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Artigos a Receber</h2>
            <span className="text-xs text-slate-300">
              {linhas.length} {linhas.length === 1 ? 'linha' : 'linhas'}
            </span>
          </div>

          <div className="grid grid-cols-[55px_1fr_100px_28px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            <span>QTD</span>
            <span>Artigo</span>
            <span>Lote/Val.</span>
            <span></span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {linhas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-8 text-center gap-2">
                <div className="text-4xl">📦</div>
                <div>Sem artigos</div>
                <div className="text-xs">
                  {fornecedorId ? 'Pesquise e adicione produtos →' : 'Seleccione primeiro um fornecedor →'}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {linhas.map((linha) => {
                  const loteEmFalta = linha.perecivel && (!linha.lote || !linha.dataValidade)

                  return (
                    <li
                      key={linha.produtoId}
                      className={`grid grid-cols-[55px_1fr_100px_28px] gap-2 px-3 py-2.5 items-start ${
                        loteEmFalta ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Qtd */}
                      <div className="flex items-center gap-0.5 pt-1">
                        <button
                          type="button"
                          onClick={() => ajustarQuantidade(linha.produtoId, -1)}
                          disabled={linha.quantidade <= 1}
                          className="w-5 h-5 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded text-xs leading-none font-bold"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums">{linha.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => ajustarQuantidade(linha.produtoId, +1)}
                          className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded text-xs leading-none font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Artigo */}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                          <ProdutoImagem produtoId={linha.produtoId} imagemUrl={linha.imagemUrl} categoria={linha.categoria} className="w-6 h-6" emojiSize="text-base" />
                          <span className="truncate">{linha.artigo}</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold tabular-nums">
                          {linha.precoCusto.toFixed(2)} €/un
                        </div>
                        {linha.perecivel && (
                          <span className="inline-block mt-0.5 bg-amber-100 text-amber-800 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                            PERECÍVEL
                          </span>
                        )}
                      </div>

                      {/* Lote / Validade */}
                      <div className="text-xs">
                        {linha.perecivel ? (
                          loteEmFalta ? (
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(linha)}
                              className="text-amber-700 font-semibold hover:underline"
                            >
                              ⚠ Definir lote
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(linha)}
                              className="text-left hover:bg-slate-100 rounded px-1 -mx-1"
                            >
                              <div className="font-mono text-slate-700 truncate">{linha.lote}</div>
                              <div className="text-slate-500 text-[10px]">
                                {linha.dataValidade
                                  ? new Date(linha.dataValidade).toLocaleDateString('pt-PT')
                                  : '—'}
                              </div>
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(linha)}
                            className="text-slate-400 hover:text-blue-600 hover:underline text-[10px]"
                          >
                            editar
                          </button>
                        )}
                      </div>

                      {/* Remover */}
                      <button
                        type="button"
                        onClick={() => removerLinha(linha.produtoId)}
                        className="text-slate-400 hover:text-red-600 text-base pt-1"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Rodapé do talão */}
          <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Linhas</span>
              <span className="tabular-nums font-semibold">{linhas.length}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Custo total</span>
              <span className="tabular-nums font-semibold">{totalCusto.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-900">A entrar</span>
              <span className="text-3xl font-bold text-emerald-700 tabular-nums">+{totalUnidades}</span>
            </div>
          </div>
        </section>

        {/* ─── COLUNA CENTRAL — CABEÇALHO + PESQUISA ─── */}
        <section className="flex flex-col gap-3 overflow-hidden">

          {/* Fornecedor + Documento [+ Fase 4] */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-shrink-0 space-y-3">

            {/* Selector de Fornecedor — obrigatório */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Fornecedor
                <span className="ml-1 text-red-500">*</span>
              </label>
              {fornecedores.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ Nenhum fornecedor disponível — sincronize o catálogo
                </div>
              ) : (
                <select
                  value={fornecedorId ?? ''}
                  onChange={(e) => setFornecedorId(e.target.value ? Number(e.target.value) : null)}
                  className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 ${
                    fornecedorId
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200'
                      : 'border-amber-400 focus:border-amber-500 focus:ring-amber-200'
                  }`}
                >
                  <option value="">Seleccione um fornecedor...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}{f.nif ? ` (NIF: ${f.nif})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Documento opcional */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Documento / Guia de Remessa
                <span className="ml-1 text-slate-400 normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ex: GR-2026-04-23-00147"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Aviso lotes em falta */}
          {numLotesEmFalta > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2 flex-shrink-0">
              <span className="text-2xl leading-none">⚠</span>
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {numLotesEmFalta} produto{numLotesEmFalta === 1 ? '' : 's'} perecíve{numLotesEmFalta === 1 ? 'l' : 'is'} sem Lote/Validade
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  Clique em "⚠ Definir lote" no talão para preencher.
                </div>
              </div>
            </div>
          )}

          {/* Pesquisa de produtos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Adicionar Artigo</h2>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={termoPesquisa}
                  onChange={(e) => setTermoPesquisa(e.target.value)}
                  disabled={!fornecedorId}
                  placeholder={
                    fornecedorId
                      ? 'Pesquisar por nome ou EAN (mín. 2 caracteres)...'
                      : 'Seleccione um fornecedor primeiro'
                  }
                  className={`w-full pl-10 pr-3 py-3 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                    fornecedorId
                      ? 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
                      : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!fornecedorId ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                  <div className="text-4xl">🏪</div>
                  <div className="font-medium text-slate-600">Fornecedor não seleccionado</div>
                  <div className="text-xs">Escolha um fornecedor no painel acima para começar</div>
                </div>
              ) : termoPesquisa.trim().length < 2 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                  <div className="text-4xl">🔎</div>
                  <div>Digite pelo menos 2 caracteres</div>
                </div>
              ) : sugestoes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                  <div className="text-4xl">🤷</div>
                  <div>Nenhum produto encontrado ou já adicionado</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sugestoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => abrirModalAdicionar(p)}
                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg p-3 text-left transition-all active:scale-[0.97]"
                    >
                      <div className="flex items-start gap-2">
                        <ProdutoImagem produtoId={p.id} imagemUrl={p.imagemUrl} categoria={p.categoria} className="w-10 h-10 flex-shrink-0" emojiSize="text-3xl" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 line-clamp-2 leading-tight">
                            {p.artigo}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{p.ean}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-emerald-700 text-xs font-semibold">{p.precoCusto.toFixed(2)} €</span>
                            {p.perecivel && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                                PERECÍVEL
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── COLUNA DIREITA — ACÇÕES ─── */}
        <section className="flex flex-col gap-3 overflow-hidden">
          <button
            type="button"
            onClick={limparTudo}
            disabled={linhas.length === 0}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-4 px-3 font-semibold text-sm shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">🚫</span>
            <span>Limpar Tudo</span>
          </button>

          {/* Info fornecedor seleccionado */}
          {fornecedorSeleccionado && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-700 uppercase tracking-wide font-semibold">Fornecedor</div>
              <div className="text-sm font-bold text-blue-900 mt-0.5 leading-tight">
                {fornecedorSeleccionado.nome}
              </div>
              {fornecedorSeleccionado.nif && (
                <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                  NIF: {fornecedorSeleccionado.nif}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Custo total */}
          {linhas.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Custo total</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {totalCusto.toFixed(2)} €
              </div>
            </div>
          )}

          {/* Confirmar */}
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!fornecedorId || linhas.length === 0 || aConfirmar || numLotesEmFalta > 0}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-6 px-3 font-bold text-base shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-1"
          >
            <span className="text-3xl">✓</span>
            <span>{aConfirmar ? 'A processar...' : 'Confirmar Receção'}</span>
          </button>
        </section>
      </main>

      {/* Modal de adição/edição */}
      {modalProduto && (
        <ModalAdicaoRececao
          produto={modalProduto.produto}
          modo={modalProduto.modo}
          quantidadeInicial={modalProduto.linha?.quantidade ?? 1}
          precoCustoInicial={modalProduto.linha?.precoCusto ?? modalProduto.produto.precoCusto}
          loteInicial={modalProduto.linha?.lote ?? null}
          dataValidadeInicial={modalProduto.linha?.dataValidade ?? null}
          onConfirmar={confirmarModal}
          onCancelar={() => setModalProduto(null)}
        />
      )}

      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════ Linha de comprovativo ═══════════════════════

function Linha({
  label, valor, mono, destaque
}: { label: string; valor: string; mono?: boolean; destaque?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} ${
        destaque ? 'text-emerald-700 font-bold text-xl tabular-nums' : 'text-slate-900 font-semibold'
      }`}>
        {valor}
      </span>
    </div>
  )
}

// ═══════════════════════ Modal de adição/edição ═══════════════════════

interface ModalAdicaoProps {
  produto:              ProdutoLocal
  modo:                 'adicionar' | 'editar'
  quantidadeInicial:    number
  precoCustoInicial:    number             // [+ Fase 4]
  loteInicial:          string | null
  dataValidadeInicial:  string | null
  onConfirmar:          (qtd: number, lote: string | null, dataValidade: string | null, precoCusto: number) => void
  onCancelar:           () => void
}

function ModalAdicaoRececao({
  produto,
  modo,
  quantidadeInicial,
  precoCustoInicial,
  loteInicial,
  dataValidadeInicial,
  onConfirmar,
  onCancelar
}: ModalAdicaoProps) {
  const [qtd, setQtd]                   = useState(quantidadeInicial)
  const [precoCusto, setPrecoCusto]     = useState(precoCustoInicial)  // [+ Fase 4]
  const [lote, setLote]                 = useState(loteInicial ?? '')
  const [dataValidade, setDataValidade] = useState(dataValidadeInicial ?? '')

  const loteValido     = !produto.perecivel || lote.trim().length > 0
  const validadeValida = !produto.perecivel || dataValidade.length > 0
  const precoValido    = precoCusto >= 0
  const podeConfirmar  = qtd > 0 && loteValido && validadeValida && precoValido

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`text-white px-5 py-4 ${produto.perecivel ? 'bg-amber-600' : 'bg-blue-900'}`}>
          <div className="text-xs uppercase tracking-wider text-white/80">
            {modo === 'adicionar' ? 'Adicionar à Receção' : 'Editar Linha'}
          </div>
          {produto.perecivel && (
            <div className="text-xs mt-0.5 text-amber-100 flex items-center gap-1">
              <span>⚠</span>
              Produto perecível detetado
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Emoji + nome */}
          <div className="text-center">
            <ProdutoImagem produtoId={produto.id} imagemUrl={produto.imagemUrl} categoria={produto.categoria} className="w-24 h-24 mb-2 mx-auto" emojiSize="text-7xl" />
            <div className="text-lg font-semibold text-slate-900">{produto.artigo}</div>
            <div className="text-xs text-slate-500 font-mono">{produto.ean}</div>
          </div>

          {/* Quantidade + Preço de Custo — lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Quantidade */}
            <div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 text-center">
                Quantidade
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setQtd(Math.max(1, qtd - 1))}
                  className="w-10 h-10 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg text-xl font-bold"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={qtd}
                  onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-slate-100 text-2xl font-bold tabular-nums text-slate-900 text-center rounded-lg py-2 border-2 border-slate-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQtd(qtd + 1)}
                  className="w-10 h-10 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Preço de Custo [+ Fase 4] */}
            <div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 text-center">
                Custo (€/un)
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precoCusto}
                  onChange={(e) => setPrecoCusto(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-100 text-2xl font-bold tabular-nums text-emerald-800 text-center rounded-lg py-2 border-2 border-slate-200 focus:border-emerald-500 focus:outline-none pr-6"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none">
                  €
                </span>
              </div>
              <div className="text-[10px] text-center text-slate-500 mt-1">
                Total: {(precoCusto * qtd).toFixed(2)} €
              </div>
            </div>
          </div>

          {/* Lote + Validade — só perecíveis */}
          {produto.perecivel && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>⚠</span>
                Obrigatório para perecíveis
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">Nº do Lote</label>
                <input
                  type="text"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Ex: LOT-2026-Q2"
                  maxLength={50}
                  autoFocus={modo === 'adicionar'}
                  className={`w-full px-3 py-2 text-base font-mono border-2 rounded-lg focus:outline-none ${
                    lote.trim() ? 'border-emerald-400 bg-white' : 'border-amber-400 bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">Data de Validade</label>
                <input
                  type="date"
                  value={dataValidade}
                  onChange={(e) => setDataValidade(e.target.value)}
                  className={`w-full px-3 py-2 text-base border-2 rounded-lg focus:outline-none ${
                    dataValidade ? 'border-emerald-400 bg-white' : 'border-amber-400 bg-white'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancelar}
              className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmar(qtd, lote.trim() || null, dataValidade || null, precoCusto)}
              disabled={!podeConfirmar}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-sm"
            >
              {modo === 'adicionar' ? 'Adicionar' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
