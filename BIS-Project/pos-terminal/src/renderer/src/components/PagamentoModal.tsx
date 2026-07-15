/**
 * PagamentoModal — selecção de método de pagamento (Fase 3.3).
 *
 * Passa para fora do callback `onConfirmar` um objecto `ResultadoPagamento`
 * com info detalhada para o modal de conclusão poder mostrar:
 *   - Numerário: valorRecebido (e troco calculado)
 *   - Multibanco: cartaoMock ("Visa **** 4521" gerado aleatoriamente)
 *   - MBWay: telemovel (formatado "912 345 678")
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Numpad } from './Numpad'
import { MetodoPagamento } from '../../../shared/types'

// ─── Resultado retornado ao confirmar pagamento ─────────────────
export interface ResultadoPagamento {
  metodo:         MetodoPagamento
  valorRecebido?: number     // só Numerário
  cartaoMock?:    string     // só Multibanco (ex: "Visa **** 4521")
  telemovel?:     string     // só MBWay (ex: "912 345 678")
}

interface PagamentoModalProps {
  totalAPagar: number
  onConfirmar: (resultado: ResultadoPagamento) => void
  onCancelar:  () => void
}

type Passo =
  | 'escolha'
  | 'numerario'
  | 'multibanco-processar'
  | 'mbway-telemovel'
  | 'mbway-aguardar'

// Gera mock de cartão "Visa **** 4521" / "Mastercard **** 8732"
function gerarCartaoMock(): string {
  const bandeiras = ['Visa', 'Mastercard', 'Maestro']
  const bandeira  = bandeiras[Math.floor(Math.random() * bandeiras.length)]
  const ultimos4  = Math.floor(1000 + Math.random() * 9000)
  return `${bandeira} **** ${ultimos4}`
}

export function PagamentoModal({
  totalAPagar,
  onConfirmar,
  onCancelar
}: PagamentoModalProps) {
  const [passo, setPasso]                 = useState<Passo>('escolha')
  const [valorRecebido, setValorRecebido] = useState('')
  const [telemovel, setTelemovel]         = useState('')

  const handleVoltar = (): void => {
    setPasso('escolha')
    setValorRecebido('')
    setTelemovel('')
  }

  const confirmarNumerario = (): void => {
    const valor = parseFloat(valorRecebido) || 0
    onConfirmar({ metodo: MetodoPagamento.Numerario, valorRecebido: valor })
  }

  const confirmarMultibanco = (): void => {
    onConfirmar({ metodo: MetodoPagamento.Multibanco, cartaoMock: gerarCartaoMock() })
  }

  const confirmarMBWay = (): void => {
    onConfirmar({ metodo: MetodoPagamento.MBWay, telemovel })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        <CabecalhoTotal totalAPagar={totalAPagar} passo={passo} onVoltar={handleVoltar} />

        {passo === 'escolha' && (
          <PassoEscolha
            onEscolher={(metodo) => {
              if (metodo === MetodoPagamento.Numerario) setPasso('numerario')
              else if (metodo === MetodoPagamento.Multibanco) setPasso('multibanco-processar')
              else setPasso('mbway-telemovel')
            }}
            onCancelar={onCancelar}
          />
        )}

        {passo === 'numerario' && (
          <PassoNumerario
            totalAPagar={totalAPagar}
            valorRecebido={valorRecebido}
            setValorRecebido={setValorRecebido}
            onConfirmar={confirmarNumerario}
          />
        )}

        {passo === 'multibanco-processar' && (
          <PassoMultibancoProcessar
            onConfirmar={confirmarMultibanco}
            onCancelar={handleVoltar}
          />
        )}

        {passo === 'mbway-telemovel' && (
          <PassoMBWayTelemovel
            telemovel={telemovel}
            setTelemovel={setTelemovel}
            onAvancar={() => setPasso('mbway-aguardar')}
          />
        )}

        {passo === 'mbway-aguardar' && (
          <PassoMBWayAguardar
            telemovel={telemovel}
            onConfirmar={confirmarMBWay}
            onCancelar={handleVoltar}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════ CABEÇALHO ═══════════════════════

interface CabecalhoTotalProps {
  totalAPagar: number
  passo:       Passo
  onVoltar:    () => void
}

function CabecalhoTotal({ totalAPagar, passo, onVoltar }: CabecalhoTotalProps) {
  const corPorPasso: Record<Passo, string> = {
    'escolha':              'bg-blue-900',
    'numerario':            'bg-blue-700',
    'multibanco-processar': 'bg-amber-600',
    'mbway-telemovel':      'bg-purple-700',
    'mbway-aguardar':       'bg-purple-700'
  }

  const labelMetodo: Record<Passo, string> = {
    'escolha':              'Selecionar Método de Pagamento',
    'numerario':            'Pagamento · Numerário',
    'multibanco-processar': 'Pagamento · Cartão (Multibanco)',
    'mbway-telemovel':      'Pagamento · MBWay',
    'mbway-aguardar':       'Pagamento · MBWay'
  }

  return (
    <div className={`${corPorPasso[passo]} text-white px-6 py-5 transition-colors duration-300`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-white/80">{labelMetodo[passo]}</div>
        {passo !== 'escolha' && (
          <button
            type="button"
            onClick={onVoltar}
            className="text-xs text-white/80 hover:text-white bg-black/20 hover:bg-black/40 px-2 py-1 rounded"
          >
            ← Mudar método
          </button>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-white/70">Total a pagar</div>
        <div className="text-5xl font-bold tabular-nums mt-1">{totalAPagar.toFixed(2)} €</div>
      </div>
    </div>
  )
}

// ═══════════════════════ PASSO 1: ESCOLHA ═══════════════════════

interface PassoEscolhaProps {
  onEscolher: (m: MetodoPagamento) => void
  onCancelar: () => void
}

function PassoEscolha({ onEscolher, onCancelar }: PassoEscolhaProps) {
  return (
    <div className="p-6 space-y-3">
      <button
        type="button"
        onClick={() => onEscolher(MetodoPagamento.Numerario)}
        className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl py-5 px-6 transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex items-center gap-4"
      >
        <div className="text-4xl">💶</div>
        <div className="text-left flex-1">
          <div className="text-lg font-bold">Numerário / Dinheiro</div>
          <div className="text-sm text-blue-200">Pagamento em notas e moedas</div>
        </div>
        <div className="text-2xl">→</div>
      </button>

      <button
        type="button"
        onClick={() => onEscolher(MetodoPagamento.Multibanco)}
        className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl py-5 px-6 transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex items-center gap-4"
      >
        <div className="text-4xl">💳</div>
        <div className="text-left flex-1">
          <div className="text-lg font-bold">Cartão (Multibanco)</div>
          <div className="text-sm text-amber-100">Débito ou crédito</div>
        </div>
        <div className="text-2xl">→</div>
      </button>

      <button
        type="button"
        onClick={() => onEscolher(MetodoPagamento.MBWay)}
        className="w-full bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white rounded-xl py-5 px-6 transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex items-center gap-4"
      >
        <div className="text-4xl">📱</div>
        <div className="text-left flex-1">
          <div className="text-lg font-bold">MBWay</div>
          <div className="text-sm text-purple-200">Pagamento por telemóvel</div>
        </div>
        <div className="text-2xl">→</div>
      </button>

      <button
        type="button"
        onClick={onCancelar}
        className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium py-3 rounded-lg transition-colors mt-2"
      >
        Cancelar
      </button>
    </div>
  )
}

// ═══════════════════════ PASSO 2A: NUMERÁRIO ═══════════════════════

interface PassoNumerarioProps {
  totalAPagar:      number
  valorRecebido:    string
  setValorRecebido: (v: string) => void
  onConfirmar:      () => void
}

function PassoNumerario({
  totalAPagar, valorRecebido, setValorRecebido, onConfirmar
}: PassoNumerarioProps) {
  const valorNum = parseFloat(valorRecebido) || 0
  const troco    = valorNum >= totalAPagar
    ? Math.round((valorNum - totalAPagar) * 100) / 100
    : null

  const podeConfirmar = troco !== null

  const handleNumpadChange = useCallback((valor: string): void => {
    const numero = parseInt(valor, 10)
    if (isNaN(numero)) {
      setValorRecebido('')
      return
    }
    setValorRecebido((numero / 100).toFixed(2))
  }, [setValorRecebido])

  const notasDisponiveis = [5, 10, 20, 50].filter((n) => n >= totalAPagar)

  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          Dinheiro Recebido
        </div>
        <div className="bg-slate-50 border-2 border-slate-300 rounded-xl px-5 py-4 flex items-baseline justify-between">
          <span className="text-3xl font-bold text-slate-900 tabular-nums font-mono">
            {valorNum.toFixed(2)}
          </span>
          <span className="text-2xl text-slate-500 ml-2">€</span>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          Atalhos
        </div>
        <div className="grid grid-cols-5 gap-2">
          {notasDisponiveis.map((nota) => (
            <button
              key={nota}
              type="button"
              onClick={() => setValorRecebido(nota.toFixed(2))}
              className="bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-900 font-bold py-2 rounded-lg text-sm transition-colors"
            >
              {nota}€
            </button>
          ))}
          {Array.from({ length: 4 - notasDisponiveis.length }).map((_, i) => (
            <div key={`spacer-${i}`} />
          ))}
          <button
            type="button"
            onClick={() => setValorRecebido(totalAPagar.toFixed(2))}
            className="bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-900 font-bold py-2 rounded-lg text-xs uppercase tracking-wide transition-colors"
          >
            Exato
          </button>
        </div>
      </div>

      <div className={`rounded-xl px-5 py-3 transition-colors ${
        troco === null
          ? 'bg-red-50 border-2 border-red-200'
          : troco === 0
            ? 'bg-slate-50 border-2 border-slate-200'
            : 'bg-emerald-50 border-2 border-emerald-300'
      }`}>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Troco a Dar</span>
          <span className={`text-3xl font-bold tabular-nums ${
            troco === null
              ? 'text-red-700'
              : troco === 0
                ? 'text-slate-700'
                : 'text-emerald-700'
          }`}>
            {troco === null ? 'Insuficiente' : `${troco.toFixed(2)} €`}
          </span>
        </div>
      </div>

      <Numpad
        value={valorRecebido.replace('.', '')}
        onChange={handleNumpadChange}
        onSubmit={podeConfirmar ? onConfirmar : undefined}
        maxLength={6}
        submitLabel="✓"
      />

      <button
        type="button"
        onClick={onConfirmar}
        disabled={!podeConfirmar}
        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all"
      >
        {podeConfirmar
          ? `Confirmar Pagamento · Troco ${troco!.toFixed(2)} €`
          : 'Introduza o valor recebido'}
      </button>
    </div>
  )
}

// ═══════════════════════ PASSO 2B: MULTIBANCO ═══════════════════════

interface PassoMultibancoProps {
  onConfirmar: () => void
  onCancelar:  () => void
}

function PassoMultibancoProcessar({ onConfirmar, onCancelar }: PassoMultibancoProps) {
  const [cancelado, setCancelado] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!cancelado) onConfirmar()
    }, 2500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [cancelado, onConfirmar])

  const handleCancelar = (): void => {
    setCancelado(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    onCancelar()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-8 text-center space-y-4">
        <div className="text-6xl">💳</div>
        <div>
          <div className="text-lg font-semibold text-amber-900">A comunicar com o banco...</div>
          <div className="text-sm text-amber-700 mt-1">Aguarde a confirmação do terminal.</div>
        </div>
        <div className="flex justify-center pt-2">
          <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        </div>
      </div>

      <div className="text-xs text-center text-slate-500">
        Não retire o cartão. Aguarde a confirmação do terminal.
      </div>

      <button
        type="button"
        onClick={handleCancelar}
        className="w-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-semibold py-3 rounded-lg transition-colors"
      >
        Cancelar operação
      </button>
    </div>
  )
}

// ═══════════════════════ PASSO 2C: MBWay (telemóvel) ═══════════════════════

interface PassoMBWayTelemovelProps {
  telemovel:    string
  setTelemovel: (s: string) => void
  onAvancar:    () => void
}

function PassoMBWayTelemovel({ telemovel, setTelemovel, onAvancar }: PassoMBWayTelemovelProps) {
  const valido = /^\d{9}$/.test(telemovel)

  const handleNumpadChange = (valor: string): void => {
    setTelemovel(valor.slice(0, 9))
  }

  const formatado = telemovel.match(/.{1,3}/g)?.join(' ') ?? ''

  return (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="text-5xl mb-2">📱</div>
        <div className="text-lg font-semibold text-slate-900">Número de telemóvel do cliente</div>
        <div className="text-sm text-slate-500 mt-1">
          Indique o nº MBWay associado para envio do pedido
        </div>
      </div>

      <div className="bg-purple-50 border-2 border-purple-300 rounded-xl px-5 py-4 text-center">
        <div className="text-xs text-purple-700 uppercase tracking-wide mb-1">+351</div>
        <div className="text-3xl font-bold text-purple-900 tabular-nums font-mono min-h-[2.5rem]">
          {formatado || <span className="text-purple-300">— — — — — — — — —</span>}
        </div>
      </div>

      <Numpad
        value={telemovel}
        onChange={handleNumpadChange}
        onSubmit={valido ? onAvancar : undefined}
        maxLength={9}
        submitLabel="✓"
      />

      <button
        type="button"
        onClick={onAvancar}
        disabled={!valido}
        className="w-full bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all"
      >
        {valido ? 'Enviar Pedido MBWay' : 'Introduza 9 dígitos'}
      </button>
    </div>
  )
}

// ═══════════════════════ PASSO 2D: MBWay (aguardar) ═══════════════════════

interface PassoMBWayAguardarProps {
  telemovel:   string
  onConfirmar: () => void
  onCancelar:  () => void
}

function PassoMBWayAguardar({ telemovel, onConfirmar, onCancelar }: PassoMBWayAguardarProps) {
  const [segundosRestantes, setSegundosRestantes] = useState(240)
  const [confirmadoMock, setConfirmadoMock]       = useState(false)
  const autoConfirmRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    autoConfirmRef.current = setTimeout(() => {
      setConfirmadoMock(true)
      setTimeout(() => onConfirmar(), 800)
    }, 3000)

    return () => {
      if (autoConfirmRef.current) clearTimeout(autoConfirmRef.current)
    }
  }, [onConfirmar])

  useEffect(() => {
    if (confirmadoMock) return
    const interval = setInterval(() => {
      setSegundosRestantes((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [confirmadoMock])

  const min = Math.floor(segundosRestantes / 60)
  const seg = segundosRestantes % 60
  const formatTimer = `${min}:${seg.toString().padStart(2, '0')}`

  const tlmFormatado = telemovel.match(/.{1,3}/g)?.join(' ') ?? telemovel

  const handleCancelar = (): void => {
    if (autoConfirmRef.current) clearTimeout(autoConfirmRef.current)
    onCancelar()
  }

  return (
    <div className="p-6 space-y-4">
      <div className={`rounded-2xl border-2 p-6 text-center space-y-3 transition-all ${
        confirmadoMock
          ? 'bg-emerald-50 border-emerald-300'
          : 'bg-purple-50 border-purple-200'
      }`}>
        {confirmadoMock ? (
          <>
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-3xl text-white mx-auto">
              ✓
            </div>
            <div className="text-lg font-bold text-emerald-900">
              Pagamento confirmado pelo cliente
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <div className="text-3xl">📱</div>
            </div>
            <div>
              <div className="font-semibold text-purple-900">Pedido enviado para</div>
              <div className="text-xl font-bold text-purple-900 tabular-nums font-mono mt-1">
                +351 {tlmFormatado}
              </div>
            </div>
            <div className="text-xs text-purple-700">O cliente deve confirmar na app MB WAY</div>
            <div className="bg-white rounded-lg px-4 py-3 inline-block border border-purple-200">
              <div className="text-3xl font-bold text-purple-900 tabular-nums">{formatTimer}</div>
            </div>
            <div className="text-xs text-purple-600 mt-2">
              A aguardar resposta do cliente...
              <br />
              O pedido expira em 4 minutos.
            </div>
          </>
        )}
      </div>

      {!confirmadoMock && (
        <button
          type="button"
          onClick={handleCancelar}
          className="w-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-semibold py-3 rounded-lg transition-colors"
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
