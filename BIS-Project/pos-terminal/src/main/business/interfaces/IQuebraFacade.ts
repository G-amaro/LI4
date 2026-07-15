/**
 * IQuebraFacade — Contrato da Camada de Negócio para Quebras de Stock.
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> IQuebraFacade
 *   UC08 — Registo de Quebras de Stock
 */

import type { Result, QuebraInput, QuebrasRegistadaResultado } from '../../../shared/types'

export interface IQuebraFacade {
  /**
   * UC08 — Registar quebra de stock.
   *
   * Fluxo interno da implementação:
   *   1. Validar input (quantidade > 0, motivo válido)
   *   2. Obter LojaId do ConfigDAO
   *   3. Obter produto do CatalogoDAO para calcular valorPerdido
   *   4. Delegar inserção atómica ao QuebraDAO (quebra + stock)
   *
   * Imutabilidade: após submissão, uma quebra não pode ser anulada.
   * Correcções exigem novo lançamento com autorização do Administrador.
   */
  registarQuebra(input: QuebraInput): Result<QuebrasRegistadaResultado>
}
