/**
 * IFechoCaixaFacade — Contrato da Camada de Negócio para Fecho de Caixa.
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> IFechoCaixaFacade
 *   UC03 — Fecho de Turno/Dia (Fecho Cego)
 */

import type { Result, ValoresPorMetodo, FechoInput, ResultadoFecho } from '../../../shared/types'

export interface IFechoCaixaFacade {
  /**
   * Devolve o valor teórico de caixa do dia — chamado ANTES de o operador
   * inserir os valores contados. Só o Main Process acede a este valor;
   * o renderer nunca o vê antes da fase de reconciliação (garantia do fecho cego).
   *
   * @returns ValoresPorMetodo com os totais calculados das vendas do dia
   */
  calcularTeorico(): Result<ValoresPorMetodo>

  /**
   * UC03 — Executar o Fecho de Caixa Cego.
   *
   * Fluxo interno:
   *   1. Verificar que não existe fecho hoje (um por dia)
   *   2. Calcular valor teórico das vendas do dia
   *   3. Calcular discrepância = contado - teórico
   *   4. Validar justificação se |discrepância| > LIMITE (2€)
   *   5. Persistir o fecho via DAO
   *
   * @param input Valores contados pelo operador + justificação opcional
   * @returns ResultadoFecho com todos os valores para o ecrã de reconciliação
   */
  registar(input: FechoInput): Result<ResultadoFecho>
}
