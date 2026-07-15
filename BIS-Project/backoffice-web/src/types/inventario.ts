/**
 * Tipos do módulo de Inventário.
 * Espelham os DTOs do BIS.Api/DTOs/InventarioDto.cs.
 */

export type EstadoStock = 'Critico' | 'Alerta' | 'OK'

export interface InventarioItem {
  ref:          string
  artigo:       string
  categoria:    string
  total:        number
  stockFraiao:  number
  stockCentro:  number
  stockGualtar: number
  estado:       EstadoStock
}

export interface InventarioResposta {
  itens:        InventarioItem[]
  totalArtigos: number
  totalCritico: number
  totalAlerta:  number
  totalOk:      number
}
