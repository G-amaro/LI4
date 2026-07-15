/**
 * Main Process — Composition Root da aplicação POS.
 *
 * ⚠️ IMPORTANTE: o PRIMEIRO import deve ser './bootstrap' — esse ficheiro
 * aplica o userData path consoante o POS_INSTANCE_ID antes de qualquer
 * outro import tocar no SQLite. Se mudares a ordem, o multi-instância parte.
 */

// ═══ BOOTSTRAP — TEM DE SER O PRIMEIRO IMPORT ═══
import './bootstrap'
// ═════════════════════════════════════════════════

import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// ─── Infra ────────────────────────────────────────────────────────
import { getDb, closeDb } from './database/connection'

// ─── Controllers (IPC) ───────────────────────────────────────────
import { registerConfigHandlers }         from './ipc/config-handlers'
import { registerAuthHandlers }           from './ipc/auth-handlers'
import { registerCatalogoHandlers }       from './ipc/catalogo-handlers'
import { registerVendasHandlers }         from './ipc/vendas-handlers'
import { registerSyncHandlers }           from './ipc/sync-handlers'
import { registerQuebrasHandlers }        from './ipc/quebras-handlers'
import { registerFechoCaixaHandlers }     from './ipc/fecho-caixa-handlers'
import { registerDevolucaoHandlers }      from './ipc/devolucao-handlers'
import { registerRececaoHandlers }        from './ipc/rececao-handlers'
import { registerTransferenciaHandlers }  from './ipc/transferencia-handlers'
import { registerFornecedoresHandlers } from './ipc/fornecedor-handlers'
import { registerStockHandlers } from './ipc/stock-handlers'
// ─── Serviços de topo (Composition Root) ────────────────────────
import { SincronizacaoFacade } from './business/SincronizacaoFacade'
import { SyncWorker }          from './services/SyncWorker'

const sincronizacaoFacade = new SincronizacaoFacade()
const syncWorker          = new SyncWorker(sincronizacaoFacade)

let mainWindow: BrowserWindow | null = null

// ─── Janela ───────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Título da janela reflecte a instância (útil com 2 janelas abertas)
  const instanceId = process.env.POS_INSTANCE_ID ?? 'default'
  if (instanceId !== 'default') {
    mainWindow.setTitle(`BIS POS — ${instanceId.toUpperCase()}`)
  }

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Arranque ─────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bragaconvenience.bis.pos')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))

  // Confirmação visual — devolve a pasta efectivamente usada
  console.log(`[Main] userData efectivo: ${app.getPath('userData')}`)

  // 1. SQLite
  try {
    const db = getDb() // <-- Guardamos a referência do db aqui
    console.log('[Main] SQLite inicializado.')

    // --- PROVISIONAMENTO AUTOMÁTICO DO TERMINAL ---
    const initialLojaId = process.env.INITIAL_LOJA_ID
    if (initialLojaId) {
      try {
        // Verifica se o loja_id já existe na configuração
        const config = db.prepare("SELECT valor FROM config WHERE chave = 'loja_id'").get()
        
        if (!config) {
          // Se a tabela estiver vazia, injetamos o ID do terminal!
          db.prepare("INSERT INTO config (chave, valor) VALUES ('loja_id', ?)").run(initialLojaId)
          console.log(`[Provisionamento] Terminal auto-configurado para a Loja ID: ${initialLojaId}`)
        }
      } catch (err) {
        console.warn("[Provisionamento] A tabela config pode ainda não existir (primeiro arranque absoluto):", err)
      }
    }
    // ----------------------------------------------

  } catch (err) {
    console.error('[Main] Falha crítica ao inicializar SQLite:', err)
    app.quit()
    return
  }

  // 2. Registar handlers IPC
  registerConfigHandlers()
  registerAuthHandlers()
  registerCatalogoHandlers()
  registerVendasHandlers()
  registerSyncHandlers(syncWorker, () => mainWindow?.webContents ?? null)
  registerQuebrasHandlers()
  registerFechoCaixaHandlers()
  registerDevolucaoHandlers()
  registerRececaoHandlers()
  registerTransferenciaHandlers()
  registerFornecedoresHandlers()
  registerStockHandlers()
  console.log('[Main] Handlers IPC registados.')

  // 3. Criar janela
  createWindow()

  // 4. Iniciar SyncWorker após a janela estar pronta
  mainWindow?.once('ready-to-show', () => {
    syncWorker.iniciar()
    console.log('[Main] SyncWorker iniciado.')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ─── Encerramento ──────────────────────────────────────────────────

app.on('window-all-closed', () => {
  syncWorker.parar()
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
