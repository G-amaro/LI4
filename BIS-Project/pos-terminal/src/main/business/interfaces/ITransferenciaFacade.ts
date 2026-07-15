/**
 * ITransferenciaFacade — Contrato da Camada de Negócio para Transferências (UC10).
 */

import type {
  Result,
  EnvioInput,
  RececaoTransferenciaInput,
  GuiaEnvio,
  TransferenciaResultado
} from '../../../shared/types'

export interface ITransferenciaFacade {
  registarEnvio(input: EnvioInput): Result<TransferenciaResultado>
  obterGuia(transferenciaId: string): Result<GuiaEnvio | null>
  registarRececao(input: RececaoTransferenciaInput): Result<TransferenciaResultado>
  listarLojas(): Result<Array<{ id: number; nome: string }>>
  sincronizarGuiasPendentes(): Promise<Result<{ novas: number; total: number }>>
  listarGuiasPendentes(): Result<Array<{
  id:                   string
  lojaOrigemId:         number
  dataMovimento:        string
  documentoReferencia:  string | null
  numeroLinhas:         number
  totalUnidades:        number
}>>
}
