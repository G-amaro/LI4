/**
 * IAutenticacaoFacade — Contrato da Camada de Negócio para Autenticação.
 *
 * Define as operações de autenticação que o Controller (IPC handler)
 * pode invocar, sem conhecer a implementação concreta.
 *
 * Vantagens da interface explícita:
 *   - Permite substituir a implementação real por um mock em testes
 *   - Documenta o contrato entre camadas de forma inequívoca
 *   - Rastreabilidade directa com o Diagrama de Componentes UML
 *     (secção 4.3.2 do relatório — IFacadeAutenticacao)
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> IAutenticacaoFacade
 */

import type { Result, LoginPosInput, LoginSucesso, OperadorSessao } from '../../../shared/types'

export interface IAutenticacaoFacade {
  /**
   * Autentica um operador no Terminal POS via NIF + PIN.
   *
   * Fluxo interno da implementação:
   *   1. Valida formato do NIF e PIN (regras de negócio)
   *   2. Chama a API da Sede (POST /api/auth/pos-login)
   *   3. Verifica que a LojaId do token corresponde ao terminal
   *   4. Persiste o JWT e dados do operador no config local
   *
   * @param input NIF, PIN e LojaId do terminal
   * @returns Result com os dados do operador autenticado
   */
  loginPos(input: LoginPosInput): Promise<Result<LoginSucesso>>

  /**
   * Termina a sessão do operador actual.
   * Remove o JWT e todos os dados de sessão do config local.
   *
   * @returns Result<void> — falha apenas em caso de erro de I/O
   */
  logout(): Result<void>

  /**
   * Verifica se existe uma sessão activa válida (token não expirado).
   * Usado no arranque da aplicação para restaurar sessão sem novo login.
   *
   * @returns Result com o operador da sessão actual, ou null se não houver
   */
  obterSessaoAtual(): Result<OperadorSessao | null>
}
