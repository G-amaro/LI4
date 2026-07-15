import type { FornecedorLocal, Result, SyncFornecedoresResultado } from '../../../shared/types'

/**
 * Interface da Fachada de Fornecedores — Fase 4.
 *
 * Operações disponíveis:
 *   - listar / porId / contar (consulta local)
 *   - sincronizar (download da Sede, executado pelo SyncWorker e por acção manual)
 */
export interface IFornecedorFacade {
  listar(): Result<FornecedorLocal[]>

  porId(id: number): Result<FornecedorLocal | null>

  contar(): Result<number>

  sincronizar(): Promise<Result<SyncFornecedoresResultado>>
}
