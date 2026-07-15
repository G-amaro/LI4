/**
 * FechoCaixaPage — UC03: Fecho de Caixa Cego.
 *
 * Redesign Fase 3 — fiel aos protótipos:
 *
 * Fase 1 — Declaração Cega:
 *   Layout 2 colunas:
 *   - Esquerda: contador de notas e moedas por denominação (+/− por linha)
 *   - Direita: inputs directos Multibanco e MBWay + resumo do turno
 *   O operador NÃO vê o valor teórico nesta fase.
 *
 * Fase 2 — Reconciliação:
 *   Tabela com 3 estados por método:
 *   - ✓ Correto (verde): |diff| < 0.01€
 *   - △ Desvio mínimo (âmbar): 0.01€ ≤ |diff| ≤ 5€ — não bloqueia
 *   - ✕ Discrepância (vermelho): |diff| > 5€ — exige justificação
 *   Botão "← Corrigir declaração" disponível.
 *
 * Fase 3 — Relatório Final:
 *   Reconciliação por método + "assinatura digital" + botões de acção.
 */

import { useState } from 'react'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { Toast, ToastData } from '../components/Toast'
import logoUrl from '../assets/logo.png'
import type {
  FechoInput,
  OperadorSessao,
  ResultadoFecho,
  ValoresPorMetodo
} from '../../../shared/types'

interface FechoCaixaPageProps {
  operador: OperadorSessao
  onVoltar: () => void
}

type Fase = 'declaracao' | 'reconciliacao' | 'concluido'

// ─── Denominações ──────────────────────────────────────────────────

const NOTAS  = [200, 100, 50, 20, 10, 5]
const MOEDAS = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]

function valorDenominacao(d: number): string {
  return d >= 1 ? `${d} €` : `${(d * 100).toFixed(0)} cênt.`
}

// ─── Limiares de discrepância ──────────────────────────────────────

const LIMITE_TOLERANCIA    = 2.00   // desvio mínimo — não bloqueia mas sinaliza
const LIMITE_DISCREPANCIA  = 2.00   // acima disto exige justificação

function estadoDiscrepancia(diff: number): 'correto' | 'desvio' | 'discrepancia' {
  const abs = Math.abs(diff)
  if (abs < 0.01) return 'correto'
  if (abs <= LIMITE_TOLERANCIA) return 'desvio'
  return 'discrepancia'
}

const ESTADO_CONFIG = {
  correto:      { label: 'Correto',        icone: '✓', cor: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  desvio:       { label: 'Desvio mínimo',  icone: '△', cor: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  discrepancia: { label: 'Discrepância',   icone: '✕', cor: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   }
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function FechoCaixaPage({ operador, onVoltar }: FechoCaixaPageProps) {
  const [fase, setFase]               = useState<Fase>('declaracao')

  // Fase 1 — contagem por denominação + inputs directos
  const [quantNotas, setQuantNotas]   = useState<Record<number, number>>(
    Object.fromEntries(NOTAS.map((d) => [d, 0]))
  )
  const [quantMoedas, setQuantMoedas] = useState<Record<number, number>>(
    Object.fromEntries(MOEDAS.map((d) => [d, 0]))
  )
  const [multibanco, setMultibanco]   = useState('')
  const [mbway, setMbway]             = useState('')

  // Fase 2
  const [teorico, setTeorico]         = useState<ValoresPorMetodo | null>(null)
  const [justificacao, setJustificacao] = useState('')
  const [aProcessar, setAProcessar]   = useState(false)

  // Fase 3
  const [resultado, setResultado]     = useState<ResultadoFecho | null>(null)
  const [horaFecho, setHoraFecho]     = useState('')

  const [toast, setToast]             = useState<ToastData | null>(null)

  // ─── Cálculo do numerário ──────────────────────────────────────

  const totalNumerario = Math.round((
    NOTAS.reduce((acc, d)  => acc + (quantNotas[d]  ?? 0) * d, 0) +
    MOEDAS.reduce((acc, d) => acc + (quantMoedas[d] ?? 0) * d, 0)
  ) * 100) / 100

  const contado: ValoresPorMetodo = {
    numerario:  totalNumerario,
    multibanco: parseFloat(multibanco) || 0,
    mbway:      parseFloat(mbway) || 0
  }
  const totalContado = Math.round((contado.numerario + contado.multibanco + contado.mbway) * 100) / 100

  // ─── Fase 1 → 2 ────────────────────────────────────────────────

  const handleAvancar = async (): Promise<void> => {
    setAProcessar(true)
    const r = await window.api.fecho.calcularTeorico()
    setAProcessar(false)
    if (!r.ok) { setToast({ kind: 'error', message: `Erro: ${r.error}` }); return }
    setTeorico(r.data)
    setFase('reconciliacao')
  }

  // ─── Fase 2 → 3 ────────────────────────────────────────────────

  const handleConfirmarFecho = async (): Promise<void> => {
    if (!teorico) return
    const totalTeo = teorico.numerario + teorico.multibanco + teorico.mbway
    const disc = Math.round((totalContado - totalTeo) * 100) / 100
    if (Math.abs(disc) > LIMITE_DISCREPANCIA && justificacao.trim().length < 10) {
      setToast({ kind: 'error', message: 'Discrepância exige justificação com pelo menos 10 caracteres.' })
      return
    }
    const input: FechoInput = { operadorId: operador.id, contado, justificacao: justificacao.trim() || null }
    setAProcessar(true)
    const r = await window.api.fecho.registar(input)
    setAProcessar(false)
    if (!r.ok) { setToast({ kind: 'error', message: r.error }); return }
    setResultado(r.data)
    setHoraFecho(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setFase('concluido')
  }

  // ─── Helpers ────────────────────────────────────────────────────

  const diffTotal = teorico
    ? Math.round((totalContado - (teorico.numerario + teorico.multibanco + teorico.mbway)) * 100) / 100
    : 0

  const estadoTotal = estadoDiscrepancia(diffTotal)
  const temDiscrepanciaGrande = Math.abs(diffTotal) > LIMITE_DISCREPANCIA

  // ─── Header ────────────────────────────────────────────────────

  const FASES_LABEL: Record<Fase, string> = {
    declaracao:    '1 · Contagem',
    reconciliacao: '2 · Reconciliação',
    concluido:     '3 · Relatório'
  }

  const header = (
    <header className="bg-blue-900 text-white flex-shrink-0">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {fase === 'declaracao' && (
            <button type="button" onClick={onVoltar}
              className="bg-blue-800 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded transition-colors">
              ← Voltar
            </button>
          )}
          <div className="bg-white rounded p-1 flex-shrink-0">
            <img src={logoUrl} alt="BragaConvenience" className="h-8 w-auto object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold">Fecho de Caixa · {operador.lojaBaseNome}</div>
            <div className="text-xs text-blue-200">Operador: {operador.nome}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Steps */}
          <div className="flex items-center gap-1.5">
            {(['declaracao', 'reconciliacao', 'concluido'] as Fase[]).map((f, i) => {
              const ativo = fase === f
              const feito = ['reconciliacao', 'concluido'].includes(fase) && i < ['declaracao', 'reconciliacao', 'concluido'].indexOf(fase)
              return (
                <div key={f} className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    feito ? 'bg-green-500 text-white' : ativo ? 'bg-white text-blue-900' : 'bg-blue-800 text-blue-300'
                  }`}>
                    {feito ? '✓' : i + 1}
                  </div>
                  {i < 2 && <div className="w-6 h-px bg-blue-700" />}
                </div>
              )
            })}
            <span className="text-xs text-blue-200 ml-2">{FASES_LABEL[fase]}</span>
          </div>
          <SyncStatusBadge tema="dark" />
        </div>
      </div>
    </header>
  )

  // ════════════════════════════════════════════════════════════════
  //  FASE 1 — DECLARAÇÃO CEGA
  // ════════════════════════════════════════════════════════════════

  if (fase === 'declaracao') {
    return (
      <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
        {header}

        {/* Aviso cego */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-800 flex-shrink-0">
          <span>⚠</span>
          <span className="font-semibold">Fecho de Caixa Cego</span>
          <span>— Declare os valores físicos que apurou na gaveta. Os valores do sistema só serão revelados após a submissão.</span>
        </div>

        <main className="flex-1 grid grid-cols-[1.3fr_1fr] gap-3 p-3 overflow-hidden">

          {/* ─── Esquerda — Numerário por denominação ─── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">💵</span>
                <h2 className="text-sm font-semibold tracking-wide uppercase">Numerário — Contagem por Denominação</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {/* Notas */}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1.5">Notas</div>
              {NOTAS.map((d) => (
                <DenominacaoRow
                  key={`nota-${d}`}
                  valor={d}
                  label={valorDenominacao(d)}
                  quantidade={quantNotas[d] ?? 0}
                  onChange={(q) => setQuantNotas({ ...quantNotas, [d]: q })}
                />
              ))}

              {/* Moedas */}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1.5 mt-1">Moedas</div>
              {MOEDAS.map((d) => (
                <DenominacaoRow
                  key={`moeda-${d}`}
                  valor={d}
                  label={valorDenominacao(d)}
                  quantidade={quantMoedas[d] ?? 0}
                  onChange={(q) => setQuantMoedas({ ...quantMoedas, [d]: q })}
                />
              ))}
            </div>

            {/* Total numerário */}
            <div className="border-t-2 border-slate-200 bg-slate-50 px-5 py-3 flex items-baseline justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-slate-700">Total Numerário Apurado</span>
              <span className={`text-3xl font-bold tabular-nums ${totalNumerario > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                {totalNumerario.toFixed(2)} €
              </span>
            </div>
          </section>

          {/* ─── Direita — MB + MBWay + Resumo ─── */}
          <section className="flex flex-col gap-3 overflow-hidden">

            {/* Multibanco */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">MB</div>
                <h3 className="text-sm font-semibold text-slate-900">Multibanco — Talões</h3>
              </div>
              <p className="text-xs text-slate-500 mb-2">Soma dos talões de cartão do turno</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={multibanco}
                  onChange={(e) => setMultibanco(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-3 pr-8 py-3 text-lg font-bold tabular-nums border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
              </div>
            </div>

            {/* MBWay */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-600 rounded text-white text-xs font-bold flex items-center justify-center">MB</div>
                <h3 className="text-sm font-semibold text-slate-900">MBWay</h3>
              </div>
              <p className="text-xs text-slate-500 mb-2">Total confirmado pelo relatório MBWay</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mbway}
                  onChange={(e) => setMbway(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-3 pr-8 py-3 text-lg font-bold tabular-nums border-2 border-slate-300 rounded-lg focus:border-purple-500 focus:outline-none text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
              </div>
            </div>

            {/* Total declarado */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex-shrink-0">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total Declarado</div>
              <div className="text-3xl font-bold text-blue-900 tabular-nums mt-1">
                {totalContado.toFixed(2)} €
              </div>
              <div className="text-xs text-blue-600 mt-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span>💵 Numerário</span>
                  <span className="tabular-nums">{contado.numerario.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>💳 Multibanco</span>
                  <span className="tabular-nums">{contado.multibanco.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>📱 MBWay</span>
                  <span className="tabular-nums">{contado.mbway.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {/* Botão avançar */}
            <button
              type="button"
              onClick={handleAvancar}
              disabled={aProcessar}
              className="bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-5 rounded-xl shadow-lg transition-all flex flex-col items-center gap-1"
            >
              <span className="text-base">{aProcessar ? 'A calcular...' : 'Confirmar contagem'}</span>
              {!aProcessar && <span className="text-blue-200 text-xs font-normal">Ver reconciliação →</span>}
            </button>
          </section>
        </main>

        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  FASE 2 — RECONCILIAÇÃO
  // ════════════════════════════════════════════════════════════════

  if (fase === 'reconciliacao' && teorico) {
    const linhas = [
      { key: 'numerario',  label: '💵 Numerário (Dinheiro)',   teo: teorico.numerario,  cnt: contado.numerario  },
      { key: 'multibanco', label: '💳 Multibanco (Talões)',    teo: teorico.multibanco, cnt: contado.multibanco },
      { key: 'mbway',      label: '📱 MBWay',                 teo: teorico.mbway,      cnt: contado.mbway      }
    ]
    const totalTeo = teorico.numerario + teorico.multibanco + teorico.mbway

    return (
      <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
        {header}

        <main className="flex-1 flex flex-col overflow-hidden p-4 gap-4">

          <div className="text-center flex-shrink-0">
            <h1 className="text-xl font-bold text-slate-900">🔍 Reconciliação de Valores</h1>
            <p className="text-sm text-slate-500 mt-1">
              Os valores do sistema são agora apresentados. Reveja as discrepâncias antes de fechar o turno.
            </p>
          </div>

          {/* Tabela de reconciliação */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">

            {/* Cabeçalho */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <span>Método</span>
              <span className="text-center">Estado</span>
              <span className="text-right">Declarado</span>
              <span className="text-right">Sistema</span>
              <span className="text-right">Diferença</span>
            </div>

            {/* Linhas */}
            {linhas.map(({ key, label, teo, cnt }) => {
              const diff   = Math.round((cnt - teo) * 100) / 100
              const estado = estadoDiscrepancia(diff)
              const cfg    = ESTADO_CONFIG[estado]
              return (
                <div key={key} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-5 py-5 border-b border-slate-100 ${cfg.bg}`}>
                  <div className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    {label}
                  </div>
                  <div className={`text-center text-sm font-semibold ${cfg.cor}`}>
                    {cfg.label}
                  </div>
                  <div className="text-right text-sm tabular-nums text-slate-700">{cnt.toFixed(2)} €</div>
                  <div className="text-right text-sm tabular-nums text-slate-700">{teo.toFixed(2)} €</div>
                  <div className={`text-right text-base font-bold tabular-nums ${cfg.cor}`}>
                    <span className="mr-1">{cfg.icone}</span>
                    {Math.abs(diff) < 0.01 ? '0,00 €' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} €`}
                  </div>
                </div>
              )
            })}

            {/* Total */}
            <div className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-5 py-4 ${ESTADO_CONFIG[estadoTotal].bg}`}>
              <div className="text-base font-bold text-slate-900">Total</div>
              <div />
              <div className="text-right text-sm tabular-nums font-semibold">{totalContado.toFixed(2)} €</div>
              <div className="text-right text-sm tabular-nums font-semibold">{totalTeo.toFixed(2)} €</div>
              <div className={`text-right text-xl font-bold tabular-nums ${ESTADO_CONFIG[estadoTotal].cor}`}>
                <span className="mr-1">{ESTADO_CONFIG[estadoTotal].icone}</span>
                {Math.abs(diffTotal) < 0.01 ? '0,00 €' : `${diffTotal > 0 ? '+' : ''}${diffTotal.toFixed(2)} €`}
              </div>
            </div>
          </div>

          {/* Alertas e justificação */}
          <div className="space-y-3 flex-shrink-0">
            {temDiscrepanciaGrande && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 text-lg">⚠</span>
                  <div className="text-sm text-red-900">
                    <span className="font-bold">Discrepância significativa detectada.</span>
                    {' '}O relatório será enviado automaticamente para a Sede para revisão.
                    O fecho pode prosseguir mas ficará registado como pendente de validação.
                  </div>
                </div>
                <textarea
                  value={justificacao}
                  onChange={(e) => setJustificacao(e.target.value)}
                  placeholder="Descreva o motivo da discrepância (mínimo 10 caracteres)..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none resize-none"
                />
                <div className={`text-xs text-right ${justificacao.trim().length >= 10 ? 'text-green-600 font-semibold' : 'text-slate-400'}`}>
                  {justificacao.trim().length}/10 caracteres mínimos
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1">
              <p>• Desvios até <strong>{LIMITE_TOLERANCIA.toFixed(2)} €</strong> são considerados toleráveis e não bloqueiam o fecho.</p>
              <p>• Desvios superiores ficam sinalizados para análise da Sede mas não impedem o encerramento do turno.</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Botões */}
          <div className="flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setFase('declaracao')}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-6 py-4 rounded-xl transition-colors flex items-center gap-2"
            >
              ← Corrigir declaração
            </button>
            <button
              type="button"
              onClick={handleConfirmarFecho}
              disabled={aProcessar || (temDiscrepanciaGrande && justificacao.trim().length < 10)}
              className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-base"
            >
              {aProcessar ? 'A gravar...' : 'Confirmar e Gerar Relatório →'}
            </button>
          </div>
        </main>

        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  FASE 3 — RELATÓRIO FINAL
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
      {header}

      <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">

        {/* Banner de sucesso */}
        <div className="text-center flex-shrink-0">
          <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center text-3xl text-white mx-auto">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-2">
            Turno fechado com sucesso
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('pt-PT')} · {horaFecho} · Operador: {operador.nome} · {operador.lojaBaseNome}
          </p>
        </div>

        {resultado && teorico && (
          <>
            {/* Resultado da Reconciliação */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
              <div className="bg-blue-800 text-white px-5 py-3 flex items-center gap-2">
                <span>•</span>
                <h2 className="text-sm font-semibold uppercase tracking-wide">Resultado da Reconciliação</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: '💵 Numerário',  teo: resultado.teorico.numerario,  cnt: resultado.contado.numerario  },
                  { label: '💳 Multibanco', teo: resultado.teorico.multibanco, cnt: resultado.contado.multibanco },
                  { label: '📱 MBWay',      teo: resultado.teorico.mbway,      cnt: resultado.contado.mbway      }
                ].map(({ label, teo, cnt }) => {
                  const diff = Math.round((cnt - teo) * 100) / 100
                  const cfg  = ESTADO_CONFIG[estadoDiscrepancia(diff)]
                  return (
                    <div key={label} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-sm items-center">
                      <span className="font-medium text-slate-800">{label}</span>
                      <span className="text-right tabular-nums text-slate-600">{cnt.toFixed(2)} €</span>
                      <span className="text-right tabular-nums text-slate-600">{teo.toFixed(2)} €</span>
                      <span className={`text-right font-bold tabular-nums ${cfg.cor}`}>
                        {cfg.icone} {Math.abs(diff) < 0.01 ? '0,00 €' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} €`}
                      </span>
                    </div>
                  )
                })}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-slate-50 text-sm items-center font-semibold border-t-2 border-slate-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-right tabular-nums">{(resultado.contado.numerario + resultado.contado.multibanco + resultado.contado.mbway).toFixed(2)} €</span>
                  <span className="text-right tabular-nums">{(resultado.teorico.numerario + resultado.teorico.multibanco + resultado.teorico.mbway).toFixed(2)} €</span>
                  <span className={`text-right font-bold tabular-nums text-lg ${
                    resultado.discrepancia === 0 ? 'text-green-700' : resultado.discrepancia > 0 ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {resultado.discrepancia >= 0 ? '+' : ''}{resultado.discrepancia.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            {/* Assinatura digital */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex-shrink-0">
              <div className="text-sm font-semibold text-slate-700 mb-3">Assinatura digital do operador</div>
              <div className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {operador.nome} · {operador.perfil} · {operador.lojaBaseNome}
                </div>
                <div className="text-sm text-green-700 font-semibold flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Autenticado via PIN · {horaFecho}</span>
                </div>
              </div>
            </div>

            {/* Estado e pendências */}
            <div className="flex gap-3 flex-shrink-0">
              <div className={`flex-1 rounded-xl border px-4 py-3 text-sm ${
                resultado.temDiscrepancia
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-green-50 border-green-300 text-green-900'
              }`}>
                <div className="font-semibold flex items-center gap-1.5">
                  <span>{resultado.temDiscrepancia ? '⚠' : '✓'}</span>
                  Estado: {resultado.temDiscrepancia ? 'Pendente validação Sede' : 'Fecho equilibrado'}
                </div>
              </div>
              <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">⚠ Sincronização pendente</span>
                <div className="text-xs mt-0.5">Dados enviados para a Sede no próximo ciclo</div>
              </div>
            </div>
          </>
        )}

        {/* Botões de acção */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0 pb-2">
          <button
            type="button"
            onClick={() => setToast({ kind: 'info', message: 'Funcionalidade de impressão não disponível nesta versão.' })}
            className="bg-blue-800 hover:bg-blue-900 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            <span>🖨</span> Imprimir Relatório
          </button>
          <button
            type="button"
            onClick={() => window.api.sync.forcar()}
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            <span>⇒</span> Enviar para a Sede
          </button>
          <button
            type="button"
            onClick={onVoltar}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-base shadow-md"
          >
            <span>◎</span> Iniciar Novo Turno
          </button>
        </div>
      </main>

      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  ROW DE DENOMINAÇÃO
// ═══════════════════════════════════════════════════════════════════

function DenominacaoRow({
  valor,
  label,
  quantidade,
  onChange
}: {
  valor:      number
  label:      string
  quantidade: number
  onChange:   (q: number) => void
}) {
  const subtotal = Math.round(quantidade * valor * 100) / 100

  return (
    <div className={`grid grid-cols-[72px_auto_100px] items-center gap-2 px-3 py-1.5 rounded-lg ${quantidade > 0 ? 'bg-blue-50' : ''}`}>
      {/* Denominação */}
      <div className="text-sm font-semibold text-slate-700 tabular-nums text-right pr-2">
        {label}
      </div>

      {/* Controlo */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantidade - 1))}
          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded text-sm font-bold text-slate-700 flex items-center justify-center"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          value={quantidade === 0 ? '' : quantidade}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          placeholder="0"
          className="w-14 text-center text-sm font-bold tabular-nums border border-slate-300 rounded py-1 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(quantidade + 1)}
          className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded text-sm font-bold text-slate-700 flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Subtotal */}
      <div className={`text-right text-sm tabular-nums font-semibold ${quantidade > 0 ? 'text-blue-800' : 'text-slate-400'}`}>
        {subtotal.toFixed(2)} €
      </div>
    </div>
  )
}
