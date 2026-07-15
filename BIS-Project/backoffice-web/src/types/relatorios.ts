/**
 * Tipos dos Relatórios Financeiros.
 * Espelham os DTOs em BIS.Api/DTOs/RelatoriosDto.cs.
 */

export interface ResumoFinanceiro {
  totalDiscrepancias: number
  totalQuebras:       number
  numeroFechos:       number
  numeroQuebras:      number
}

export interface FechoCaixaRelatorio {
  data:           string
  loja:           string
  operadorTurno:  string
  valorTeorico:   number
  valorDeclarado: number
  discrepancia:   number
}

export type MotivoQuebraLabel = 'Furto' | 'Dano Físico' | 'Validade'

export interface QuebraRelatorio {
  data:          string
  loja:          string
  artigo:        string
  quantidade:    number
  precoCusto:    number
  perdaTotal:    number
  motivo:        string   // vem como string, tipado solto para resiliência
  operadorTurno: string
}
