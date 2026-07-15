/**
 * IDevolucaoFacade — Contrato da Camada de Negócio para Devoluções (UC02).
 */

import type {
  Result,
  VendaOriginal,
  DevolucaoInput,
  DevolucaoResultado
} from '../../../shared/types'

export interface IDevolucaoFacade {
  /**
   * Procura uma venda pelo ID (UUID ou versão curta) para iniciar
   * o processo de devolução.
   *
   * @returns Venda com linhas, ou null se não encontrada
   */
  obterVendaPorId(vendaId: string): Result<VendaOriginal | null>

  /**
   * UC02 — Registar uma devolução de artigos.
   *
   * Valida:
   *   - Venda original existe
   *   - Pelo menos uma linha com quantidade > 0
   *   - Quantidade a devolver ≤ quantidade comprada (menos o já devolvido)
   *   - Produto existe na venda original
   *
   * Persiste devolução + linhas + reposição de stock atomicamente.
   */
  registarDevolucao(input: DevolucaoInput): Result<DevolucaoResultado>
}
