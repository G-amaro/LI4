/**
 * Toast minimalista para feedback de operações (sync, guardar, erro...).
 *
 * Uso:
 *   const [toast, setToast] = useState<ToastData | null>(null)
 *   setToast({ kind: 'success', message: '5 produtos sincronizados' })
 *   // auto-dismiss após 3s
 */

import { FC, useEffect } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastData {
  kind:    ToastKind
  message: string
}

interface ToastProps {
  data:    ToastData
  onClose: () => void
  /** Duração em ms antes de auto-dismiss. Default 3000. */
  duration?: number
}

export const Toast: FC<ToastProps> = ({ data, onClose, duration = 3000 }) => {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [data, duration, onClose])

  const styles = getStyles(data.kind)

  return (
    <div
      role="alert"
      className={`${styles.wrapper} fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slide-in`}
    >
      <span className="text-xl" aria-hidden>{styles.icon}</span>
      <span className="text-sm font-medium flex-1">{data.message}</span>
      <button
        type="button"
        onClick={onClose}
        className={`${styles.close} text-sm leading-none px-1`}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

function getStyles(kind: ToastKind): { wrapper: string; close: string; icon: string } {
  switch (kind) {
    case 'success':
      return {
        wrapper: 'bg-green-50 border border-green-300 text-green-900',
        close:   'text-green-700 hover:text-green-900',
        icon:    '✓'
      }
    case 'error':
      return {
        wrapper: 'bg-red-50 border border-red-300 text-red-900',
        close:   'text-red-700 hover:text-red-900',
        icon:    '⚠'
      }
    default:
      return {
        wrapper: 'bg-slate-50 border border-slate-300 text-slate-900',
        close:   'text-slate-600 hover:text-slate-900',
        icon:    'ℹ'
      }
  }
}
