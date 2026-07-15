/**
 * Declaração de tipos para o renderer.
 *
 * O template electron-vite gera este ficheiro mas sem conhecer a nossa API.
 * Ao declarar `window.api` aqui, o TypeScript do renderer ganha autocomplete
 * e verificação de tipos em todas as chamadas IPC.
 *
 * Substitui o ficheiro gerado pelo template por este.
 */

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { BisApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api:      BisApi
  }
}
