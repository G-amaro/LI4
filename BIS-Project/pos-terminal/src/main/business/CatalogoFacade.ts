/**
 * CatalogoFacade — Camada de Negócio para o Catálogo de Produtos.
 *
 * Coordena:
 *   - CatalogoDAO: persistência local (SQLite)
 *   - ConfigDAO: leitura de sessão (JWT, timestamps)
 *   - ApiClient: comunicação com a Sede
 *
 * Regras de negócio aqui encapsuladas:
 *   - Sincronização só é possível com JWT válido (sessão activa)
 *   - Termos de pesquisa com menos de 2 caracteres são rejeitados
 *   - Timestamp de último sync é responsabilidade desta Facade
 *
 * Correspondência UML:
 *   Diagrama de Classes → CatalogoFacade (implementa ICatalogoFacade)
 *   Diagrama de Sequência → FacadeInventario (gestão do catálogo local)
 */

import { CatalogoDAO } from '../data/CatalogoDAO'
import { ConfigDAO }   from '../data/ConfigDAO'
import { apiClient }   from '../services/ApiClient'
import { ok, fail }    from '../../shared/types'
import type {
  Result,
  ProdutoLocal,
  SyncCatalogoResultado
} from '../../shared/types'
import type { ICatalogoFacade } from './interfaces/ICatalogoFacade'

export class CatalogoFacade implements ICatalogoFacade {
  private readonly catalogoDAO: CatalogoDAO
  private readonly configDAO:   ConfigDAO

  constructor() {
    this.catalogoDAO = new CatalogoDAO()
    this.configDAO   = new ConfigDAO()
  }

  // ─────────────────────────────────────────────────────────────────

  public listar(): Result<ProdutoLocal[]> {
    try {
      return ok(this.catalogoDAO.listar())
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public porEan(ean: string): Result<ProdutoLocal | null> {
    if (!ean || ean.trim().length === 0) {
      return fail('EAN não pode estar vazio.')
    }
    try {
      return ok(this.catalogoDAO.porEan(ean.trim()))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public porId(id: number): Result<ProdutoLocal | null> {
    if (!Number.isInteger(id) || id < 1) {
      return fail('ID de produto inválido.')
    }
    try {
      return ok(this.catalogoDAO.porId(id))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public pesquisar(termo: string): Result<ProdutoLocal[]> {
    const termoLimpo = termo.trim()
    if (termoLimpo.length < 2) {
      return ok([]) // Regra de negócio: pesquisa com menos de 2 caracteres retorna vazio
    }
    try {
      return ok(this.catalogoDAO.pesquisar(termoLimpo))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public contar(): Result<number> {
    try {
      return ok(this.catalogoDAO.contar())
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public upsertMany(
    produtos: ProdutoLocal[]
  ): Result<{ inseridos: number; atualizados: number }> {
    if (!Array.isArray(produtos) || produtos.length === 0) {
      return fail('Lista de produtos não pode estar vazia.')
    }
    try {
      const timestamp = new Date().toISOString()
      const resultado = this.catalogoDAO.upsertMany(produtos, timestamp)
      return ok(resultado)
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  public async sincronizar(): Promise<Result<SyncCatalogoResultado>> {
    // Regra de negócio: só sincroniza com sessão activa
    const token = this.configDAO.get('jwt_token')
    if (!token) {
      return fail('Sem sessão activa. Faça login antes de sincronizar.')
    }

    const inicio = Date.now()

    let remotos: Awaited<ReturnType<typeof apiClient.getCatalogo>>
    try {
      remotos = await apiClient.getCatalogo()
    } catch (erro) {
      return fail((erro as Error).message)
    }

    if (!Array.isArray(remotos)) {
      return fail('Resposta da Sede em formato inesperado.')
    }

    const timestamp = new Date().toISOString()

    const locais: ProdutoLocal[] = remotos.map((p) => ({
      id:           p.id,
      ean:          p.ean,
      artigo:       p.artigo,
      categoria:    p.categoria,
      precoCusto:   p.precoCusto,
      pvp:          p.pvp,
      perecivel:    p.perecivel,
      taxaIVA:      p.taxaIVA ?? 23,
      imagemUrl:    p.imagemUrl ?? null,
      atualizadoEm: timestamp
    }))

    let resultado: { inseridos: number; atualizados: number }
    try {
      resultado = this.catalogoDAO.upsertMany(locais, timestamp)
    } catch (erro) {
      return fail(`Erro ao guardar catálogo: ${(erro as Error).message}`)
    }

    // Responsabilidade de negócio — o DAO não actualiza configurações
    this.configDAO.set('ultimo_sync_catalogo', timestamp)

    console.log(
      `[CatalogoFacade] Sync OK — ${resultado.inseridos} novos, ` +
      `${resultado.atualizados} actualizados (${Date.now() - inicio}ms)`
    )

    return ok({
      inseridos:   resultado.inseridos,
      atualizados: resultado.atualizados,
      total:       locais.length,
      timestamp
    })
  }
}
