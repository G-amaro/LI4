/**
 * bootstrap.ts — Configuração de pré-arranque do Electron.
 *
 * ESTE FICHEIRO TEM DE SER IMPORTADO ANTES DE TUDO no index.ts,
 * porque o Electron escolhe o userData path no primeiro acesso a
 * `app.getPath('userData')` e a partir daí não pode ser alterado.
 *
 * Qualquer código que abra a BD (como connection.ts) tem de correr
 * DEPOIS deste bootstrap — por isso o índex importa este primeiro.
 */

import { app } from 'electron'

const instanceId = process.env.POS_INSTANCE_ID ?? 'default'

if (instanceId !== 'default') {
  const basePath = app.getPath('appData')  // ex: /home/user/.config
  const novoUserData = `${basePath}/pos-terminal-${instanceId}`

  app.setPath('userData', novoUserData)
  app.setName(`BIS POS — ${instanceId}`)

  console.log(`[Bootstrap] POS_INSTANCE_ID=${instanceId}`)
  console.log(`[Bootstrap] userData definido para: ${novoUserData}`)
} else {
  console.log(`[Bootstrap] Modo default (sem POS_INSTANCE_ID)`)
}

// Exporta apenas para forçar que o import seja real (ESM tree-shaking)
export const POS_INSTANCE_ID = instanceId
