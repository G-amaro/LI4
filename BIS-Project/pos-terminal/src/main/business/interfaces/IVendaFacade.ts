/**
 * IVendaFacade — Contrato da Camada de Negócio para Vendas.
 *
 * Define as operações de venda acessíveis ao Controller (IPC handler)
 * sem acoplamento à implementação concreta.
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> IVendaFacade
 *   Diagrama de Sequência 4.4.1 → FacadeVendas (fluxo de registo de venda offline)
 */

import type {
  Result,
  VendaInput,
  VendaLocal,
  VendaCriadaResultado,
  SyncStatus
} from '../../../shared/types'

export interface IVendaFacade {
  /**
   * UC01 — Registar Nova Venda no Terminal POS.
   *
   * Fluxo interno da implementação:
   *   1. Validar dados de entrada
   *   2. Ler LojaId do ConfigDAO (não vem do renderer)
   *   3. Recalcular total a partir das linhas (não confiar no renderer)
   *   4. Delegar inserção atómica ao VendaDAO
   *
   * @param input Dados da venda vindos do renderer
   * @returns Result com UUID, total e número de linhas
   */
  registarNovaVenda(input: VendaInput): Result<VendaCriadaResultado>

  /**
   * Conta vendas por status de sincronização.
   * Usado no Dashboard para o badge de pendentes.
   */
  contarPorStatus(status: SyncStatus): Result<number>

  /**
   * Lista as N vendas mais recentes.
   * Preparado para o futuro ecrã de histórico de vendas.
   *
   * @param limite Máximo de vendas a retornar (clamp interno: 1–100)
   */
  listarRecentes(limite: number): Result<VendaLocal[]>
}
