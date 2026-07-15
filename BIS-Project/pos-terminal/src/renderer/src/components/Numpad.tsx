/**
 * Teclado numérico tátil reutilizável.
 *
 * Design:
 *   - Botões grandes (72x72px mínimo) para UX de ecrã tátil
 *   - Feedback visual de clique (active:scale)
 *   - Controlo externo do estado (stateless component) — o pai gere o valor
 *
 * Reutilizado em: LoginPage (PIN), VendaPage (quantidades),
 *                 FechoCaixa (contagem), Devoluções (ID da venda).
 */

import { FC } from 'react'

interface NumpadProps {
  /** Valor atual mostrado. */
  value: string
  /** Callback quando valor muda. Recebe o novo valor completo. */
  onChange: (newValue: string) => void
  /** Ação disparada pelo botão OK (ex: submeter login). */
  onSubmit?: () => void
  /** Limite máximo de caracteres (ex: 6 para PIN, 13 para EAN). */
  maxLength?: number
  /** Desativa interação (ex: durante loading). */
  disabled?: boolean
  /** Label do botão de submissão (default "OK"). */
  submitLabel?: string
}

const BUTTONS: Array<{ label: string; kind: 'digit' | 'clear' | 'submit' }> = [
  { label: '1', kind: 'digit' },
  { label: '2', kind: 'digit' },
  { label: '3', kind: 'digit' },
  { label: '4', kind: 'digit' },
  { label: '5', kind: 'digit' },
  { label: '6', kind: 'digit' },
  { label: '7', kind: 'digit' },
  { label: '8', kind: 'digit' },
  { label: '9', kind: 'digit' },
  { label: '⌫', kind: 'clear'  },
  { label: '0', kind: 'digit'  },
  { label: 'OK', kind: 'submit' }
]

export const Numpad: FC<NumpadProps> = ({
  value,
  onChange,
  onSubmit,
  maxLength = 6,
  disabled = false,
  submitLabel
}) => {
  const handleClick = (label: string, kind: 'digit' | 'clear' | 'submit'): void => {
    if (disabled) return

    if (kind === 'digit') {
      if (value.length < maxLength) onChange(value + label)
    } else if (kind === 'clear') {
      onChange(value.slice(0, -1))
    } else if (kind === 'submit') {
      onSubmit?.()
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 select-none" role="group" aria-label="Teclado numérico">
      {BUTTONS.map((btn) => {
        const label = btn.kind === 'submit' ? (submitLabel ?? btn.label) : btn.label
        const styles = getButtonStyles(btn.kind, disabled)

        return (
          <button
            key={btn.label}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(btn.label, btn.kind)}
            className={`${styles} h-20 text-2xl font-medium rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label={btn.kind === 'clear' ? 'Apagar dígito' : label}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function getButtonStyles(kind: 'digit' | 'clear' | 'submit', _disabled: boolean): string {
  if (kind === 'submit') {
    return 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
  }
  if (kind === 'clear') {
    return 'bg-amber-100 hover:bg-amber-200 text-amber-900 shadow-sm'
  }
  return 'bg-slate-100 hover:bg-slate-200 text-slate-900 shadow-sm'
}
