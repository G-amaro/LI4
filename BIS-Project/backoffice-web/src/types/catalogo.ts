/**
 * Tipos do módulo de Catálogo.
 * Espelham os DTOs do BIS.Api/DTOs/CriarProdutoDto.cs.
 */

export interface Produto {
  id:         number
  ean:        string
  artigo:     string
  categoria:  string
  precoCusto: number
  pvp:        number
  perecivel:  boolean
  taxaIVA:    number
  imagemUrl?: string | null
}

export interface CriarProdutoInput {
  ean:        string
  artigo:     string
  categoria:  string
  precoCusto: number
  pvp:        number
  perecivel:  boolean
  taxaIVA:    number
  imagemUrl?: string | null
}
