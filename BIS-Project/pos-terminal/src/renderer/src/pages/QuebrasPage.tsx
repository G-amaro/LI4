/**
 * QuebrasPage — Registo de Quebras de Stock (UC08).
 *
 * Redesign Fase 3:
 *   - Header azul-marinho consistente com as outras páginas
 *   - Modelo batch: adiciona vários artigos à lista antes de submeter
 *   - Modal por produto: quantidade + motivo (poka-yoke)
 *   - Coluna esquerda: lista de itens a abateri + total de perda
 *   - Coluna direita: pesquisa EAN / nome + indicações
 *   - Submissão sequencial via window.api.quebras.registar
 *
 * Lógica:
 *   Pesquisa produto → Modal (qty + motivo + preview custo) →
 *   Item adicionado à lista local → Finalizar → submete todos →
 *   Ecrã de sucesso
 */

import { useEffect, useRef, useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { Toast, ToastData } from '../components/Toast'
import logoUrl from '../assets/logo.png'
import type {
  MotivoQuebra,
  OperadorSessao,
  ProdutoLocal,
  QuebraInput
} from '../../../shared/types'

interface QuebrasPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

// ─── Motivos ───────────────────────────────────────────────────────

const MOTIVOS: Array<{
  valor:  MotivoQuebra
  label:  string
  sublabel: string
  icone:  string
  cor:    { card: string; badge: string }
}> = [
  {
    valor:    1 as MotivoQuebra,
    label:    'Validade Expirada',
    sublabel: 'Produto fora de prazo',
    icone:    '📅',
    cor: {
      card:  'border-amber-400 bg-amber-50 text-amber-900',
      badge: 'bg-amber-500 text-white'
    }
  },
  {
    valor:    2 as MotivoQuebra,
    label:    'Dano / Quebra Física',
    sublabel: 'Produto danificado ou partido',
    icone:    '💥',
    cor: {
      card:  'border-orange-400 bg-orange-50 text-orange-900',
      badge: 'bg-orange-500 text-white'
    }
  },
  {
    valor:    3 as MotivoQuebra,
    label:    'Furto / Desaparecimento',
    sublabel: 'Artigo em falta sem explicação',
    icone:    '🔍',
    cor: {
      card:  'border-red-400 bg-red-50 text-red-900',
      badge: 'bg-red-500 text-white'
    }
  }
]

function motivoLabel(m: MotivoQuebra): string {
  return MOTIVOS.find((x) => x.valor === m)?.label ?? '—'
}
function motivoIcone(m: MotivoQuebra): string {
  return MOTIVOS.find((x) => x.valor === m)?.icone ?? '📦'
}
function motivoCor(m: MotivoQuebra): string {
  return MOTIVOS.find((x) => x.valor === m)?.cor.badge ?? 'bg-slate-500 text-white'
}

// ─── Tipos locais ──────────────────────────────────────────────────

interface ItemQuebraLocal {
  _key:     string            // key único para a lista
  produto:  ProdutoLocal
  quantidade: number
  motivo:   MotivoQuebra
  valorPerdido: number
}

type Fase = 'edicao' | 'concluido'

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function QuebrasPage({ operador, onVoltar }: QuebrasPageProps) {
  const [fase, setFase]             = useState<Fase>('edicao')
  const [itens, setItens]           = useState<ItemQuebraLocal[]>([])
  const [modalProduto, setModal]    = useState<ProdutoLocal | null>(null)
  const [toast, setToast]           = useState<ToastData | null>(null)
  const [aSubmeter, setASubmeter]   = useState(false)
  const [resumoFinal, setResumo]    = useState<{ total: number; perda: number } | null>(null)

  const totalPerda = itens.reduce((acc, i) => acc + i.valorPerdido, 0)

  const adicionarItem = (produto: ProdutoLocal, quantidade: number, motivo: MotivoQuebra) => {
    const jaExiste = itens.find((i) => i.produto.id === produto.id)
    if (jaExiste) {
      // Se já existe, actualiza
      setItens(itens.map((i) =>
        i.produto.id === produto.id
          ? { ...i, quantidade, motivo, valorPerdido: produto.precoCusto * quantidade }
          : i
      ))
    } else {
      setItens([...itens, {
        _key:        `${produto.id}-${Date.now()}`,
        produto,
        quantidade,
        motivo,
        valorPerdido: produto.precoCusto * quantidade
      }])
    }
    setModal(null)
  }

  const removerItem = (key: string) => {
    setItens(itens.filter((i) => i._key !== key))
  }

  const handleFinalizar = async () => {
    if (itens.length === 0) return
    setASubmeter(true)

    let erros = 0
    for (const item of itens) {
      const input: QuebraInput = {
        operadorId: operador.id,
        produtoId:  item.produto.id,
        quantidade: item.quantidade,
        motivo:     item.motivo
      }
      const r = await window.api.quebras.registar(input)
      if (!r.ok) erros++
    }

    setASubmeter(false)

    if (erros > 0) {
      setToast({ kind: 'error', message: `${erros} quebra(s) falharam ao gravar. Tente novamente.` })
      return
    }

    setResumo({ total: itens.length, perda: totalPerda })
    setFase('concluido')
  }

  // ─── Ecrã de sucesso ─────────────────────────────────────────────
  if (fase === 'concluido' && resumoFinal) {
    return (
      <div className="h-screen w-full bg-slate-100 flex flex-col overflow-hidden">
        <header className="bg-amber-800 text-white flex-shrink-0">
          <div className="px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded p-1 flex-shrink-0">
                <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
              </div>
              <div>
                <div className="text-sm font-semibold">⚠ Registo de Quebras · {operador.lojaBaseNome}</div>
                <div className="text-xs text-amber-200">Operador: {operador.nome}</div>
              </div>
            </div>
            <SyncStatusBadge tema="dark" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-3xl flex-shrink-0">
                ✓
              </div>
              <div>
                <div className="text-xl font-bold">Quebras registadas</div>
                <div className="text-sm text-amber-100 mt-0.5">Stock actualizado · Pendente de sync</div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Resumo</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Artigos registados</span>
                <span className="font-semibold text-slate-900">{resumoFinal.total}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
                <span className="text-slate-500">Perda total estimada</span>
                <span className="font-bold text-red-700 text-xl tabular-nums">
                  {resumoFinal.perda.toFixed(2)} €
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-800 mt-2">
                <span>⚠</span>
                Pendente de sincronização com a Sede
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={onVoltar}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-xl"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => { setItens([]); setFase('edicao'); setResumo(null) }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl"
                >
                  Nova Quebra
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ─── Ecrã de edição ──────────────────────────────────────────────
  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">

      {/* HEADER */}
      <header className="bg-amber-800 text-white flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="bg-amber-900 hover:bg-amber-700 text-sm font-medium px-3 py-1.5 rounded transition-colors"
            >
              ← Voltar
            </button>
            <div className="bg-white rounded p-1 flex-shrink-0">
              <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold">⚠ Registo de Quebras · {operador.lojaBaseNome}</div>
              <div className="text-xs text-amber-200">Operador: {operador.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {itens.length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            )}
            <SyncStatusBadge tema="dark" />
          </div>
        </div>
      </header>

      {/* CORPO 2 COLUNAS */}
      <main className="flex-1 grid grid-cols-[1.2fr_1fr] gap-3 p-3 overflow-hidden">

        {/* ─── COLUNA ESQUERDA — Lista de itens ─── */}
        <section className="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden border border-slate-200">
          <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Itens a Abateri</h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              itens.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-600 text-slate-300'
            }`}>
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1fr_52px_120px_80px_28px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex-shrink-0">
            <span>Artigo</span>
            <span className="text-center">QTD</span>
            <span>Motivo</span>
            <span className="text-right">Val. Perdido</span>
            <span></span>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {itens.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-3 p-8 text-center">
                <div className="text-5xl">📋</div>
                <div className="font-medium text-slate-500">Nenhum artigo registado</div>
                <div className="text-xs">
                  Bipe o código de barras ou pesquise pelo nome →
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {itens.map((item) => (
                  <li
                    key={item._key}
                    className="grid grid-cols-[1fr_52px_120px_80px_28px] gap-2 px-4 py-3 items-center hover:bg-slate-50"
                  >
                    {/* Artigo */}
                    <div>
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.produto.artigo}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.produto.ean}</div>
                    </div>

                    {/* QTD */}
                    <div className="text-center text-base font-bold tabular-nums text-slate-900">
                      {item.quantidade}
                    </div>

                    {/* Motivo badge */}
                    <div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${motivoCor(item.motivo)}`}>
                        <span>{motivoIcone(item.motivo)}</span>
                        <span className="truncate">{motivoLabel(item.motivo)}</span>
                      </span>
                    </div>

                    {/* Valor */}
                    <div className="text-right text-sm font-bold text-red-700 tabular-nums">
                      {item.valorPerdido.toFixed(2)} €
                    </div>

                    {/* Remover */}
                    <button
                      type="button"
                      onClick={() => removerItem(item._key)}
                      className="text-slate-400 hover:text-red-600 text-base"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rodapé */}
          <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 flex-shrink-0">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-slate-700">Total Perda estimada</span>
              <span className="text-3xl font-bold text-red-700 tabular-nums">
                {totalPerda.toFixed(2)} €
              </span>
            </div>

            <button
              type="button"
              onClick={handleFinalizar}
              disabled={itens.length === 0 || aSubmeter}
              className="w-full mt-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base"
            >
              {aSubmeter ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>A submeter...</span>
                </>
              ) : (
                <>
                  <span>⚠</span>
                  <span>Finalizar e Submeter Quebras</span>
                  {itens.length > 0 && (
                    <span className="bg-amber-800 text-xs px-2 py-0.5 rounded-full">
                      {itens.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </section>

        {/* ─── COLUNA DIREITA — Identificação + pesquisa ─── */}
        <section className="flex flex-col gap-3 overflow-hidden">

          {/* Leitura de código de barras */}
          <PainelPesquisa
            onSelecionarProduto={setModal}
            produtosJaAdicionados={itens.map((i) => i.produto.id)}
          />

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5 flex-shrink-0">
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <span>ℹ</span> Como funciona
            </div>
            <div className="text-blue-800 space-y-1">
              <p>1. Bipe ou pesquise o produto</p>
              <p>2. Indique a quantidade e o motivo</p>
              <p>3. Repita para mais artigos</p>
              <p>4. Clique "Finalizar e Submeter Quebras"</p>
            </div>
            <div className="pt-1 border-t border-blue-200 text-blue-700">
              Campos obrigatórios: Quantidade e Motivo.
              O registo é imutável após submissão.
            </div>
          </div>
        </section>
      </main>

      {/* Modal de adição */}
      {modalProduto && (
        <ModalQuebra
          produto={modalProduto}
          jaExisteNaLista={itens.some((i) => i.produto.id === modalProduto.id)}
          quantidadeExistente={itens.find((i) => i.produto.id === modalProduto.id)?.quantidade ?? 1}
          motivoExistente={itens.find((i) => i.produto.id === modalProduto.id)?.motivo ?? null}
          onConfirmar={adicionarItem}
          onCancelar={() => setModal(null)}
        />
      )}

      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  PAINEL DE PESQUISA
// ═══════════════════════════════════════════════════════════════════

function PainelPesquisa({
  onSelecionarProduto,
  produtosJaAdicionados
}: {
  onSelecionarProduto:   (p: ProdutoLocal) => void
  produtosJaAdicionados: number[]
}) {
  const [ean, setEan]               = useState('')
  const [pesquisa, setPesquisa]     = useState('')
  const [resultados, setResultados] = useState<ProdutoLocal[]>([])
  const [loading, setLoading]       = useState(false)
  const eanRef = useRef<HTMLInputElement>(null)

  useEffect(() => { eanRef.current?.focus() }, [])

  // Debounce na pesquisa por nome
  useEffect(() => {
    const termo = pesquisa.trim()
    if (termo.length < 2) { setResultados([]); return }
    const delay = setTimeout(async () => {
      const r = await window.api.catalogo.pesquisar(termo)
      if (r.ok) setResultados(r.data.slice(0, 8))
    }, 150)
    return () => clearTimeout(delay)
  }, [pesquisa])

  const handleEanEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const codigo = ean.trim()
    if (!codigo) return
    setLoading(true)
    const r = await window.api.catalogo.porEan(codigo)
    setLoading(false)
    if (r.ok && r.data) {
      onSelecionarProduto(r.data)
      setEan('')
    } else {
      // Tenta por pesquisa se não for EAN exacto
      const r2 = await window.api.catalogo.pesquisar(codigo)
      if (r2.ok && r2.data.length === 1) {
        onSelecionarProduto(r2.data[0])
        setEan('')
      } else {
        setEan('')
        // Nada encontrado — sem toast para não interromper o fluxo de bipagem
      }
    }
  }

  const seleccionar = (p: ProdutoLocal) => {
    setPesquisa('')
    setResultados([])
    onSelecionarProduto(p)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-900">Identificação do Artigo</h2>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* EAN / Leitor */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            Leitura de Código de Barras
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">≡</span>
            <input
              ref={eanRef}
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              onKeyDown={handleEanEnter}
              placeholder={loading ? 'A procurar...' : 'Aguardando leitura...'}
              className="w-full pl-10 pr-10 py-3 text-sm border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Bipe o produto ou introduza o código manualmente + Enter
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
          <span className="relative bg-white px-3 text-xs text-slate-400 block text-center w-fit mx-auto">
            ou pesquisa manual
          </span>
        </div>

        {/* Pesquisa por nome */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            Pesquisa Manual
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">≡</span>
            <input
              type="text"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Nome ou referência do produto..."
              className="w-full pl-10 pr-10 py-3 text-sm border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          </div>

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
              {resultados.map((p) => {
                const jaAdicionado = produtosJaAdicionados.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => seleccionar(p)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${
                      jaAdicionado
                        ? 'bg-amber-50 hover:bg-amber-100'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{p.artigo}</div>
                      <div className="text-xs text-slate-500 font-mono">{p.ean}</div>
                    </div>
                    {jaAdicionado && (
                      <span className="text-[10px] font-semibold bg-amber-500 text-white px-1.5 py-0.5 rounded flex-shrink-0">
                        Na lista
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  MODAL DE QUEBRA
// ═══════════════════════════════════════════════════════════════════

interface ModalQuebraProps {
  produto:             ProdutoLocal
  jaExisteNaLista:     boolean
  quantidadeExistente: number
  motivoExistente:     MotivoQuebra | null
  onConfirmar:         (produto: ProdutoLocal, quantidade: number, motivo: MotivoQuebra) => void
  onCancelar:          () => void
}

function ModalQuebra({
  produto,
  jaExisteNaLista,
  quantidadeExistente,
  motivoExistente,
  onConfirmar,
  onCancelar
}: ModalQuebraProps) {
  const [quantidade, setQuantidade] = useState(quantidadeExistente)
  const [motivo, setMotivo]         = useState<MotivoQuebra | null>(motivoExistente)

  const valorPerdido = produto.precoCusto * quantidade
  const podeConfirmar = quantidade >= 1 && motivo !== null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="bg-amber-700 text-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-amber-200">
              {jaExisteNaLista ? 'Editar Quebra' : 'Justificação de Quebra Obrigatória'}
            </div>
            <button
              type="button"
              onClick={onCancelar}
              className="text-amber-300 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Info do produto */}
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <div className="text-base font-bold text-slate-900">{produto.artigo}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
              <span className="font-mono">REF: {produto.ean}</span>
              <span>·</span>
              <span>PVP: {produto.pvp.toFixed(2)} €</span>
              {produto.perecivel && (
                <>
                  <span>·</span>
                  <span className="text-amber-700 font-semibold">Perecível</span>
                </>
              )}
            </div>
          </div>

          {/* Quantidade */}
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Quantidade a Abateri
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                className="w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl text-2xl font-bold text-slate-800 transition-colors"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 text-center text-3xl font-bold tabular-nums text-slate-900 border-2 border-slate-300 rounded-xl py-2 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setQuantidade(quantidade + 1)}
                className="w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl text-2xl font-bold text-slate-800 transition-colors"
              >
                +
              </button>
            </div>

            {/* Preview financeiro */}
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-red-700">Valor a perder:</span>
              <span className="text-lg font-bold text-red-700 tabular-nums">
                € {valorPerdido.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Motivo — poka-yoke */}
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
              Motivo da Quebra
              {!motivo && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Obrigatório
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MOTIVOS.map((m) => {
                const seleccionado = motivo === m.valor
                return (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setMotivo(m.valor)}
                    className={`flex flex-col items-center gap-2 px-2 py-3 rounded-xl border-2 transition-all ${
                      seleccionado
                        ? m.cor.card + ' shadow-sm scale-[1.02]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-3xl">{m.icone}</span>
                    <div className="text-[11px] font-semibold text-center leading-tight">
                      {m.label}
                    </div>
                    <div className="text-[9px] text-center opacity-70 leading-tight">
                      {m.sublabel}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botão confirmar */}
          <button
            type="button"
            onClick={() => podeConfirmar && onConfirmar(produto, quantidade, motivo!)}
            disabled={!podeConfirmar}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-base"
          >
            {!motivo ? (
              'Seleccione o motivo'
            ) : (
              <>
                <span>⚠</span>
                <span>
                  {jaExisteNaLista ? 'Actualizar Quebra' : 'Confirmar Quebra'}
                </span>
                <span className="text-amber-200 font-normal text-sm">
                  · {valorPerdido.toFixed(2)} €
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
