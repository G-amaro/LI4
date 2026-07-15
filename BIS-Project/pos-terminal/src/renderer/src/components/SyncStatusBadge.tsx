/**
 * SyncStatusBadge — Indicador compacto de estado de sincronização.
 *
 * Usado nos headers da VendaPage, QuebrasPage e FechoCaixaPage
 * (no Dashboard já existe um card maior — o SyncStatusCard).
 *
 * Reutiliza o hook useSyncStatus que já escuta eventos do SyncWorker
 * em tempo real — não há polling nem lógica nova.
 *
 * Estados visuais:
 *   - Verde pulsante:  'idle' com 0 pendentes
 *   - Azul pulsante:   'syncing' (ciclo activo)
 *   - Âmbar:           'idle' mas com pendentes (esperando próximo tick)
 *   - Vermelho:        'error' (falha de rede ou rejeição)
 */

import { useSyncStatus } from '../hooks/useSyncStatus'

interface Props {
  /** Se true, mostra o botão "Sincronizar". Default = true. */
  comBotao?: boolean
  /** Variante de cor para combinar com o header (dark = fundo escuro). */
  tema?: 'dark' | 'light' | 'amber'
}

export function SyncStatusBadge({ comBotao = true, tema = 'dark' }: Props) {
  const { status, forcarSync, aForcar } = useSyncStatus()

  if (!status) {
    // Estado inicial — antes do primeiro tick do worker
    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs ${corBase(tema)}`}>
        <span className="w-2 h-2 bg-slate-400 rounded-full" />
        <span className="text-slate-400">a iniciar...</span>
      </div>
    )
  }

  const { estado, pendentes, ultimoErro } = status

  const config = (() => {
    switch (estado) {
      case 'syncing':
        return { dot: 'bg-blue-400',  pulse: true,  label: 'A sincronizar',          tooltip: 'Envio de dados em curso' }
      case 'error':
        if (ultimoErro?.includes('Sessão offline')) {
          return { dot: 'bg-amber-400', pulse: false, label: 'Login necessário', tooltip: 'Sessão offline — faça logout e login online para sincronizar' }
        }
        return { dot: 'bg-red-500',   pulse: false, label: 'Offline',                 tooltip: ultimoErro ?? 'Erro de rede' }
      case 'paused':
        return { dot: 'bg-slate-500', pulse: false, label: 'Pausado',                 tooltip: 'Sync inactivo' }
      default:
        return pendentes > 0
          ? { dot: 'bg-amber-400', pulse: false, label: `${pendentes} pendentes`,      tooltip: `${pendentes} registo(s) aguardam envio` }
          : { dot: 'bg-green-400', pulse: true,  label: 'Online',                      tooltip: 'Sincronizado com a Sede' }
    }
  })()

  return (
    <div className="flex items-center gap-2" title={config.tooltip}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${corBase(tema)}`}>
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
        <span className={`text-xs font-medium ${corTexto(tema)}`}>
          {config.label}
        </span>
      </div>

      {comBotao && (
        <button
          type="button"
          onClick={() => void forcarSync()}
          disabled={aForcar || estado === 'syncing'}
          className={`text-xs px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 ${corBotao(tema)}`}
          title="Sincronizar agora"
        >
          {aForcar ? '...' : '↻'}
        </button>
      )}
    </div>
  )
}

// ─── Paleta por tema ──────────────────────────────────────────────

function corBase(tema: 'dark' | 'light' | 'amber'): string {
  switch (tema) {
    case 'light': return 'bg-slate-100 border border-slate-200'
    case 'amber': return 'bg-amber-800/40'
    default:      return 'bg-slate-700'
  }
}

function corTexto(tema: 'dark' | 'light' | 'amber'): string {
  switch (tema) {
    case 'light': return 'text-slate-700'
    case 'amber': return 'text-amber-100'
    default:      return 'text-slate-200'
  }
}

function corBotao(tema: 'dark' | 'light' | 'amber'): string {
  switch (tema) {
    case 'light': return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
    case 'amber': return 'bg-amber-800 hover:bg-amber-900 text-white'
    default:      return 'bg-slate-700 hover:bg-slate-600 text-slate-200'
  }
}
