/**
 * LoginPage — Iniciar Turno (Fase 3 — UI)
 *
 * Redesign visual com:
 *   - Fundo azul-marinho (bg-blue-900) full-screen
 *   - Card central cinzento-claro com logo BragaConvenience
 *   - 2 inputs empilhados (NIF em cima, PIN em baixo) com toggle de focus
 *   - Numpad partilhado (mantém componente existente)
 *   - 2 botões grandes: Limpar (vermelho) e Iniciar Turno (verde)
 *   - Mensagens de erro mantidas
 *   - Loja do terminal exibida como pílula
 */

import { useEffect, useState } from 'react'
import { Numpad } from '../components/Numpad'
import logoUrl from '../assets/logo.png'
import type { OperadorSessao } from '../../../shared/types'

interface LoginPageProps {
  onLoginSuccess: (operador: OperadorSessao) => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [nif,        setNif]        = useState('')
  const [pin,        setPin]        = useState('')
  const [lojaId,     setLojaId]     = useState<number | null>(null)
  const [lojaNome,   setLojaNome]   = useState<string>('')
  const [erro,       setErro]       = useState<string | null>(null)
  const [aCarregar,  setACarregar]  = useState(false)
  const [focusField, setFocusField] = useState<'nif' | 'pin'>('nif')

  // Carregar Loja do config
  useEffect(() => {
    const loadLoja = async (): Promise<void> => {
      const [rId, rNome] = await Promise.all([
        window.api.config.get('loja_id'),
        window.api.config.get('loja_nome')
      ])
      if (rId.ok   && rId.data)   setLojaId(Number(rId.data))
      if (rNome.ok && rNome.data) setLojaNome(rNome.data)
    }
    loadLoja()
  }, [])

  const pinMask = '●'.repeat(pin.length) + '○'.repeat(Math.max(0, 4 - pin.length))

  const validInput = (): boolean => {
    return /^\d{9}$/.test(nif) && /^\d{4,6}$/.test(pin) && !!lojaId
  }

  const handleSubmit = async (): Promise<void> => {
    setErro(null)

    if (!lojaId) {
      setErro('Terminal não configurado: LojaId em falta.')
      return
    }
    if (!/^\d{9}$/.test(nif)) {
      setErro('NIF deve ter exatamente 9 dígitos.')
      setFocusField('nif')
      return
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setErro('PIN deve ter entre 4 e 6 dígitos.')
      setFocusField('pin')
      return
    }

    setACarregar(true)
    const r = await window.api.auth.loginPos({ nif, pin, lojaId })
    setACarregar(false)

    if (!r.ok) {
      setErro(r.error)
      setPin('')
      setFocusField('pin')
      return
    }

    onLoginSuccess(r.data.operador)
  }

  const handleNumpadChange = (newValue: string): void => {
    if (focusField === 'nif') setNif(newValue)
    else                      setPin(newValue)
    if (erro) setErro(null)
  }

  const handleLimpar = (): void => {
    setNif('')
    setPin('')
    setErro(null)
    setFocusField('nif')
  }

  const valorCampoAtivo = focusField === 'nif' ? nif : pin
  const maxLenAtivo     = focusField === 'nif' ? 9 : 6

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen w-full bg-blue-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-slate-100 rounded-2xl shadow-2xl overflow-hidden">

        {/* ─── Header ─── */}
        <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="BragaConvenience"
            className="h-24 w-auto mb-4 object-contain"
          />

          <h1 className="text-2xl font-bold text-slate-900">Iniciar Turno</h1>

          {lojaId ? (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 text-sm font-medium px-3 py-1 rounded-full">
              <span>📍</span>
              <span>Loja: {lojaNome || `#${lojaId}`}</span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-xs font-medium px-3 py-1.5 rounded-full">
              <span>⚠</span>
              Terminal por configurar
            </div>
          )}
        </div>

        {/* ─── Body ─── */}
        <div className="px-8 pb-8 space-y-4">

          {/* NIF — em cima */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              NIF do Operador
            </label>
            <button
              type="button"
              onClick={() => setFocusField('nif')}
              className={`w-full text-center px-4 py-4 rounded-lg border-2 transition-all ${
                focusField === 'nif'
                  ? 'border-blue-700 bg-white shadow-sm'
                  : 'border-slate-300 bg-white/70 hover:border-slate-400'
              }`}
            >
              <span className="text-xl font-mono tracking-widest text-slate-900">
                {nif || <span className="text-slate-300">9 dígitos</span>}
              </span>
            </button>
          </div>

          {/* PIN — em baixo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              PIN de Acesso
            </label>
            <button
              type="button"
              onClick={() => setFocusField('pin')}
              className={`w-full text-center px-4 py-4 rounded-lg border-2 transition-all ${
                focusField === 'pin'
                  ? 'border-blue-700 bg-white shadow-sm'
                  : 'border-slate-300 bg-white/70 hover:border-slate-400'
              }`}
            >
              <span className="text-2xl tracking-[0.4em] text-slate-900 font-bold">
                {pinMask}
              </span>
            </button>
          </div>

          {/* ─── Erro ─── */}
          {erro && (
            <div className="bg-red-50 border-2 border-red-300 text-red-800 text-sm font-medium rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-lg leading-none">⚠</span>
              <span>{erro}</span>
            </div>
          )}

          {/* ─── Numpad ─── */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <Numpad
              value={valorCampoAtivo}
              onChange={handleNumpadChange}
              onSubmit={handleSubmit}
              maxLength={maxLenAtivo}
              disabled={aCarregar}
              submitLabel={aCarregar ? '...' : 'OK'}
            />
          </div>

          {/* ─── Botões de acção ─── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleLimpar}
              disabled={aCarregar}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 text-white font-semibold py-4 rounded-lg text-lg shadow-md hover:shadow-lg transition-all"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!validInput() || aCarregar}
              className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg text-lg shadow-md hover:shadow-lg transition-all"
            >
              {aCarregar ? 'A validar...' : 'Iniciar Turno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
