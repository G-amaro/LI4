/**
 * SyncWorker — Serviço de Scheduling para Sincronização Offline-First.
 *
 * Responsabilidade: executar ciclicamente o método da SincronizacaoFacade,
 * gerindo o timing, backoff e estado para o Dashboard.
 *
 * NÃO contém lógica de negócio — delega tudo à ISincronizacaoFacade.
 *
 * Padrão de design:
 *   - Injeção de dependência: recebe ISincronizacaoFacade no construtor
 *     → o SyncWorker não sabe COMO sincronizar, só QUANDO
 *   - setTimeout recursivo (não setInterval): o próximo tick só é agendado
 *     DEPOIS do anterior terminar — elimina overlaps em redes lentas
 *   - Flag `emExecucao`: trava de reentrância para o forçarSync manual
 *   - Backoff exponencial: falha → dobra delay até 5 minutos
 *   - EventEmitter: emite status para o sync-handlers reencaminhar via IPC
 *
 * Correspondência UML:
 *   Diagrama de Classes → SyncWorker na Camada de Serviços
 *   Diagrama de Sequência 4.4.2 → Timer (processo automático)
 */

import { EventEmitter } from 'node:events'
import type { ISincronizacaoFacade } from '../business/interfaces/ISincronizacaoFacade'
import type { SyncWorkerStatus, WorkerEstado } from '../../shared/types'
import { VendaDAO } from '../data/VendaDAO'

const TICK_NORMAL_MS   = 30_000          // 30s entre ciclos em condições normais
const TICK_BACKOFF_MIN = 60_000          // 1min após primeira falha
const TICK_BACKOFF_MAX = 5 * 60_000     // 5min cap de backoff

export class SyncWorker extends EventEmitter {
  // ─── Injeção de dependência ────────────────────────────────────
  private readonly sincronizacaoFacade: ISincronizacaoFacade

  // ─── Referência ao VendaDAO apenas para métricas de status ────
  private readonly vendaDAO: VendaDAO

  // ─── Estado interno do worker ──────────────────────────────────
  private timer:          NodeJS.Timeout | null = null
  private emExecucao:     boolean = false
  private parado:         boolean = true
  private estado:         WorkerEstado = 'idle'
  private ultimoSync:     string | null = null
  private ultimoErro:     string | null = null
  private backoffActual:  number = TICK_NORMAL_MS
  private proximoTickEm:  number | null = null

  // ─────────────────────────────────────────────────────────────────

  constructor(sincronizacaoFacade: ISincronizacaoFacade) {
    super()
    this.sincronizacaoFacade = sincronizacaoFacade
    this.vendaDAO            = new VendaDAO()
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────

  public iniciar(): void {
    if (!this.parado) {
      console.log('[SyncWorker] iniciar() ignorado — já está activo.')
      return
    }

    this.parado = false
    console.log('[SyncWorker] A iniciar...')

    // Recovery de crash antes do primeiro tick
    const recuperadas = this.sincronizacaoFacade.recuperarSyncInterrompido()
    if (recuperadas > 0) {
      console.log(`[SyncWorker] Recuperadas ${recuperadas} venda(s) de sync interrompido.`)
    }

    this.emitirStatus()
    this.agendarProximoTick(1_000)   // primeiro tick passado 1s (não 30s)
  }

  public parar(): void {
    this.parado = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.estado = 'paused'
    this.emitirStatus()
    console.log('[SyncWorker] Parado.')
  }

  /**
   * Executa um ciclo de sync imediatamente, sem aguardar o timer.
   * Útil para o botão "Sincronizar agora" no Dashboard.
   * Se um ciclo já estiver a decorrer, aguarda que termine.
   */
  public async forcarSync(): Promise<SyncWorkerStatus> {
    if (this.emExecucao) {
      console.log('[SyncWorker] forcarSync() ignorado — ciclo já em execução.')
      return this.obterStatus()
    }
    await this.executarCiclo()
    return this.obterStatus()
  }

  public obterStatus(): SyncWorkerStatus {
    return this.construirSnapshot()
  }

  // ─── Loop interno ──────────────────────────────────────────────

  private agendarProximoTick(delayMs: number): void {
    if (this.parado) return
    this.proximoTickEm = Date.now() + delayMs
    this.timer = setTimeout(() => {
      void this.executarCiclo()
    }, delayMs)
    this.emitirStatus()
  }

  private async executarCiclo(): Promise<void> {
    // Trava de reentrância
    if (this.emExecucao || this.parado) return

    this.emExecucao = true
    this.timer = null
    this.estado = 'syncing'
    this.emitirStatus()

    try {
      const resultado = await this.sincronizacaoFacade.sincronizarVendasPendentes()

      if (resultado.ok) {
        // Ciclo com sucesso — reset do backoff
        this.ultimoSync    = resultado.data.timestamp
        this.ultimoErro    = null
        this.estado        = 'idle'
        this.backoffActual = TICK_NORMAL_MS

        if (resultado.data.inseridas > 0 || resultado.data.duplicadas > 0) {
          console.log(
            `[SyncWorker] Ciclo OK — ` +
            `${resultado.data.inseridas} inseridas, ` +
            `${resultado.data.duplicadas} duplicadas, ` +
            `${resultado.data.comErro} erros`
          )
        }

      } else {
        // Falha (rede ou pré-condição) — aplicar backoff
        this.estado       = 'error'
        this.ultimoErro   = resultado.error
        this.backoffActual = Math.min(
          this.backoffActual === TICK_NORMAL_MS
            ? TICK_BACKOFF_MIN
            : this.backoffActual * 2,
          TICK_BACKOFF_MAX
        )
        console.warn(`[SyncWorker] Ciclo falhou: ${resultado.error} — próximo em ${this.backoffActual / 1000}s`)
      }

    } finally {
      this.emExecucao = false
      this.emitirStatus()
      this.agendarProximoTick(
        this.estado === 'error' ? this.backoffActual : TICK_NORMAL_MS
      )
    }
  }

  // ─── Estado e eventos ──────────────────────────────────────────

  private construirSnapshot(): SyncWorkerStatus {
    const pendentes     = this.vendaDAO.contarPorStatus('pending')
                        + this.vendaDAO.contarPorStatus('error')
    const sincronizadas = this.vendaDAO.contarPorStatus('synced')

    return {
      estado:              this.estado,
      ultimaSincronizacao: this.ultimoSync,
      ultimoErro:          this.ultimoErro,
      pendentes,
      sincronizadasTotal:  sincronizadas,
      proximoTickEm:       this.proximoTickEm
        ? new Date(this.proximoTickEm).toISOString()
        : null
    }
  }

  private emitirStatus(): void {
    this.emit('status', this.construirSnapshot())
  }
}
