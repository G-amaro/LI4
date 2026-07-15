/**
 * Auth Controller — ponte IPC entre o Renderer e a AutenticacaoFacade.
 *
 * Responsabilidade EXCLUSIVA: traduzir eventos IPC em chamadas à Facade.
 *
 * O que este ficheiro NÃO faz (e nunca deve fazer):
 *   ✗ Validar NIF ou PIN (responsabilidade da Facade)
 *   ✗ Chamar o ApiClient directamente (responsabilidade da Facade)
 *   ✗ Ler ou escrever no ConfigDAO directamente (responsabilidade da Facade)
 *
 * Correspondência arquitectural:
 *   Renderer → IPC → [este ficheiro] → IAutenticacaoFacade → AutenticacaoFacade
 */

import { ipcMain } from 'electron'
import { AutenticacaoFacade } from '../business/AutenticacaoFacade'
import { IpcChannels } from '../../shared/ipc-channels'
import type { IAutenticacaoFacade } from '../business/interfaces/IAutenticacaoFacade'
import type { LoginPosInput } from '../../shared/types'

export function registerAuthHandlers(): void {
  // A Facade é tipada pela interface — o handler não depende da implementação concreta
  const facade: IAutenticacaoFacade = new AutenticacaoFacade()

  // ─── Login POS ────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.AuthLoginPos, async (_evt, input: LoginPosInput) => {
    const resultado = await facade.loginPos(input)

    if (resultado.ok) {
      console.log(`[AuthController] Login OK — ${resultado.data.operador.nome} (${resultado.data.operador.perfil})`)
    } else {
      console.warn(`[AuthController] Login falhou — ${resultado.error}`)
    }

    return resultado
  })

  // ─── Logout ───────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.AuthLogout, (_evt) => {
    const resultado = facade.logout()

    if (resultado.ok) {
      console.log('[AuthController] Sessão terminada.')
    }

    return resultado
  })

  // ─── Sessão actual ────────────────────────────────────────────
  ipcMain.handle(IpcChannels.AuthSessaoAtual, (_evt) => {
    return facade.obterSessaoAtual()
  })
}
