/**
 * DashboardPage — Hub principal do POS após login (Fase 3 — UI redesign)
 *
 * Layout:
 *   - Header azul-marinho (coerente com Login):
 *       · Logo + identificação da loja/operador (esquerda)
 *       · Relógio grande + data (centro)
 *       · SyncStatusBadge + botão "Terminar Sessão" (direita)
 *       · Botão pequeno "Sincronizar Catálogo" (canto inferior-direito do header)
 *   - Body com fundo claro:
 *       · Saudação personalizada
 *       · Grelha de botões grandes coloridos para os UCs principais + Sobre
 *
 * Decisões UX:
 *   - Botões grandes com cores distintas (Lei de Fitts + memorização visual)
 *   - Sincronizar Catálogo é uma acção secundária — botão pequeno no header
 *   - Estado do sync vem do hook useSyncStatus (real-time)
 */

import { useCallback, useEffect, useState } from 'react'
import { Toast, ToastData } from '../components/Toast'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import logoUrl from '../assets/logo.png'
import type { OperadorSessao } from '../../../shared/types'
import { SobrePage } from './SobrePage'

interface DashboardPageProps {
  operador: OperadorSessao
  onLogout: () => void
  onNavigate: (
    destino: 'venda' | 'quebras' | 'fecho' | 'devolucoes' | 'rececoes' | 'transferencias' | 'sobre'
  ) => void
}

type Pagina = 'venda' | 'quebras' | 'fecho' | 'devolucoes' | 'rececoes' | 'transferencias' | 'sobre' | null

export function DashboardPage({ operador, onLogout, onNavigate }: DashboardPageProps) {
  const [totalProdutos, setTotalProdutos] = useState<number>(0)
  const [ultimoSync,    setUltimoSync]    = useState<string | null>(null)
  const [aSincronizar,  setASincronizar]  = useState(false)
  const [toast,         setToast]         = useState<ToastData | null>(null)
  const [relogio,       setRelogio]       = useState(() => new Date())
  const [pagina,        setPagina]        = useState<Pagina>(null)

  // ─── Relógio: actualiza a cada 30s ───────────────────────────
  useEffect(() => {
    const i = setInterval(() => setRelogio(new Date()), 30_000)
    return () => clearInterval(i)
  }, [])

  // ─── Estatísticas do catálogo ────────────────────────────────
  const refrescarEstatisticas = useCallback(async (): Promise<void> => {
    const [contarRes, ultSyncRes] = await Promise.all([
      window.api.catalogo.contar(),
      window.api.config.get('ultimo_sync_catalogo')
    ])
    if (contarRes.ok)  setTotalProdutos(contarRes.data)
    if (ultSyncRes.ok) setUltimoSync(ultSyncRes.data)
  }, [])

  useEffect(() => {
    void refrescarEstatisticas()
    // Sincronizar catálogo automaticamente no arranque (silencioso se offline)
    void window.api.catalogo.sync().catch(() => {})
  }, [refrescarEstatisticas])

  // ─── Sync manual do catálogo ──────────────────────────────────
  const handleSync = async (): Promise<void> => {
    if (aSincronizar) return
    setASincronizar(true)

    const r = await window.api.catalogo.sync()
    setASincronizar(false)

    if (!r.ok) {
      setToast({ kind: 'error', message: `Sincronização falhou: ${r.error}` })
      return
    }

    const { inseridos, atualizados, total } = r.data
    setToast({
      kind: 'success',
      message:
        inseridos === 0 && atualizados === 0
          ? `Catálogo já está actualizado (${total} produtos).`
          : `Sincronizados ${total} produtos — ${inseridos} novos, ${atualizados} actualizados.`
    })

    await refrescarEstatisticas()
  }

  // ─── Derivações ──────────────────────────────────────────────

  const horaFormatada = relogio.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  const dataFormatada = relogio.toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  const naoTemCatalogo = totalProdutos === 0

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════

  if (pagina === 'sobre') return (
    <SobrePage operador={operador} onVoltar={() => setPagina(null)} />
  )

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col">

      {/* ═══════════════════════ HEADER ═══════════════════════ */}
      <header className="bg-blue-900 text-white shadow-md">
        {/* Linha principal */}
        <div className="px-6 py-3 flex items-center justify-between gap-6">

          {/* ESQUERDA — logo + identificação */}
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
              <img
                src={logoUrl}
                alt="BragaConvenience"
                className="h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">
                BragaConvenience · {operador.lojaBaseNome}
              </div>
              <div className="text-xs text-blue-200">
                Operador: {operador.nome} <span className="text-blue-300">·</span> {operador.perfil}
              </div>
            </div>
          </div>

          {/* CENTRO — relógio */}
          <div className="text-center">
            <div className="text-3xl font-light tracking-wider tabular-nums">
              {horaFormatada}
            </div>
            <div className="text-xs text-blue-200 uppercase tracking-wide mt-0.5">
              {dataFormatada}
            </div>
          </div>

          {/* DIREITA — sync badge + logout */}
          <div className="flex items-center gap-3">
            <SyncStatusBadge tema="dark" />
            <button
              type="button"
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-all"
            >
              Terminar Sessão
            </button>
          </div>
        </div>

        {/* Linha secundária do header — botão pequeno de sync catálogo */}
        <div className="px-6 pb-3 flex justify-end">
          <button
            type="button"
            onClick={handleSync}
            disabled={aSincronizar}
            className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-700 active:bg-blue-700 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-blue-100 hover:text-white text-xs font-medium px-3 py-1.5 rounded-md border border-blue-700 transition-all"
            title={ultimoSync ? `Última: ${new Date(ultimoSync).toLocaleString('pt-PT')}` : 'Nunca sincronizado'}
          >
            {aSincronizar ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                A sincronizar...
              </>
            ) : (
              <>
                <span>↻</span>
                Sincronizar Catálogo
                <span className="text-blue-300">
                  ({totalProdutos} {totalProdutos === 1 ? 'produto' : 'produtos'})
                </span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ═══════════════════════ CONTEÚDO ═══════════════════════ */}
      <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full">

        {/* Saudação */}
        <h1 className="text-2xl font-semibold text-slate-900 text-center mb-8">
          Olá, <span className="font-bold">{operador.nome}</span>. O que pretende fazer?
        </h1>

        {/* Aviso se catálogo vazio */}
        {naoTemCatalogo && (
          <div className="max-w-2xl mx-auto mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-2xl leading-none">⚠</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-900">Catálogo vazio</div>
              <div className="text-sm text-amber-800 mt-0.5">
                Sincronize o catálogo no botão do canto superior direito antes de iniciar uma venda.
              </div>
            </div>
          </div>
        )}

        {/* Grelha de acções */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-5">
          <ActionTile
            icone="🛒"
            titulo="Nova Venda"
            cor="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
            disabled={naoTemCatalogo}
            onClick={() => { setPagina('venda'); onNavigate('venda'); }}
          />

          <ActionTile
            icone="📦"
            titulo="Receção de Mercadoria"
            cor="bg-blue-700 hover:bg-blue-800 active:bg-blue-900"
            disabled={naoTemCatalogo}
            onClick={() => { setPagina('rececoes'); onNavigate('rececoes'); }}
          />

          <ActionTile
            icone="🚚"
            titulo="Transferências"
            cor="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
            onClick={() => { setPagina('transferencias'); onNavigate('transferencias'); }}
          />

          <ActionTile
            icone="↩"
            titulo="Devoluções"
            cor="bg-amber-500 hover:bg-amber-600 active:bg-amber-700"
            onClick={() => { setPagina('devolucoes'); onNavigate('devolucoes'); }}
          />

          <ActionTile
            icone="📋"
            titulo="Registo de Quebras"
            cor="bg-orange-700 hover:bg-orange-800 active:bg-orange-900"
            disabled={naoTemCatalogo}
            onClick={() => { setPagina('quebras'); onNavigate('quebras'); }}
          />

          <ActionTile
            icone="🔒"
            titulo="Fecho de Caixa"
            cor="bg-red-600 hover:bg-red-700 active:bg-red-800"
            onClick={() => { setPagina('fecho'); onNavigate('fecho'); }}
          />
        </section>

        {/* Botão Sobre */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPagina('sobre')}
            className="flex flex-col items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl p-4 transition-all w-32"
          >
            <span className="text-3xl">ℹ</span>
            <span className="text-xs font-medium">Sobre</span>
          </button>
        </div>

      </main>

      {/* Toast */}
      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════ SUBCOMPONENTES ═══════════════════════

interface ActionTileProps {
  icone:    string
  titulo:   string
  cor:      string
  onClick:  () => void
  disabled?: boolean
}

function ActionTile({ icone, titulo, cor, onClick, disabled }: ActionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${cor} disabled:bg-slate-300 disabled:cursor-not-allowed disabled:hover:bg-slate-300 text-white rounded-2xl p-8 text-center transition-all shadow-md hover:shadow-xl active:scale-[0.97] aspect-[4/3] flex flex-col items-center justify-center gap-3`}
    >
      <div className="text-5xl leading-none">{icone}</div>
      <div className="text-xl font-bold leading-tight">{titulo}</div>
    </button>
  )
}