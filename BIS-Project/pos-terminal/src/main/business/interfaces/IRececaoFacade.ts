/**
 * IRececaoFacade — Contrato da Camada de Negócio para Receção de Mercadoria (UC09).
 */

import type {
  Result,
  RececaoInput,
  RececaoResultado
} from '../../../shared/types'

export interface IRececaoFacade {
  /**
   * Regista uma receção de mercadoria e incrementa stock atomicamente.
   *
   * Valida:
   *   - Operador autenticado
   *   - Loja configurada
   *   - Pelo menos 1 linha
   *   - Quantidades > 0
   *   - Produtos existem no catálogo local
   *   - Sem duplicados (mesmo produto em 2 linhas)
   *
   * @returns RececaoResultado com ID e totais
   */
  registarRececao(input: RececaoInput): Result<RececaoResultado>
}
