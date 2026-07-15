/**
 * useSyncStatus — Hook que mantém o status do SyncWorker sempre actualizado.
 *
 * Estratégia dual:
 *   1. PUSH via IPC (onStatusChange) — actualização instantânea quando o
 *      Main Process detecta mudança de estado
 *   2. POLLING defensivo a cada 3s — recupera de qualquer push perdido
 *      (ex: componente remontado, race conditions durante navegação)
 *
 * O polling é intencionalmente curto (3s) porque:
 *   - A chamada é IPC local, sem overhead de rede
 *   - O estado é pequeno (~200 bytes)
 *   - Garante que o badge nunca fica "preso" num estado desactualizado
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncWorkerStatus } from '../../../shared/types'

interface UseSyncStatusResult {
  status:     SyncWorkerStatus | null
  forcarSync: () => Promise<void>
  aForcar:    boolean
}

const POLLING_INTERVAL_MS = 3_000

export function useSyncStatus(): UseSyncStatusResult {
  const [status, setStatus]   = useState<SyncWorkerStatus | null>(null)
  const [aForcar, setAForcar] = useState(false)

  // Ref para evitar setState após unmount
  const montadoRef = useRef(true)

  const actualizarStatus = useCallback(async (): Promise<void> => {
    try {
      const r = await window.api.sync.getStatus()
      if (r.ok && montadoRef.current) {
        setStatus(r.data)
      }
    } catch {
      // Silencioso — pode acontecer durante reload do renderer
    }
  }, [])

  useEffect(() => {
    montadoRef.current = true

    // 1. Fetch inicial (imediato)
    void actualizarStatus()

    // 2. Push via IPC — actualização instantânea
    window.api.sync.onStatusChanged((novoStatus) => {
      if (montadoRef.current) {
        setStatus(novoStatus)
      }
    })

    // 3. Polling defensivo — recupera de pushes perdidos
    const intervalId = setInterval(() => {
      void actualizarStatus()
    }, POLLING_INTERVAL_MS)

    return () => {
      montadoRef.current = false
      clearInterval(intervalId)
    }
  }, [actualizarStatus])

  const forcarSync = useCallback(async (): Promise<void> => {
    if (aForcar) return
    setAForcar(true)
    try {
      const r = await window.api.sync.forcar()
      if (!r.ok) {
      console.error("Erro ao forçar sync:", r.error)
    }
    } catch {
      // Erro já é tratado pelo worker — o status reflecte-o
    } finally {
      if (montadoRef.current) {
        setAForcar(false)
      }
    }
  }, [aForcar])

  return { status, forcarSync, aForcar }
}
