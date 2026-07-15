/**
 * FornecedorFacade — Fase 4.
 *
 * Coordena consulta local de fornecedores e sincronização com a Sede.
 * Sincronização: descarrega catálogo completo de fornecedores activos,
 * faz upsert na BD local, retorna estatísticas.
 */

import { FornecedorDAO } from '../data/FornecedorDAO'
import { ConfigDAO } from '../data/ConfigDAO'
import { apiClient } from '../services/ApiClient'
import { ok, fail } from '../../shared/types'
import type {
  FornecedorLocal,
  Result,
  SyncFornecedoresResultado
} from '../../shared/types'
import type { IFornecedorFacade } from './interfaces/IFornecedorFacade'

export class FornecedorFacade implements IFornecedorFacade {
  constructor(
    private fornecedorDAO: FornecedorDAO,
    private configDAO:     ConfigDAO
  ) {}

  // ─── Consultas locais ─────────────────────────────────────────

  public listar(): Result<FornecedorLocal[]> {
    try {
      const lista = this.fornecedorDAO.listarAtivos()
      return ok(lista)
    } catch (e) {
      return fail((e as Error).message)
    }
  }

  public porId(id: number): Result<FornecedorLocal | null> {
    try {
      return ok(this.fornecedorDAO.porId(id))
    } catch (e) {
      return fail((e as Error).message)
    }
  }

  public contar(): Result<number> {
    try {
      return ok(this.fornecedorDAO.contar())
    } catch (e) {
      return fail((e as Error).message)
    }
  }

  // ─── Sincronização ────────────────────────────────────────────

  public async sincronizar(): Promise<Result<SyncFornecedoresResultado>> {
    try {
      console.log('[FornecedorFacade] A descarregar fornecedores da Sede...')
      const fornecedores = await apiClient.descarregarFornecedores()

      const { inseridos, atualizados } = this.fornecedorDAO.upsertMany(fornecedores)
      const timestamp = new Date().toISOString()

      this.configDAO.set('ultimo_sync_fornecedores', timestamp)

      console.log(
        `[FornecedorFacade] ${fornecedores.length} fornecedor(es) ` +
        `(${inseridos} novos, ${atualizados} actualizados)`
      )

      return ok({
        inseridos,
        atualizados,
        total:     fornecedores.length,
        timestamp
      })
    } catch (e) {
      const msg = (e as Error).message
      console.error('[FornecedorFacade] Erro a sincronizar fornecedores:', msg)
      return fail(msg)
    }
  }
}
