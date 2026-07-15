/**
 * ICatalogoFacade — Contrato da Camada de Negócio para o Catálogo de Produtos.
 *
 * Define as operações de catálogo acessíveis ao Controller (IPC handler)
 * sem acoplamento à implementação concreta.
 *
 * Correspondência UML:
 *   Diagrama de Classes → <<interface>> ICatalogoFacade
 *   Diagrama de Componentes → interface ICamadaNegocio (catálogo)
 */

import type {
  Result,
  ProdutoLocal,
  SyncCatalogoResultado
} from '../../../shared/types'

export interface ICatalogoFacade {
  /** Lista todos os produtos do catálogo local, ordenados por categoria e nome. */
  listar(): Result<ProdutoLocal[]>

  /**
   * Procura um produto pelo código de barras EAN.
   * Usado pelo leitor ótico na VendaPage.
   */
  porEan(ean: string): Result<ProdutoLocal | null>

  /** Procura um produto pelo ID numérico interno (igual ao ID da Sede). */
  porId(id: number): Result<ProdutoLocal | null>

  /**
   * Pesquisa produtos por nome, categoria ou EAN (parcial, case-insensitive).
   * Usado no campo de texto da VendaPage.
   */
  pesquisar(termo: string): Result<ProdutoLocal[]>

  /** Conta o número total de produtos no catálogo local. */
  contar(): Result<number>

  /**
   * Insere ou actualiza uma lista de produtos no catálogo local.
   * Usado para testes de integração e para injecção manual de dados.
   *
   * @returns Contagem de produtos inseridos e actualizados
   */
  upsertMany(produtos: ProdutoLocal[]): Result<{ inseridos: number; atualizados: number }>

  /**
   * Sincroniza o catálogo local com a Sede via API.
   *
   * Fluxo: verifica JWT → GET /api/produtos → upsert local → actualiza timestamp.
   */
  sincronizar(): Promise<Result<SyncCatalogoResultado>>
}
