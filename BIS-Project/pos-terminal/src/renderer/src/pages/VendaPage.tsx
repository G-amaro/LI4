/**
 * VendaPage (UC01) — Fase 3.3 redesign:
 *
 *   Usa o novo VendaConcluidaModal após registar a venda, em vez do toast.
 *   PagamentoModal agora retorna ResultadoPagamento detalhado (valor recebido,
 *   cartão mock, telemóvel) para o modal de conclusão poder mostrar info rica.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Toast, ToastData } from '../components/Toast'
import { PagamentoModal, ResultadoPagamento } from '../components/PagamentoModal'
import { VendaConcluidaModal } from '../components/VendaConcluidaModal'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import logoUrl from '../assets/logo.png'
import { ProdutoImagem, emojiCategoria } from '../components/ProdutoImagem'
import {
  OperadorSessao,
  ProdutoLocal,
  VendaInput
} from '../../../shared/types'

interface VendaPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

// ═══════════════════════ CART STATE ═══════════════════════

interface CartItem {
  produto:    ProdutoLocal
  quantidade: number
  subtotal:   number
}

type CartAction =
  | { type: 'ADICIONAR';   produto: ProdutoLocal; qtd?: number }
  | { type: 'INCREMENTAR'; produtoId: number }
  | { type: 'DECREMENTAR'; produtoId: number }
  | { type: 'REMOVER';     produtoId: number }
  | { type: 'LIMPAR' }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADICIONAR': {
      const qtdAdd = action.qtd ?? 1
      const existente = state.find((i) => i.produto.id === action.produto.id)
      if (existente) {
        return state.map((i) =>
          i.produto.id === action.produto.id
            ? { ...i, quantidade: i.quantidade + qtdAdd, subtotal: round2((i.quantidade + qtdAdd) * i.produto.pvp) }
            : i
        )
      }
      return [
        ...state,
        { produto: action.produto, quantidade: qtdAdd, subtotal: round2(qtdAdd * action.produto.pvp) }
      ]
    }
    case 'INCREMENTAR':
      return state.map((i) =>
        i.produto.id === action.produtoId
          ? { ...i, quantidade: i.quantidade + 1, subtotal: round2((i.quantidade + 1) * i.produto.pvp) }
          : i
      )
    case 'DECREMENTAR': {
      const item = state.find((i) => i.produto.id === action.produtoId)
      if (!item) return state
      if (item.quantidade <= 1) {
        return state.filter((i) => i.produto.id !== action.produtoId)
      }
      return state.map((i) =>
        i.produto.id === action.produtoId
          ? { ...i, quantidade: i.quantidade - 1, subtotal: round2((i.quantidade - 1) * i.produto.pvp) }
          : i
      )
    }
    case 'REMOVER':
      return state.filter((i) => i.produto.id !== action.produtoId)
    case 'LIMPAR':
      return []
  }
}

// ═══════════════════════ HELPERS ═══════════════════════


// ═══════════════════════ COMPONENT ═══════════════════════

export function VendaPage({ operador, onVoltar }: VendaPageProps) {
  const [carrinho, dispatch]                    = useReducer(cartReducer, [])
  const [todosProdutos, setTodosProdutos]       = useState<ProdutoLocal[]>([])
  const [eanInput, setEanInput]                 = useState('')
  const [pesquisa, setPesquisa]                 = useState('')
  const [categoriaActiva, setCategoriaActiva]   = useState<string>('Todas')
  const [toast, setToast]                       = useState<ToastData | null>(null)
  const [aFinalizar, setAFinalizar]             = useState(false)
  const [mostrarPagamento, setMostrarPagamento] = useState(false)
  const [produtoEscolhido, setProdutoEscolhido] = useState<ProdutoLocal | null>(null)

  // Estado da venda concluída (snapshot dos dados para o modal)
  const [vendaConcluida, setVendaConcluida] = useState<{
    vendaId:    string
    total:      number
    resultado:  ResultadoPagamento
    linhas:     { artigo: string; quantidade: number; pvp: number; subtotal: number; taxaIVA: number }[]
  } | null>(null)

  const eanInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const r = await window.api.catalogo.listar()
      if (r.ok) setTodosProdutos(r.data)
    }
    void load()
  }, [])

  useEffect(() => {
    eanInputRef.current?.focus()
  }, [])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    todosProdutos.forEach((p) => set.add(p.categoria))
    return ['Todas', ...Array.from(set).sort()]
  }, [todosProdutos])

  const produtosFiltrados = useMemo(() => {
    let filtrados = todosProdutos
    if (categoriaActiva !== 'Todas') {
      filtrados = filtrados.filter((p) => p.categoria === categoriaActiva)
    }
    const termo = pesquisa.trim().toLowerCase()
    if (termo) {
      filtrados = filtrados.filter((p) =>
        p.artigo.toLowerCase().includes(termo) ||
        p.ean.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
      )
    }
    return filtrados
  }, [todosProdutos, categoriaActiva, pesquisa])

  const handleEanSubmit = useCallback(async (): Promise<void> => {
    const ean = eanInput.trim()
    if (!ean) return
    const r = await window.api.catalogo.porEan(ean)
    setEanInput('')
    if (!r.ok || !r.data) {
      setToast({ kind: 'error', message: `EAN ${ean} não encontrado no catálogo.` })
      return
    }
    dispatch({ type: 'ADICIONAR', produto: r.data })
  }, [eanInput])

  const handleEanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleEanSubmit()
    }
  }

  const total      = round2(carrinho.reduce((acc, i) => acc + i.subtotal, 0))
  // IVA calculado por linha (PVP inclui IVA em Portugal)
  const ivaDetalhes = carrinho.map(item => ({
    taxa: item.produto.taxaIVA ?? 23,
    valor: round2(item.subtotal * (item.produto.taxaIVA ?? 23) / (100 + (item.produto.taxaIVA ?? 23)))
  }))
  const taxaIva  = round2(ivaDetalhes.reduce((s, i) => s + i.valor, 0))
  const subtotal = round2(total - taxaIva)
  const taxasUnicas = [...new Set(ivaDetalhes.map(i => i.taxa))]
  const ivaLabel = taxasUnicas.length === 1 ? `IVA (${taxasUnicas[0]}%)` : 'IVA (misto)'
  const numItems   = carrinho.reduce((acc, i) => acc + i.quantidade, 0)

  // ─── Submeter venda ──────────────────────────────────────────
  const handleConfirmarPagamento = async (resultado: ResultadoPagamento): Promise<void> => {
    if (carrinho.length === 0 || aFinalizar) return

    setMostrarPagamento(false)
    setAFinalizar(true)

    // Captura snapshot do carrinho antes de qualquer limpeza
    const linhasSnapshot = carrinho.map((i) => ({
      artigo:     i.produto.artigo,
      quantidade: i.quantidade,
      pvp:        i.produto.pvp,
      subtotal:   i.subtotal,
      taxaIVA:    i.produto.taxaIVA ?? 23
    }))
    const totalSnapshot = total

    const input: VendaInput = {
      operadorId:      operador.id,
      metodoPagamento: resultado.metodo,
      nifCliente:      null,           // NIF mock só na UI nesta fase
      linhas: carrinho.map((i) => ({
        produtoId:     i.produto.id,
        quantidade:    i.quantidade,
        precoUnitario: i.produto.pvp,
        subtotal:      i.subtotal
      }))
    }

    const r = await window.api.vendas.criar(input)
    setAFinalizar(false)

    if (!r.ok) {
      setToast({ kind: 'error', message: `Falha ao registar venda: ${r.error}` })
      return
    }

    // Sucesso → guarda info para o VendaConcluidaModal
    setVendaConcluida({
      vendaId:   r.data.id,
      total:     totalSnapshot,
      resultado,
      linhas:    linhasSnapshot
    })

    // Limpa carrinho IMEDIATAMENTE — modal mostra snapshot
    dispatch({ type: 'LIMPAR' })
  }

  const handleNovaVenda = (): void => {
    setVendaConcluida(null)
    eanInputRef.current?.focus()
  }

  const handleAnularVenda = (): void => {
    if (carrinho.length === 0) return
    if (confirm('Tem a certeza que pretende anular a venda em curso?')) {
      dispatch({ type: 'LIMPAR' })
      setToast({ kind: 'info', message: 'Venda anulada.' })
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER
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
              className="bg-blue-800 hover:bg-blue-700 active:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded transition-colors"
            >
              ← Voltar
            </button>

            <div className="bg-white rounded p-1 flex-shrink-0">
              <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
            </div>

            <div>
              <div className="text-sm font-semibold">Nova Venda · {operador.lojaBaseNome}</div>
              <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-200">
              {numItems} {numItems === 1 ? 'artigo' : 'artigos'} no talão
            </span>
            <SyncStatusBadge tema="dark" />
          </div>
        </div>
      </header>

      {/* CORPO 3 COLUNAS */}
      <main className="flex-1 grid grid-cols-[minmax(380px,1fr)_2fr_minmax(180px,220px)] gap-3 p-3 overflow-hidden">

        {/* COLUNA ESQUERDA — TALÃO */}
        <section className="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden border border-slate-200">
          <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Talão</h2>
            <span className="text-xs text-slate-300">
              {carrinho.length} {carrinho.length === 1 ? 'linha' : 'linhas'}
            </span>
          </div>

          <div className="grid grid-cols-[40px_1fr_70px_70px_28px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            <span>QTD</span>
            <span>Artigo</span>
            <span className="text-right">P.Unit.</span>
            <span className="text-right">Valor</span>
            <span></span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {carrinho.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-8 text-center gap-2">
                <div className="text-4xl">🧾</div>
                <div>Talão vazio</div>
                <div className="text-xs">Bipe um produto ou seleccione na grelha</div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {carrinho.map((item) => (
                  <li
                    key={item.produto.id}
                    className="grid grid-cols-[40px_1fr_70px_70px_28px] gap-2 px-3 py-2 items-center hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'DECREMENTAR', produtoId: item.produto.id })}
                        className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded text-xs leading-none font-bold"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantidade}</span>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'INCREMENTAR', produtoId: item.produto.id })}
                        className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded text-xs leading-none font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm font-medium text-slate-900 truncate">
                      {item.produto.artigo}
                    </div>

                    <div className="text-right text-sm text-slate-700 tabular-nums">
                      {item.produto.pvp.toFixed(2)}€
                    </div>

                    <div className="text-right text-sm font-semibold text-slate-900 tabular-nums">
                      {item.subtotal.toFixed(2)}€
                    </div>

                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'REMOVER', produtoId: item.produto.id })}
                      className="text-slate-400 hover:text-red-600 text-base"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{subtotal.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{ivaLabel}</span>
              <span className="tabular-nums">{taxaIva.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-900">TOTAL</span>
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{total.toFixed(2)}€</span>
            </div>
          </div>
        </section>

        {/* COLUNA CENTRAL — GRELHA + FILTROS */}
        <section className="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden border border-slate-200">

          <div className="bg-blue-50 px-3 pt-3 pb-0 border-b border-blue-200 overflow-x-auto">
            <div className="flex gap-1.5">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaActiva(cat)}
                  className={`text-xs font-semibold px-3 py-2 rounded-t-lg whitespace-nowrap transition-colors ${
                    categoriaActiva === cat
                      ? 'bg-white text-blue-900 border border-blue-200 border-b-white -mb-px shadow-sm'
                      : 'bg-blue-700 text-white hover:bg-blue-600'
                  }`}
                >
                  {cat === 'Todas' ? '📋 Todas' : `${emojiCategoria(cat)} ${cat}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {produtosFiltrados.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <div className="text-4xl">🔍</div>
                <div>Nenhum produto encontrado.</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {produtosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProdutoEscolhido(p)}
                    className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg p-2.5 text-center transition-all active:scale-[0.97] flex flex-col items-center gap-1"
                  >
                    <ProdutoImagem produtoId={p.id} imagemUrl={p.imagemUrl} categoria={p.categoria} className="w-12 h-12" emojiSize="text-3xl" />
                    <div className="text-xs font-medium text-slate-900 line-clamp-2 leading-tight w-full">
                      {p.artigo}
                    </div>
                    <div className="text-sm font-bold text-emerald-700 tabular-nums">
                      {p.pvp.toFixed(2)}€
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
              <input
                type="text"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Pesquisar produto (nome ou EAN)..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 bg-white rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <input
                ref={eanInputRef}
                type="text"
                inputMode="numeric"
                value={eanInput}
                onChange={(e) => setEanInput(e.target.value)}
                onKeyDown={handleEanKeyDown}
                placeholder="📷 Bipar código de barras + Enter"
                className="flex-1 px-3 py-2 text-sm border-2 border-slate-300 bg-white rounded-lg focus:border-blue-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleEanSubmit}
                disabled={!eanInput.trim()}
                className="px-4 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA — ACÇÕES */}
        <section className="flex flex-col gap-3 overflow-hidden">

          <button
            type="button"
            onClick={handleAnularVenda}
            disabled={carrinho.length === 0}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-4 px-3 font-semibold text-sm shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">🚫</span>
            <span>Anular Venda</span>
          </button>

          <button
            type="button"
            onClick={() => eanInputRef.current?.focus()}
            className="bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl py-4 px-3 font-semibold text-sm shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">📷</span>
            <span>Bipar Manual</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoriaActiva('Todas')
              setPesquisa('')
            }}
            className="bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white rounded-xl py-4 px-3 font-semibold text-sm shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">🔄</span>
            <span>Limpar Filtros</span>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setMostrarPagamento(true)}
            disabled={carrinho.length === 0 || aFinalizar}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-8 px-3 font-bold text-base shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center gap-2"
          >
            <span className="text-4xl">💳</span>
            <span className="text-lg">PAGAMENTO</span>
            {carrinho.length > 0 && (
              <span className="text-sm font-normal text-emerald-100 tabular-nums">
                {total.toFixed(2)}€
              </span>
            )}
          </button>
        </section>
      </main>

      {/* MODAIS */}
      {produtoEscolhido && (
        <ModalQuantidade
          produto={produtoEscolhido}
          onConfirmar={(qtd) => {
            dispatch({ type: 'ADICIONAR', produto: produtoEscolhido, qtd })
            setProdutoEscolhido(null)
          }}
          onCancelar={() => setProdutoEscolhido(null)}
        />
      )}

      {mostrarPagamento && (
        <PagamentoModal
          totalAPagar={total}
          onConfirmar={handleConfirmarPagamento}
          onCancelar={() => setMostrarPagamento(false)}
        />
      )}

      {vendaConcluida && (
        <VendaConcluidaModal
          vendaId={vendaConcluida.vendaId}
          total={vendaConcluida.total}
          resultado={vendaConcluida.resultado}
          linhas={vendaConcluida.linhas}
          operador={operador}
          onNovaVenda={handleNovaVenda}
        />
      )}

      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════ MODAL DE QUANTIDADE ═══════════════════════

interface ModalQuantidadeProps {
  produto:     ProdutoLocal
  onConfirmar: (qtd: number) => void
  onCancelar:  () => void
}

function ModalQuantidade({ produto, onConfirmar, onCancelar }: ModalQuantidadeProps) {
  const [qtd, setQtd] = useState(1)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-900 text-white px-5 py-3 text-center">
          <div className="text-xs uppercase tracking-wider text-blue-200">Adicionar ao talão</div>
        </div>

        <div className="p-6 text-center space-y-4">
          <ProdutoImagem produtoId={produto.id} imagemUrl={produto.imagemUrl} categoria={produto.categoria} className="w-24 h-24" emojiSize="text-7xl" />
          <div>
            <div className="text-lg font-semibold text-slate-900">{produto.artigo}</div>
            <div className="text-sm text-slate-500">
              {produto.pvp.toFixed(2)}€ / unidade
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setQtd(Math.max(1, qtd - 1))}
              className="w-12 h-12 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 rounded-lg text-2xl font-bold"
            >
              −
            </button>
            <div className="bg-slate-100 rounded-lg px-6 py-2 min-w-[80px]">
              <div className="text-3xl font-bold tabular-nums text-slate-900">{qtd}</div>
            </div>
            <button
              type="button"
              onClick={() => setQtd(qtd + 1)}
              className="w-12 h-12 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 rounded-lg text-2xl font-bold"
            >
              +
            </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-xs text-emerald-700 uppercase tracking-wide font-medium">Subtotal</div>
            <div className="text-2xl font-bold text-emerald-900 tabular-nums mt-0.5">
              {(produto.pvp * qtd).toFixed(2)}€
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancelar}
              className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-semibold py-3 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmar(qtd)}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 rounded-lg transition-colors shadow-sm"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
