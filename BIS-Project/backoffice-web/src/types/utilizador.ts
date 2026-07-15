/**
 * Tipos do módulo de Utilizadores.
 * Espelham os DTOs do BIS.Api/DTOs/UtilizadorDto.cs.
 */

export type PerfilUtilizador =
  | 'Funcionario'
  | 'GerenteLoja'
  | 'GerenteSede'
  | 'Administrador'

export interface Utilizador {
  id:           number
  nome:         string
  nif:          string
  email:        string | null
  perfil:       string   // nome do enum como string
  pin:          string
  ativo:        boolean
  lojaBaseId:   number
  lojaBaseNome: string
}

export interface CriarUtilizadorInput {
  nome:       string
  nif:        string
  email:      string | null
  perfil:     PerfilUtilizador
  pin:        string
  lojaBaseId: number
}
