/**
 * DevolucoesPage (UC02) — Devoluções de Artigos.
 *
 * Redesign Fase 3:
 *   - Header azul-marinho consistente com as outras páginas
 *   - Fase 1: pesquisa por UUID (bipe QR ou manual)
 *   - Fase 2: 2 colunas (linhas da venda | resumo + confirmar)
 *   - Fase 3: ecrã de sucesso consistente
 *   - Método de pagamento bem destacado (reembolso pelo mesmo canal)
 *   - window.confirm removido — botão com preview do valor
 */

import { useRef, useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { Toast, ToastData } from '../components/Toast'
import logoUrl from '../assets/logo.png'
import type {
  DevolucaoInput,
  DevolucaoResultado,
  OperadorSessao,
  VendaOriginal
} from '../../../shared/types'

interface DevolucoesPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

type Fase = 'pesquisa' | 'selecao' | 'concluido'

function nomeMetodo(m: number): string {
  return m === 1 ? 'Numerário' : m === 2 ? 'Multibanco' : m === 3 ? 'MBWay' : `#${m}`
}
function iconeMetodo(m: number): string {
  return m === 1 ? '💵' : m === 2 ? '💳' : m === 3 ? '📱' : '💰'
}
function corMetodo(m: number): string {
  return m === 1
    ? 'bg-green-50 text-green-900 border-green-300'
    : m === 2
    ? 'bg-blue-50 text-blue-900 border-blue-300'
    : 'bg-indigo-50 text-indigo-900 border-indigo-300'
}

export function DevolucoesPage({ operador, onVoltar }: DevolucoesPageProps) {
  const [fase, setFase]               = useState<Fase>('pesquisa')
  const [idTalao, setIdTalao]         = useState('')
  const [aProcurar, setAProcurar]     = useState(false)
  const [venda, setVenda]             = useState<VendaOriginal | null>(null)
  const [quantidades, setQuantidades] = useState<Record<number, number>>({})
  const [motivo, setMotivo]           = useState('')
  const [aConfirmar, setAConfirmar]   = useState(false)
  const [resultado, setResultado]     = useState<DevolucaoResultado | null>(null)
  const [toast, setToast]             = useState<ToastData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleProcurar = async (): Promise<void> => {
    const id = idTalao.trim()
    if (!id) { setToast({ kind: 'error', message: 'Indique o ID do talão.' }); return }
    setAProcurar(true)
    const r = await window.api.devolucoes.obterVenda(id)
    setAProcurar(false)
    if (!r.ok) { setToast({ kind: 'error', message: `Erro: ${r.error}` }); return }
    if (!r.data) { setToast({ kind: 'error', message: 'Venda não encontrada nesta loja.' }); return }
    const qtds: Record<number, number> = {}
    for (const l of r.data.linhas) qtds[l.produtoId] = 0
    setVenda(r.data); setQuantidades(qtds); setMotivo(''); setFase('selecao')
  }

  const handleConfirmar = async (): Promise<void> => {
    if (!venda) return
    const linhas = Object.entries(quantidades)
      .filter(([, q]) => q > 0)
      .map(([pid, q]) => {
        const orig = venda.linhas.find((l) => l.produtoId === Number(pid))!
        return { produtoId: Number(pid), quantidade: q, precoUnitario: orig.precoUnitario }
      })
    if (linhas.length === 0) { setToast({ kind: 'error', message: 'Seleccione pelo menos 1 artigo.' }); return }
    const input: DevolucaoInput = { vendaOriginalId: venda.id, operadorId: operador.id, motivo: motivo.trim() || null, linhas }
    setAConfirmar(true)
    const r = await window.api.devolucoes.registar(input)
    setAConfirmar(false)
    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    setResultado(r.data); setFase('concluido')
  }

  const ajustar = (produtoId: number, delta: number): void => {
    const linha = venda?.linhas.find((l) => l.produtoId === produtoId)
    if (!linha) return
    const max = linha.quantidadeOriginal - linha.quantidadeJaDevolvida
    const cur = quantidades[produtoId] ?? 0
    setQuantidades({ ...quantidades, [produtoId]: Math.max(0, Math.min(max, cur + delta)) })
  }

  const totalReembolso = venda
    ? venda.linhas.reduce((acc, l) => acc + (quantidades[l.produtoId] ?? 0) * l.precoUnitario, 0)
    : 0
  const numLinhas = Object.values(quantidades).filter((q) => q > 0).length

  // ─── Header partilhado ────────────────────────────────────────
  const header = (
    <header className="bg-blue-900 text-white flex-shrink-0">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fase === 'selecao' ? () => { setVenda(null); setQuantidades({}); setFase('pesquisa') } : onVoltar}
            className="bg-blue-800 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded transition-colors"
          >
            {fase === 'selecao' ? '← Nova pesquisa' : '← Voltar'}
          </button>
          <div className="bg-white rounded p-1 flex-shrink-0">
            <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold">Devoluções · {operador.lojaBaseNome}</div>
            <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {fase === 'selecao' && venda && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-lg border ${corMetodo(venda.metodoPagamento)}`}>
              {iconeMetodo(venda.metodoPagamento)} Reembolso via {nomeMetodo(venda.metodoPagamento)}
            </span>
          )}
          <SyncStatusBadge tema="dark" />
        </div>
      </div>
    </header>
  )

  // ════════════════ FASE 1 — PESQUISA ════════════════

  if (fase === 'pesquisa') {
    return (
      <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
        {header}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-4">

            <div className="text-center mb-2">
              <h1 className="text-2xl font-bold text-slate-900">Devolução de Artigos</h1>
              <p className="text-sm text-slate-500 mt-1">Bipe o QR do talão ou introduza o ID da venda</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  ID do Talão / Código de Barras
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">≡</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={idTalao}
                    onChange={(e) => setIdTalao(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleProcurar() }}
                    placeholder="Bipe o talão ou cole o UUID da venda..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 text-sm border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleProcurar}
                disabled={!idTalao.trim() || aProcurar}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base shadow-md transition-all"
              >
                {aProcurar ? 'A procurar...' : '🔍 Procurar Fatura'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5">
              <div className="font-semibold text-sm flex items-center gap-1.5"><span>ℹ</span> Como funciona</div>
              <div className="space-y-1 text-blue-800">
                <p>1. O ID encontra-se no talão impresso ou no histórico de vendas</p>
                <p>2. Seleccione os artigos e quantidades a devolver</p>
                <p>3. O reembolso é feito pelo mesmo método de pagamento da venda</p>
                <p>4. O stock é reposto automaticamente após confirmação</p>
              </div>
            </div>
          </div>
        </main>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ════════════════ FASE 2 — SELECÇÃO ════════════════

  if (fase === 'selecao' && venda) {
    return (
      <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
        {header}
        <main className="flex-1 grid grid-cols-[1.4fr_1fr] gap-3 p-3 overflow-hidden">

          {/* Coluna esquerda — linhas da venda */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

            {/* Info da venda */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-slate-900">Detalhe da Fatura</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {venda.id.slice(0, 16)}...</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">{new Date(venda.dataTransacao).toLocaleString('pt-PT')}</div>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold mt-1 px-2.5 py-0.5 rounded-full border ${corMetodo(venda.metodoPagamento)}`}>
                  {iconeMetodo(venda.metodoPagamento)} {nomeMetodo(venda.metodoPagamento)}
                </div>
              </div>
            </div>

            {/* Cabeçalho tabela */}
            <div className="grid grid-cols-[1fr_72px_90px_90px] gap-2 px-5 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex-shrink-0">
              <span>Artigo</span>
              <span className="text-right">Preço</span>
              <span className="text-center">Devolver</span>
              <span className="text-right">Reembolso</span>
            </div>

            {/* Linhas */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {venda.linhas.map((linha) => {
                const disponivel = linha.quantidadeOriginal - linha.quantidadeJaDevolvida
                const aDevolver  = quantidades[linha.produtoId] ?? 0
                const subtotal   = aDevolver * linha.precoUnitario
                const tudo       = disponivel === 0

                return (
                  <div
                    key={linha.produtoId}
                    className={`grid grid-cols-[1fr_72px_90px_90px] gap-2 px-5 py-3 items-center ${
                      tudo ? 'opacity-40' : aDevolver > 0 ? 'bg-red-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 truncate">{linha.artigo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {linha.quantidadeOriginal} un. compradas
                        {linha.quantidadeJaDevolvida > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">· {linha.quantidadeJaDevolvida} já devolvidas</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-sm text-slate-700 tabular-nums">{linha.precoUnitario.toFixed(2)} €</div>

                    {tudo ? (
                      <div className="text-center text-xs text-slate-500 italic">✓ Tudo</div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => ajustar(linha.produtoId, -1)} disabled={aDevolver === 0}
                          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded text-sm font-bold">−</button>
                        <div className="text-center w-9">
                          <div className="text-base font-bold tabular-nums">{aDevolver}</div>
                          <div className="text-[9px] text-slate-500">/{disponivel}</div>
                        </div>
                        <button type="button" onClick={() => ajustar(linha.produtoId, +1)} disabled={aDevolver >= disponivel}
                          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded text-sm font-bold">+</button>
                      </div>
                    )}

                    <div className="text-right text-sm font-bold tabular-nums">
                      {aDevolver > 0 ? <span className="text-red-700">−{subtotal.toFixed(2)} €</span> : <span className="text-slate-400">—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Coluna direita — resumo + confirmar */}
          <section className="flex flex-col gap-3 overflow-hidden">

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex-shrink-0 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Resumo da Devolução</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Artigos a devolver</span>
                <span className="font-semibold text-slate-900">{numLinhas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total venda original</span>
                <span className="font-semibold text-slate-900 tabular-nums">{venda.valorTotal.toFixed(2)} €</span>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs text-slate-500 mb-1">Valor a Reembolsar</div>
                <div className="text-4xl font-bold text-red-700 tabular-nums">{totalReembolso.toFixed(2)} €</div>
              </div>
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${corMetodo(venda.metodoPagamento)}`}>
                <span className="text-2xl">{iconeMetodo(venda.metodoPagamento)}</span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Reembolso via</div>
                  <div className="text-base font-bold">{nomeMetodo(venda.metodoPagamento)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-shrink-0">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Motivo <span className="text-slate-400 normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: cliente trocou de ideias, produto danificado..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={aConfirmar || totalReembolso === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-6 rounded-xl shadow-lg transition-all flex flex-col items-center gap-1 text-base"
            >
              {aConfirmar ? <span>A processar...</span> : totalReembolso === 0 ? (
                <><span className="text-2xl">↩</span><span>Seleccione artigos</span></>
              ) : (
                <><span className="text-2xl">↩</span><span>Emitir Nota de Crédito</span>
                <span className="text-red-200 font-normal text-sm">{totalReembolso.toFixed(2)} € · {nomeMetodo(venda.metodoPagamento)}</span></>
              )}
            </button>
          </section>
        </main>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ════════════════ FASE 3 — CONCLUÍDO ════════════════

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
      {header}
      <main className="flex-1 flex items-center justify-center p-6">
        {resultado && (
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-red-600 text-3xl font-bold flex-shrink-0">↩</div>
              <div>
                <div className="text-xl font-bold">Devolução registada</div>
                <div className="text-sm text-red-100 mt-0.5">Stock reposto · Reembolso processado</div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Comprovativo</div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-500 mb-0.5">Referência</div>
                <div className="font-mono text-xs text-slate-800 break-all">{resultado.id}</div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Data</span>
                <span className="font-semibold text-slate-900">{new Date(resultado.dataDevolucao).toLocaleString('pt-PT')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Linhas devolvidas</span>
                <span className="font-semibold text-slate-900">{resultado.numeroLinhas}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-500">Valor reembolsado</span>
                <span className="font-bold text-red-700 text-xl tabular-nums">{resultado.valorReembolsado.toFixed(2)} €</span>
              </div>
              {venda && (
                <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${corMetodo(venda.metodoPagamento)}`}>
                  <span className="text-2xl">{iconeMetodo(venda.metodoPagamento)}</span>
                  <div className="text-sm font-semibold">Reembolso entregue via {nomeMetodo(venda.metodoPagamento)}</div>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-800">
                <span>⚠</span> Pendente de sincronização com a Sede
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button"
                  onClick={() => { setIdTalao(''); setVenda(null); setQuantidades({}); setResultado(null); setFase('pesquisa') }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-xl">
                  Nova Devolução
                </button>
                <button type="button" onClick={onVoltar}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl">
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
