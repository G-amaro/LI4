/**
 * ISincronizacaoFacade — Contrato da Camada de Negócio para Sincronização.
 *
 * Define as operações de sincronização de dados entre o terminal POS
 * e o servidor central (Sede), sem acoplamento à implementação concreta.
 *
 * Esta interface é implementada pela SincronizacaoFacade e consumida
 * pelo SyncWorker (via injeção de dependência no construtor).
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> ISincronizacaoFacade
 *   Diagrama de Sequência 4.4.2 → FacadeSincronizacaoOffline
 */

import type { Result } from '../../../shared/types'

/** Estatísticas de um ciclo de sincronização. */
export interface ResultadoSync {
  inseridas:    number   // vendas aceites pela Sede pela primeira vez
  duplicadas:   number   // vendas ignoradas (Guid já existia na Sede)
  comErro:      number   // vendas rejeitadas por validação de negócio
  timestamp:    string   // ISO-8601 UTC do momento do sync
}

export interface ISincronizacaoFacade {
  /**
   * Processo principal do Offline-First (UC02 / RNF1).
   *
   * Fluxo:
   *   1. Verifica pré-condições (JWT válido, LojaId configurada)
   *   2. Lê vendas pendentes do VendaDAO (máximo BATCH_SIZE)
   *   3. Marca-as como 'syncing' antes de enviar (previne double-send)
   *   4. Envia o batch para a Sede via ApiClient
   *   5. Marca como 'synced' as aceites, 'error' as rejeitadas
   *   6. Actualiza o timestamp de último sync no config
   *
   * @returns Result com estatísticas do ciclo, ou fail com motivo
   */
  sincronizarVendasPendentes(): Promise<Result<ResultadoSync>>

  /**
   * Recuperação de crash: vendas que ficaram com status 'syncing'
   * (processo terminou a meio de um ciclo) voltam a 'pending'.
   *
   * Deve ser chamado no arranque da aplicação, antes de iniciar o worker.
   *
   * @returns Número de vendas recuperadas
   */
  recuperarSyncInterrompido(): number
}
