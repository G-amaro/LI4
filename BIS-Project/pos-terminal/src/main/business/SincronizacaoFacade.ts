/**
 * SincronizacaoFacade — Camada de Negócio para Sincronização Offline-First.
 *
 * Pipeline v4 (com transferências e devoluções):
 * 1. Vendas          → POST /api/sync/vendas
 * 2. Quebras         → POST /api/sync/quebras
 * 3. Fechos          → POST /api/sync/fechos
 * 4. Transferências  → POST /api/sync/transferencias (envios + recepções)
 * 5. Devoluções      → POST /api/sync/devolucoes
 * 6. Pull guias      → GET  /api/sync/transferencias/pendentes (para esta loja)
 *
 * Comportamento em falha de rede:
 * - Qualquer passo que falhe por rede aborta o ciclo.
 * - A entidades já marcadas como 'syncing' voltam a 'error' ao próximo ciclo.
 * - Falhas não-rede (validação, dados inválidos) não abortam — continua.
 *
 * Nota arquitetural:
 * O passo 6 é DOWNLOAD (Sede → POS), diferente dos 5 anteriores que são
 * UPLOAD. É o que permite a Loja B descobrir guias emitidas pela Loja A
 * sem comunicação directa entre POS.
 */

import { VendaDAO }         from '../data/VendaDAO'
import { QuebraDAO }        from '../data/QuebraDAO'
import { FechoCaixaDAO }    from '../data/FechoCaixaDAO'
import { TransferenciaDAO } from '../data/TransferenciaDAO'
import { DevolucaoDAO }     from '../data/DevolucaoDAO'
import { ConfigDAO }        from '../data/ConfigDAO'
import { apiClient }        from '../services/ApiClient'
import { ok, fail }         from '../../shared/types'
import { getDb } from '../database/connection'
import type { Result }      from '../../shared/types'
import type { ISincronizacaoFacade, ResultadoSync } from './interfaces/ISincronizacaoFacade'
import { RececaoDAO } from '../data/RececaoDAO'
const BATCH_SIZE = 50

const ERROS_DE_REDE = [
  'Sede inacessível',
  'ECONNABORTED',
  'ERR_NETWORK',
  'timeout'
]

function eErroDeRede(mensagem: string): boolean {
  return ERROS_DE_REDE.some((e) => mensagem.toLowerCase().includes(e.toLowerCase()))
}

// ─────────────────────────────────────────────────────────────────

export class SincronizacaoFacade implements ISincronizacaoFacade {
  private readonly vendaDAO:         VendaDAO
  private readonly quebraDAO:        QuebraDAO
  private readonly fechoCaixaDAO:    FechoCaixaDAO
  private readonly transferenciaDAO: TransferenciaDAO
  private readonly devolucaoDAO:     DevolucaoDAO
  private readonly configDAO:        ConfigDAO
  private readonly rececaoDAO: RececaoDAO

  constructor() {
    this.vendaDAO         = new VendaDAO()
    this.quebraDAO        = new QuebraDAO()
    this.fechoCaixaDAO    = new FechoCaixaDAO()
    this.transferenciaDAO = new TransferenciaDAO()
    this.devolucaoDAO     = new DevolucaoDAO()
    this.configDAO        = new ConfigDAO()
    this.rececaoDAO = new RececaoDAO()
  }

  // ─── Interface pública ───────────────────────────────────────────

  public async sincronizarVendasPendentes(): Promise<Result<ResultadoSync>> {
    return this.executarCicloCompleto()
  }

  public recuperarSyncInterrompido(): number {
    const v = this.vendaDAO.resetarSyncingParaPending()
    const q = this.quebraDAO.resetarSyncingParaPending()
    const f = this.fechoCaixaDAO.resetarSyncingParaPending()
    const t = this.transferenciaDAO.resetarSyncingParaPending()
    const d = this.devolucaoDAO.resetarSyncingParaPending()
    const r = this.rececaoDAO.resetarSyncingParaPending()
    const total = v + q + f + t + d + r 
    
    if (total > 0) {
      console.log(
        `[SincronizacaoFacade] Recovery: ${v} venda(s), ${q} quebra(s), ` +
        `${f} fecho(s), ${t} transferência(s), ${d} devolução(ões) , ${r} receção(ões) → 'pending'`
      )
    }
    return total
  }

  // ─── Pipeline principal ──────────────────────────────────────────

  private async executarCicloCompleto(): Promise<Result<ResultadoSync>> {
    // Pré-condições
     const token = this.configDAO.get('jwt_token')
    if (!token) {
      return fail('Sessão offline activa — faça logout e login online para sincronizar dados pendentes.')
    }

    const lojaIdStr = this.configDAO.get('loja_id')
    if (!lojaIdStr) {
      return fail('Terminal sem loja configurada.')
    }
    const lojaId = Number(lojaIdStr)

    const resultado: ResultadoSync = {
      inseridas:  0,
      duplicadas: 0,
      comErro:    0,
      timestamp:  new Date().toISOString()
    }

    // ── Se nada pendente em NENHUMA tabela, ping de saúde ────────
    const totalPendente =
      this.vendaDAO.listarPendentes(1).length +
      this.quebraDAO.listarPendentes(1).length +
      this.fechoCaixaDAO.listarPendentes(1).length +
      this.transferenciaDAO.listarPendentes(1).length +
      this.devolucaoDAO.listarPendentes(1).length +
      this.rececaoDAO.listarPendentes(1).length 

    if (totalPendente === 0) {
      const sedeViva = await apiClient.ping()
      if (!sedeViva) {
        return fail('Sede inacessível — verifique a ligação à rede.')
      }

      // Sede responde — aproveitar para puxar guias pendentes de outras lojas
      await this.puxarGuiasPendentes(lojaId)
      await this.sincronizarStockDaSede(lojaId)

      resultado.timestamp = new Date().toISOString()
      this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
      return ok(resultado)
    }

    // ── Passo 1: Vendas ──────────────────────────────────────────
    const resVendas = await this.sincronizarVendas(lojaId)
    if (!resVendas.ok) {
      if (eErroDeRede(resVendas.error)) {
        console.warn('[Pipeline] Passo 1 (Vendas): falha de rede — abortar')
        return fail(resVendas.error)
      }
      console.warn('[Pipeline] Passo 1 (Vendas): erro —', resVendas.error)
      return fail(resVendas.error)
    }
    resultado.inseridas  += resVendas.data.inseridas
    resultado.duplicadas += resVendas.data.duplicadas
    resultado.comErro    += resVendas.data.comErro

    // ── Passo 2: Quebras ─────────────────────────────────────────
    const resQuebras = await this.sincronizarQuebras(lojaId)
    if (!resQuebras.ok) {
      if (eErroDeRede(resQuebras.error)) {
        console.warn('[Pipeline] Passo 2 (Quebras): falha de rede — ciclo parcial')
        resultado.timestamp = new Date().toISOString()
        this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
        return ok(resultado)
      }
      console.warn('[Pipeline] Passo 2 (Quebras): erro não-rede —', resQuebras.error)
    } else {
      resultado.inseridas  += resQuebras.data.inseridas
      resultado.duplicadas += resQuebras.data.duplicadas
      resultado.comErro    += resQuebras.data.comErro
    }

    // ── Passo 3: Fechos ──────────────────────────────────────────
    const resFechos = await this.sincronizarFechos(lojaId)
    if (!resFechos.ok) {
      if (eErroDeRede(resFechos.error)) {
        console.warn('[Pipeline] Passo 3 (Fechos): falha de rede — ciclo parcial')
        resultado.timestamp = new Date().toISOString()
        this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
        return ok(resultado)
      }
      console.warn('[Pipeline] Passo 3 (Fechos): erro não-rede —', resFechos.error)
    } else {
      resultado.inseridas  += resFechos.data.inseridas
      resultado.duplicadas += resFechos.data.duplicadas
      resultado.comErro    += resFechos.data.comErro
    }

    // ── Passo 4: Transferências (upload) ─────────────────────────
    const resTransfer = await this.sincronizarTransferencias(lojaId)
    if (!resTransfer.ok) {
      if (eErroDeRede(resTransfer.error)) {
        console.warn('[Pipeline] Passo 4 (Transferências): falha de rede — ciclo parcial')
        resultado.timestamp = new Date().toISOString()
        this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
        return ok(resultado)
      }
      console.warn('[Pipeline] Passo 4 (Transferências): erro não-rede —', resTransfer.error)
    } else {
      resultado.inseridas  += resTransfer.data.inseridas
      resultado.duplicadas += resTransfer.data.duplicadas
      resultado.comErro    += resTransfer.data.comErro
    }

    // ── Passo 5: Devoluções ──────────────────────────────────────
    const resDev = await this.sincronizarDevolucoes(lojaId)
    if (!resDev.ok) {
      if (eErroDeRede(resDev.error)) {
        console.warn('[Pipeline] Passo 5 (Devoluções): falha de rede — ciclo parcial')
        resultado.timestamp = new Date().toISOString()
        this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
        return ok(resultado)
      }
      console.warn('[Pipeline] Passo 5 (Devoluções): erro não-rede —', resDev.error)
    } else {
      resultado.inseridas  += resDev.data.inseridas
      resultado.duplicadas += resDev.data.duplicadas
      resultado.comErro    += resDev.data.comErro
    }
    
    const resRec = await this.sincronizarRececoes(lojaId)
  if (!resRec.ok) {
  if (eErroDeRede(resRec.error)) {
    console.warn('[Pipeline] Passo 6 (Receções): falha de rede — ciclo parcial')
    resultado.timestamp = new Date().toISOString()
    this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)
    return ok(resultado)
  }
  console.warn('[Pipeline] Passo 6 (Receções): erro não-rede —', resRec.error)
  } else {
    resultado.inseridas  += resRec.data.inseridas
    resultado.duplicadas += resRec.data.duplicadas
    resultado.comErro    += resRec.data.comErro
  }

    // ── Passo 6: Pull guias pendentes (download) ─────────────────
    await this.puxarGuiasPendentes(lojaId)

    // ── Conclusão ────────────────────────────────────────────────
    resultado.timestamp = new Date().toISOString()
    this.configDAO.set('ultimo_sync_vendas', resultado.timestamp)

    console.log(
      `[Pipeline] Ciclo concluído — ` +
      `${resultado.inseridas} inseridas, ${resultado.duplicadas} duplicadas, ${resultado.comErro} erros`
    )

    return ok(resultado)
  }

  // ─── Passo 1: Vendas ─────────────────────────────────────────────

  private async sincronizarVendas(
    lojaId: number
  ): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
    const pendentes = this.vendaDAO.listarPendentes(BATCH_SIZE)
    if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })

    const ids = pendentes.map((v) => v.id)
    this.vendaDAO.marcarComoSyncing(ids)
    console.log(`[Pipeline/Vendas] ${pendentes.length} pendente(s) — a enviar...`)

    let resposta: Awaited<ReturnType<typeof apiClient.enviarVendas>>
    try {
      resposta = await apiClient.enviarVendas(lojaId, pendentes)
    } catch (erro) {
      const msg = (erro as Error).message
      this.vendaDAO.marcarComoErro(ids, msg)
      return fail(msg)
    }

    const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
    const idsSynced  = ids.filter((id) => !idsComErro.has(id))

    this.vendaDAO.marcarComoSynced(idsSynced)
    if (idsComErro.size > 0) {
      const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
      this.vendaDAO.marcarComoErro(Array.from(idsComErro), msg)
    }

    return ok({
      inseridas:  resposta.totalInseridas,
      duplicadas: resposta.totalDuplicadas,
      comErro:    resposta.erros.length
    })
  }

  // ─── Passo 2: Quebras ─────────────────────────────────────────────

  private async sincronizarQuebras(
    lojaId: number
  ): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
    const pendentes = this.quebraDAO.listarPendentes(BATCH_SIZE)
    if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })

    const ids = pendentes.map((q) => q.id)
    this.quebraDAO.marcarComoSyncing(ids)
    console.log(`[Pipeline/Quebras] ${pendentes.length} pendente(s) — a enviar...`)

    let resposta: Awaited<ReturnType<typeof apiClient.enviarQuebras>>
    try {
      resposta = await apiClient.enviarQuebras(lojaId, pendentes)
    } catch (erro) {
      const msg = (erro as Error).message
      this.quebraDAO.marcarComoErro(ids, msg)
      return fail(msg)
    }

    const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
    const idsSynced  = ids.filter((id) => !idsComErro.has(id))

    this.quebraDAO.marcarComoSynced(idsSynced)
    if (idsComErro.size > 0) {
      const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
      this.quebraDAO.marcarComoErro(Array.from(idsComErro), msg)
    }

    return ok({
      inseridas:  resposta.totalInseridas,
      duplicadas: resposta.totalDuplicadas,
      comErro:    resposta.erros.length
    })
  }

  // ─── Passo 3: Fechos ──────────────────────────────────────────────

  private async sincronizarFechos(
    lojaId: number
  ): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
    const pendentes = this.fechoCaixaDAO.listarPendentes(BATCH_SIZE)
    if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })

    const ids = pendentes.map((f) => f.id)
    this.fechoCaixaDAO.marcarComoSyncing(ids)
    console.log(`[Pipeline/Fechos] ${pendentes.length} pendente(s) — a enviar...`)

    let resposta: Awaited<ReturnType<typeof apiClient.enviarFechos>>
    try {
      resposta = await apiClient.enviarFechos(lojaId, pendentes)
    } catch (erro) {
      const msg = (erro as Error).message
      this.fechoCaixaDAO.marcarComoErro(ids, msg)
      return fail(msg)
    }

    const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
    const idsSynced  = ids.filter((id) => !idsComErro.has(id))

    this.fechoCaixaDAO.marcarComoSynced(idsSynced)
    if (idsComErro.size > 0) {
      const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
      this.fechoCaixaDAO.marcarComoErro(Array.from(idsComErro), msg)
    }

    return ok({
      inseridas:  resposta.totalInseridas,
      duplicadas: resposta.totalDuplicadas,
      comErro:    resposta.erros.length
    })
  }

  // ─── Passo 4: Transferências ───────────────────────────────────────

  private async sincronizarTransferencias(
    lojaId: number
  ): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
    const pendentes = this.transferenciaDAO.listarPendentes(BATCH_SIZE)
    if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })

    const ids = pendentes.map((t) => t.id)
    this.transferenciaDAO.marcarComoSyncing(ids)
    console.log(`[Pipeline/Transferências] ${pendentes.length} pendente(s) — a enviar...`)

    let resposta: Awaited<ReturnType<typeof apiClient.enviarTransferencias>>
    try {
      resposta = await apiClient.enviarTransferencias(lojaId, pendentes)
    } catch (erro) {
      const msg = (erro as Error).message
      this.transferenciaDAO.marcarComoErro(ids, msg)
      return fail(msg)
    }

    const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
    const idsSynced  = ids.filter((id) => !idsComErro.has(id))

    this.transferenciaDAO.marcarComoSynced(idsSynced)
    if (idsComErro.size > 0) {
      const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
      this.transferenciaDAO.marcarComoErro(Array.from(idsComErro), msg)
    }

    return ok({
      inseridas:  resposta.totalInseridas,
      duplicadas: resposta.totalDuplicadas,
      comErro:    resposta.erros.length
    })
  }

  // ─── Passo 5: Devoluções ───────────────────────────────────────────

  private async sincronizarDevolucoes(
    lojaId: number
  ): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
    const pendentes = this.devolucaoDAO.listarPendentes(BATCH_SIZE)
    if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })
    
    const ids = pendentes.map((d) => d.id)
    this.devolucaoDAO.marcarComoSyncing(ids)
    console.log(`[Pipeline/Devoluções] ${pendentes.length} pendente(s) — a enviar...`)
    
    let resposta: Awaited<ReturnType<typeof apiClient.enviarDevolucoes>>
    try {
      resposta = await apiClient.enviarDevolucoes(lojaId, pendentes)
    } catch (erro) {
      const msg = (erro as Error).message
      this.devolucaoDAO.marcarComoErro(ids, msg)
      return fail(msg)
    }
    
    const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
    const idsSynced  = ids.filter((id) => !idsComErro.has(id))
    
    this.devolucaoDAO.marcarComoSynced(idsSynced)
    if (idsComErro.size > 0) {
      const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
      this.devolucaoDAO.marcarComoErro(Array.from(idsComErro), msg)
    }
    
    return ok({
      inseridas:  resposta.totalInseridas,
      duplicadas: resposta.totalDuplicadas,
      comErro:    resposta.erros.length
    })
  }

  private async sincronizarRececoes(
  lojaId: number
): Promise<Result<{ inseridas: number; duplicadas: number; comErro: number }>> {
  const pendentes = this.rececaoDAO.listarPendentes(BATCH_SIZE)
  if (pendentes.length === 0) return ok({ inseridas: 0, duplicadas: 0, comErro: 0 })

  const ids = pendentes.map((r) => r.id)
  this.rececaoDAO.marcarComoSyncing(ids)
  console.log(`[Pipeline/Receções] ${pendentes.length} pendente(s) — a enviar...`)

  let resposta: Awaited<ReturnType<typeof apiClient.enviarRececoes>>
  try {
    resposta = await apiClient.enviarRececoes(lojaId, pendentes)
  } catch (erro) {
    const msg = (erro as Error).message
    this.rececaoDAO.marcarComoErro(ids, msg)
    return fail(msg)
  }

  const idsComErro = new Set(resposta.erros.map((e) => e.vendaId))
  const idsSynced  = ids.filter((id) => !idsComErro.has(id))

  this.rececaoDAO.marcarComoSynced(idsSynced)
  if (idsComErro.size > 0) {
    const msg = resposta.erros.map((e) => `${e.vendaId.slice(0, 8)}: ${e.motivo}`).join('; ')
    this.rececaoDAO.marcarComoErro(Array.from(idsComErro), msg)
  }

  return ok({
    inseridas:  resposta.totalInseridas,
    duplicadas: resposta.totalDuplicadas,
    comErro:    resposta.erros.length
  })
}

  // ─── Passo 6: Pull guias pendentes (download) ────────────────────

  /**
   * Puxa da Sede as guias de ENVIO destinadas a esta loja que ainda
   * não foram recebidas. Grava cada uma no SQLite local (idempotente).
   *
   * Silencia erros — este passo é best-effort. Se falhar não aborta o ciclo.
   */
  private async puxarGuiasPendentes(lojaId: number): Promise<void> {
    try {
      const guias = await apiClient.obterTransferenciasPendentes(lojaId)
      if (guias.length === 0) return

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

      if (novas > 0) {
        console.log(`[Pipeline/PullGuias] ${novas} nova(s) guia(s) importada(s) da Sede`)
      }
    } catch (erro) {
      console.warn('[Pipeline/PullGuias] Erro ao puxar guias (ignorado):', (erro as Error).message)
    }
  }

  private async sincronizarStockDaSede(lojaId: number): Promise<void> {
    try {
      const stockSede = await apiClient.descarregarStock(lojaId)
      if (stockSede.length === 0) return

      const db = getDb()
      const upsert = db.prepare(`
        INSERT INTO stock_local (produto_id, quantidade, minimo_configurado, atualizado_em)
        VALUES (?, ?, 0, ?)
        ON CONFLICT(produto_id) DO UPDATE
          SET quantidade = excluded.quantidade,
              atualizado_em = excluded.atualizado_em
      `)
      const agora = new Date().toISOString()
      const tx = db.transaction((items: Array<{ produtoId: number; quantidade: number }>) => {
        for (const item of items) {
          upsert.run(item.produtoId, item.quantidade, agora)
        }
      })
      tx(stockSede)

      console.log(`[Pipeline/StockSync] Stock actualizado: ${stockSede.length} produto(s) da Sede`)
    } catch (erro) {
      console.warn('[Pipeline/StockSync] Erro ao sincronizar stock (ignorado):', (erro as Error).message)
    }
  }

}
