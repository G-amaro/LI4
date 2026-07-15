/**
 * TransferenciaFacade — Camada de Negócio para Transferências entre Lojas (UC10).
 *
 * Regras de negócio ENVIO:
 *   1. Operador válido
 *   2. Loja origem (esta loja) ≠ loja destino
 *   3. Loja destino é válida (> 0)
 *   4. Pelo menos 1 linha com quantidade > 0
 *   5. Sem duplicados (mesmo produto em 2 linhas)
 *   6. Stock suficiente para cada produto (validação final no DAO, dentro da transacção)
 *
 * Regras de negócio RECEPÇÃO:
 *   1. Operador válido
 *   2. Guia de envio existe no sistema local
 *   3. Loja destino da guia = esta loja (defensivo)
 *   4. Guia ainda não recebida (UNIQUE constraint no DAO reforça)
 *   5. Quantidades recebidas > 0
 *   6. Todos os produtoIds devem constar da guia original (não aceita extras)
 *
 * Nota: a validação de que a quantidade recebida = enviada NÃO é rígida —
 * em contextos reais pode haver perdas em trânsito. Guardamos o que o operador
 * declara; divergências ficam registadas como auditoria natural quando a Sede
 * faz o matching dos dois eventos.
 */

import { TransferenciaDAO } from '../data/TransferenciaDAO'
import { CatalogoDAO }      from '../data/CatalogoDAO'
import { ConfigDAO }        from '../data/ConfigDAO'
import { ok, fail }         from '../../shared/types'
import type {
  Result,
  EnvioInput,
  RececaoTransferenciaInput,
  GuiaEnvio,
  TransferenciaResultado
} from '../../shared/types'
import type { ITransferenciaFacade } from './interfaces/ITransferenciaFacade'
import { apiClient } from '../services/ApiClient'

export class TransferenciaFacade implements ITransferenciaFacade {
  private readonly transferenciaDAO: TransferenciaDAO
  private readonly catalogoDAO:      CatalogoDAO
  private readonly configDAO:        ConfigDAO

  constructor() {
    this.transferenciaDAO = new TransferenciaDAO()
    this.catalogoDAO      = new CatalogoDAO()
    this.configDAO        = new ConfigDAO()
  }

  // ─── ENVIO ───────────────────────────────────────────────────────

  public registarEnvio(input: EnvioInput): Result<TransferenciaResultado> {
    // Regra 1: operador
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido.')
    }

    // Loja origem = esta loja
    const lojaOrigemStr = this.configDAO.get('loja_id')
    if (!lojaOrigemStr) {
      return fail('Terminal não configurado: ID de loja em falta.')
    }
    const lojaOrigemId = Number(lojaOrigemStr)

    // Regra 2+3: loja destino válida e diferente da origem
    if (!Number.isInteger(input.lojaDestinoId) || input.lojaDestinoId < 1) {
      return fail('Loja destino inválida.')
    }
    if (input.lojaDestinoId === lojaOrigemId) {
      return fail('A loja destino tem de ser diferente da loja de origem.')
    }

    // Regra 4: linhas
    if (!input.linhas || input.linhas.length === 0) {
      return fail('Indique pelo menos um artigo a enviar.')
    }
    for (const linha of input.linhas) {
      if (!Number.isInteger(linha.quantidade) || linha.quantidade <= 0) {
        return fail(`Quantidade inválida para produto ${linha.produtoId}: deve ser inteiro > 0.`)
      }
      if (!Number.isInteger(linha.produtoId) || linha.produtoId < 1) {
        return fail(`ID de produto inválido: ${linha.produtoId}.`)
      }
    }

    // Regra 5: sem duplicados
    const ids = new Set<number>()
    for (const linha of input.linhas) {
      if (ids.has(linha.produtoId)) {
        return fail(`O produto ${linha.produtoId} aparece mais do que uma vez.`)
      }
      ids.add(linha.produtoId)
    }

    // Produtos existem no catálogo
    for (const linha of input.linhas) {
      if (!this.catalogoDAO.porId(linha.produtoId)) {
        return fail(`Produto ${linha.produtoId} não existe no catálogo local.`)
      }
    }

    // Regra 6: stock suficiente (validação final dentro da transacção do DAO)
    try {
      const resultado = this.transferenciaDAO.inserirEnvio(
        lojaOrigemId,
        input.lojaDestinoId,
        input.operadorId,
        input.documentoReferencia?.trim() || null,
        input.observacoes?.trim() || null,
        input.linhas
      )
      console.log(`[TransferenciaFacade] Envio ${resultado.id.slice(0, 8)}... registado.`)
      return ok(resultado)
    } catch (erro) {
      console.error('[TransferenciaFacade] registarEnvio falhou:', erro)
      return fail((erro as Error).message)
    }
  }

  // ─── Obter Guia ──────────────────────────────────────────────────

  public obterGuia(transferenciaId: string): Result<GuiaEnvio | null> {
    if (!transferenciaId || transferenciaId.trim().length === 0) {
      return fail('ID da guia obrigatório.')
    }
    try {
      const guia = this.transferenciaDAO.obterGuiaEnvio(transferenciaId.trim())
      return ok(guia)
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─── RECEPÇÃO ────────────────────────────────────────────────────

  public registarRececao(input: RececaoTransferenciaInput): Result<TransferenciaResultado> {
    if (!Number.isInteger(input.operadorId) || input.operadorId < 1) {
      return fail('Operador inválido.')
    }

    const lojaActualStr = this.configDAO.get('loja_id')
    if (!lojaActualStr) {
      return fail('Terminal não configurado.')
    }
    const lojaActualId = Number(lojaActualStr)

    // Regra 2: guia existe
    const guia = this.transferenciaDAO.obterGuiaEnvio(input.transferenciaEnvioId)
    if (!guia) {
      return fail(`Guia de envio ${input.transferenciaEnvioId} não encontrada neste terminal.`)
    }

    // Regra 3: esta loja é mesmo a destino
    if (guia.lojaDestinoId !== lojaActualId) {
      return fail(
        `Esta guia destina-se à loja ${guia.lojaDestinoId}, mas o terminal actual ` +
        `está registado como loja ${lojaActualId}.`
      )
    }

    // Regra 4: não foi já recebida
    if (guia.jaRecebida) {
      return fail(`Esta guia já foi recebida anteriormente.`)
    }

    // Regra 5: linhas válidas
    if (!input.linhas || input.linhas.length === 0) {
      return fail('Indique pelo menos um artigo recebido.')
    }

    const linhasValidas = input.linhas.filter((l) => l.quantidade > 0)
    if (linhasValidas.length === 0) {
      return fail('Pelo menos um artigo deve ter quantidade > 0.')
    }

    // Regra 6: produtos devem constar da guia original
    const produtosDaGuia = new Set(guia.linhas.map((l) => l.produtoId))
    for (const linha of linhasValidas) {
      if (!produtosDaGuia.has(linha.produtoId)) {
        return fail(`O produto ${linha.produtoId} não consta da guia original.`)
      }
      if (!Number.isInteger(linha.quantidade) || linha.quantidade <= 0) {
        return fail(`Quantidade inválida para produto ${linha.produtoId}.`)
      }
    }

    // Sem duplicados
    const ids = new Set<number>()
    for (const linha of linhasValidas) {
      if (ids.has(linha.produtoId)) {
        return fail(`O produto ${linha.produtoId} aparece mais do que uma vez.`)
      }
      ids.add(linha.produtoId)
    }

    try {
      const resultado = this.transferenciaDAO.inserirRececao(
        input.transferenciaEnvioId,
        guia.lojaOrigemId,
        lojaActualId,
        input.operadorId,
        input.observacoes?.trim() || null,
        linhasValidas
      )
      console.log(`[TransferenciaFacade] Recepção ${resultado.id.slice(0, 8)}... registada.`)
      return ok(resultado)
    } catch (erro) {
      console.error('[TransferenciaFacade] registarRececao falhou:', erro)
      return fail((erro as Error).message)
    }
  }

  // ─── Listar lojas (dropdown UI) ──────────────────────────────────

  public listarLojas(): Result<Array<{ id: number; nome: string }>> {
    try {
      // Do cache local — preenchido numa sincronização futura.
      // Enquanto não existe, devolvemos uma lista hardcoded coerente com o seed
      // da Sede, filtrando a loja actual (para não aparecer no dropdown de destino).
      const lojaActualStr = this.configDAO.get('loja_id')
      const lojaActualId = lojaActualStr ? Number(lojaActualStr) : 0

      const cache = this.transferenciaDAO.listarLojasCache()
      const lista = cache.length > 0
        ? cache
        : [
            { id: 1, nome: 'Sede' },
            { id: 2, nome: 'Fraião' },
            { id: 3, nome: 'Centro' },
            { id: 4, nome: 'Gualtar' }
          ]

      return ok(lista.filter((l) => l.id !== lojaActualId))
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  public async sincronizarGuiasPendentes(): Promise<Result<{ novas: number; total: number }>> {
  const lojaIdStr = this.configDAO.get('loja_id')
  if (!lojaIdStr) {
    return fail('Terminal não configurado.')
  }
  const lojaId = Number(lojaIdStr)
 
  const token = this.configDAO.get('jwt_token')
  if (!token) {
    return fail('Sem sessão activa — faça login para sincronizar.')
  }
 
  try {
    const guias = await apiClient.obterTransferenciasPendentes(lojaId)
 
    let novas = 0
    for (const guia of guias) {
      const importada = this.transferenciaDAO.importarGuiaDaSede({
        id:                   guia.id,
        lojaOrigemId:         guia.lojaOrigemId,
        lojaDestinoId:        guia.lojaDestinoId,
        dataMovimento:        guia.dataMovimento,
        documentoReferencia:  guia.documentoReferencia,
        observacoes:          guia.observacoes,
        linhas:               guia.linhas
      })
      if (importada) novas++
    }
 
    console.log(
      `[TransferenciaFacade] Sync guias — ${guias.length} na Sede, ` +
      `${novas} novas importadas, ${guias.length - novas} já existiam`
    )
 
    return ok({ novas, total: guias.length })
  } catch (erro) {
    return fail(`Erro ao obter guias pendentes: ${(erro as Error).message}`)
  }
}

public listarGuiasPendentes(): Result<Array<{
  id:                   string
  lojaOrigemId:         number
  dataMovimento:        string
  documentoReferencia:  string | null
  numeroLinhas:         number
  totalUnidades:        number
}>> {
  const lojaIdStr = this.configDAO.get('loja_id')
  if (!lojaIdStr) return fail('Terminal não configurado.')
  const lojaId = Number(lojaIdStr)

  try {
    const lista = this.transferenciaDAO.listarGuiasPendentesLocais(lojaId)
    return ok(lista)
  } catch (erro) {
    return fail((erro as Error).message)
  }
}
}
