/**
 * SobrePage — Informação do terminal POS.
 *
 * Mostra:
 *   - Versão do software
 *   - Loja configurada
 *   - Operador actual
 *   - Último sync
 *   - Estado da ligação à Sede
 */

import { useEffect, useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import logoUrl from '../assets/logo.png'
import type { OperadorSessao, SyncWorkerStatus } from '../../../shared/types'

interface SobrePageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

const VERSAO = '1.0.0'
const BUILD  = 'LI4-2025/2026'

export function SobrePage({ operador, onVoltar }: SobrePageProps) {
  const [syncStatus, setSyncStatus]     = useState<SyncWorkerStatus | null>(null)
  const [ultimoSync, setUltimoSync]     = useState<string | null>(null)
  const [apiUrl, setApiUrl]             = useState<string | null>(null)

  useEffect(() => {
    const carregar = async () => {
      try {
        const statusR = await window.api.sync.getStatus()
        if (statusR.ok) setSyncStatus(statusR.data)
      } catch { /* ignora */ }
      

      try {
        const cfgR = await window.api.config.get('ultimo_sync_vendas')
        if (cfgR.ok && cfgR.data) setUltimoSync(cfgR.data)
      } catch { /* ignora */ }

      try {
        const urlR = await window.api.config.get('api_base_url')
        if (urlR.ok && urlR.data) setApiUrl(urlR.data)
      } catch { /* ignora */ }
    }
    void carregar()
  }, [])

  const formatarData = (iso: string | null): string => {
    if (!iso) return 'Nunca'
    try {
      return new Date(iso).toLocaleString('pt-PT', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    } catch { return iso }
  }

  const estadoSync = syncStatus?.estado ?? 'idle'
  const corEstado  = estadoSync === 'syncing' ? 'text-blue-600' :
                     estadoSync === 'error'   ? 'text-red-600'  :
                     estadoSync === 'offline' ? 'text-slate-500':
                     'text-green-600'
  const iconeEstado = estadoSync === 'syncing' ? '⟳' :
                      estadoSync === 'error'   ? '✕' :
                      estadoSync === 'offline' ? '○' : '●'

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">

      {/* Header */}
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
              <div className="text-sm font-semibold">Sobre o Terminal POS</div>
              <div className="text-xs text-blue-200">{operador.lojaBaseNome}</div>
            </div>
          </div>
          <SyncStatusBadge tema="dark" />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-4">

          {/* Logo + versão */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center p-3 flex-shrink-0 border border-slate-200">
              <img src={logoUrl} alt="BragaConvenience" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">BragaConvenience POS</div>
              <div className="text-slate-500 mt-1">
                Versão <span className="font-mono font-semibold text-slate-700">{VERSAO}</span>
                <span className="ml-3 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{BUILD}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Sistema de Gestão de Ponto de Venda — BIS · UMinho LI4
              </div>
            </div>
          </div>

          {/* Terminal e Operador */}
          <div className="grid grid-cols-2 gap-4">
            <InfoCard titulo="Terminal" icone="🏪">
              <InfoLinha label="Loja"      valor={operador.lojaBaseNome} />
              <InfoLinha label="ID da Loja" valor={String(operador.lojaBaseId)} mono />
              <InfoLinha label="API Sede" valor={apiUrl ?? 'http://13.48.156.89:5254'} mono />
            </InfoCard>

            <InfoCard titulo="Operador" icone="👤">
              <InfoLinha label="Nome"   valor={operador.nome} />
              <InfoLinha label="NIF"    valor={operador.nif} mono />
              <InfoLinha label="Perfil" valor={operador.perfil} />
            </InfoCard>
          </div>

          {/* Estado da sincronização */}
          <InfoCard titulo="Sincronização com a Sede" icone="🔄">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${corEstado}`}>{iconeEstado}</span>
                <span className={`text-sm font-semibold capitalize ${corEstado}`}>
                  {estadoSync === 'idle'    ? 'Em espera' :
                   estadoSync === 'syncing' ? 'A sincronizar...' :
                   estadoSync === 'error'   ? 'Erro de ligação' :
                   estadoSync === 'offline' ? 'Sem ligação' :
                   estadoSync}
                </span>
              </div>
              {syncStatus?.pendentes !== undefined && syncStatus.pendentes > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {syncStatus.pendentes} pendente(s)
                </span>
              )}
            </div>
            <InfoLinha label="Último sync"      valor={formatarData(ultimoSync)} />
            <InfoLinha label="Total sincronizadas" valor={String(syncStatus?.sincronizadasTotal ?? 0)} />
            {syncStatus?.ultimoErro && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
                {syncStatus.ultimoErro}
              </div>
            )}

            <button
              type="button"
              onClick={() => window.api.sync.forcar()}
              className="mt-3 w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              ↻ Forçar Sincronização
            </button>
          </InfoCard>

          {/* Rodapé */}
          <div className="text-center text-xs text-slate-400 py-2">
            BragaConvenience · Braga, Portugal · LI4 2025/2026 · UMinho
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────

function InfoCard({ titulo, icone, children }: { titulo: string; icone: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <span className="text-lg">{icone}</span>
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{titulo}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoLinha({ label, valor, mono = false }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-slate-900 truncate text-right ${mono ? 'font-mono' : ''}`}>
        {valor}
      </span>
    </div>
  )
}
