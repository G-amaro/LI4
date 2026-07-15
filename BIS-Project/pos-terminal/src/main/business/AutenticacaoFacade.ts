/**
 * AutenticacaoFacade — Camada de Negócio para Autenticação.
 *
 * ALTERAÇÃO v2 (multi-instância):
 *   O input.lojaId deixou de ser obrigatório no login. Em terminais
 *   com BD nova (primeira vez a arrancar), o config 'loja_id' ainda
 *   não existe — e o operador pertence a uma loja fixa (lojaBaseId)
 *   que é devolvida pelo backend. É essa que passa a ser a fonte
 *   da verdade: gravamos 'loja_id' após o primeiro login bem sucedido.
 *
 * Regras de negócio encapsuladas:
 *   - Formato obrigatório do NIF (9 dígitos)
 *   - Formato obrigatório do PIN (4–6 dígitos)
 *   - Validação do perfil recebido pelo backend
 *   - Controlo de expiração do JWT
 *   - Restrição de terminal: se o config já tem loja_id, tem de bater
 *     certo com o operador (previne operador da loja A logar em terminal
 *     já configurado para loja B)
 */

import { ConfigDAO } from '../data/ConfigDAO'
import { apiClient } from '../services/ApiClient'
import { ok, fail } from '../../shared/types'
import type {
  Result,
  LoginPosInput,
  LoginSucesso,
  OperadorSessao,
  Perfil
} from '../../shared/types'
import type { IAutenticacaoFacade } from './interfaces/IAutenticacaoFacade'
import { OperadorCacheDAO } from '../data/OperadorCacheDAO'
import { getDb } from '../database/connection'

const PERFIS_VALIDOS: ReadonlySet<string> = new Set([
  'Funcionario', 'GerenteLoja', 'GerenteSede', 'Administrador'
])

export class AutenticacaoFacade implements IAutenticacaoFacade {
  private readonly configDAO: ConfigDAO
  private readonly cacheDAO: OperadorCacheDAO

  constructor() {
    this.configDAO = new ConfigDAO()
    this.cacheDAO = new OperadorCacheDAO(getDb())
  }

  // ─────────────────────────────────────────────────────────────────
  public async loginPos(input: LoginPosInput): Promise<Result<LoginSucesso>> {
    // ── Validação de formato (NIF e PIN continuam obrigatórios) ──
    if (!/^\d{9}$/.test(input.nif)) {
      return fail('NIF deve conter exactamente 9 dígitos numéricos.')
    }
    if (!/^\d{4,6}$/.test(input.pin)) {
      return fail('PIN deve ter entre 4 e 6 dígitos numéricos.')
    }

    // ── lojaId é agora OPCIONAL ──────────────────────────────────
    // Se o terminal ainda não está configurado (1ª vez a arrancar),
    // usamos a lojaBaseId do operador devolvida pelo backend.
    // Se o terminal JÁ está configurado, usamos esse valor como
    // restrição de segurança (ver regra mais abaixo).
    let lojaIdParaApi = input.lojaId
    if (!Number.isInteger(lojaIdParaApi) || lojaIdParaApi < 1) {
      const cached = this.configDAO.get('loja_id')
      lojaIdParaApi = cached ? Number(cached) : 0  // 0 = sinaliza "terminal novo"
    }

    // ── Comunicar com a Sede (com fallback offline) ──────────────
    let resposta: Awaited<ReturnType<typeof apiClient.loginPos>>
    try {
      resposta = await apiClient.loginPos(input.nif, input.pin, lojaIdParaApi)
    } catch (_erro) {
      // ── FALLBACK OFFLINE ─────────────────────────────────────────
      // A API não está acessível — tenta autenticar pelo cache local
      console.warn('[AutenticacaoFacade] API inacessível — tentando cache local...')
      const cached = this.cacheDAO.verificar(input.nif, input.pin)

      if (!cached) {
        return fail('Sem ligação à sede e sem credenciais em cache. Ligue-se à rede pelo menos uma vez.')
      }

      // Verifica restrição de terminal
      const lojaConfiguradaOffline = this.configDAO.get('loja_id')
      if (lojaConfiguradaOffline && Number(lojaConfiguradaOffline) !== cached.loja_base_id) {
        return fail(`Este terminal está registado para a loja #${lojaConfiguradaOffline}, mas o operador pertence à loja #${cached.loja_base_id}.`)
      }

      // Restaurar sessão a partir do cache
      const perfil = cached.perfil as Perfil
      if (!PERFIS_VALIDOS.has(perfil)) return fail('Perfil inválido no cache local.')

      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      this.configDAO.set('operador_id',     String(cached.operador_id))
      this.configDAO.set('operador_nome',   cached.nome)
      this.configDAO.set('operador_perfil', perfil)
      this.configDAO.set('loja_id',         String(cached.loja_base_id))
      this.configDAO.set('loja_nome',       cached.loja_base_nome)

      console.log(`[AutenticacaoFacade] Login OFFLINE OK — ${cached.nome}`)

      return ok({
        operador: {
          id:           cached.operador_id,
          nome:         cached.nome,
          nif:          input.nif,
          email:        null,
          perfil,
          lojaBaseId:   cached.loja_base_id,
          lojaBaseNome: cached.loja_base_nome
        },
        expiresAt
      })
    }

    // ── Regra de segurança: se o terminal JÁ estava ligado a uma
    // loja (config 'loja_id' existe), o operador tem de pertencer
    // a essa loja — impede usar um terminal da loja A para operações
    // da loja B. Em terminais novos, esta regra não se aplica.
    const lojaConfigurada = this.configDAO.get('loja_id')
    if (lojaConfigurada) {
      const lojaEsperada = Number(lojaConfigurada)
      if (resposta.utilizador.lojaBaseId !== lojaEsperada) {
        return fail(
          `Este terminal está registado para a loja #${lojaEsperada}, ` +
          `mas o operador pertence à loja #${resposta.utilizador.lojaBaseId}.`
        )
      }
    }

    // ── Perfil ───────────────────────────────────────────────────
    const util = resposta.utilizador as any
    const perfil = (util.perfil || util.role || 'Funcionario') as Perfil

    if (!PERFIS_VALIDOS.has(perfil)) {
      return fail(`Perfil desconhecido devolvido pelo backend: ${perfil}`)
    }

    // ── Persistir sessão — incluindo loja_id do backend ──────────
    // Guardar no cache local para autenticação offline futura
    this.cacheDAO.guardar(input.nif, input.pin, {
      operador_id:    resposta.utilizador.id,
      nome:           resposta.utilizador.nome,
      perfil:         (resposta.utilizador as any).perfil || 'Funcionario',
      loja_base_id:   resposta.utilizador.lojaBaseId,
      loja_base_nome: resposta.utilizador.lojaBaseNome
    })

    this.configDAO.set('jwt_token',       resposta.token)
    this.configDAO.set('jwt_expires_at',  resposta.expiresAt)
    this.configDAO.set('operador_id',     String(resposta.utilizador.id))
    this.configDAO.set('operador_nome',   resposta.utilizador.nome)
    this.configDAO.set('operador_perfil', perfil)
    this.configDAO.set('loja_id',         String(resposta.utilizador.lojaBaseId))
    this.configDAO.set('loja_nome',       resposta.utilizador.lojaBaseNome)

    const operador: OperadorSessao = {
      id:           resposta.utilizador.id,
      nome:         resposta.utilizador.nome,
      nif:          resposta.utilizador.nif,
      email:        resposta.utilizador.email,
      perfil,
      lojaBaseId:   resposta.utilizador.lojaBaseId,
      lojaBaseNome: resposta.utilizador.lojaBaseNome
    }

    console.log(
      `[AutenticacaoFacade] Login OK — ${operador.nome} ` +
      `(loja ${operador.lojaBaseId}: ${operador.lojaBaseNome})`
    )

    return ok({ operador, expiresAt: resposta.expiresAt })
  }

  // ─────────────────────────────────────────────────────────────────
  public logout(): Result<void> {
    try {
      // Remover credenciais de sessão.
      // IMPORTANTE: loja_id e loja_nome ficam — pertencem ao TERMINAL,
      // não à sessão. Isto protege contra operador da loja X tentar
      // usar este terminal que já foi inicializado para loja Y.
      this.configDAO.delete('jwt_token')
      this.configDAO.delete('jwt_expires_at')
      this.configDAO.delete('operador_id')
      this.configDAO.delete('operador_nome')
      this.configDAO.delete('operador_perfil')
      return ok(undefined)
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  public obterSessaoAtual(): Result<OperadorSessao | null> {
    try {
      const token     = this.configDAO.get('jwt_token')
      const expiresAt = this.configDAO.get('jwt_expires_at')

      if (!token || !expiresAt) return ok(null)

      if (new Date(expiresAt) <= new Date()) {
        this.configDAO.delete('jwt_token')
        this.configDAO.delete('jwt_expires_at')
        return ok(null)
      }

      const id       = this.configDAO.get('operador_id')
      const nome     = this.configDAO.get('operador_nome')
      const perfil   = this.configDAO.get('operador_perfil')
      const lojaId   = this.configDAO.get('loja_id')
      const lojaNome = this.configDAO.get('loja_nome')

      if (!id || !nome || !perfil || !lojaId || !lojaNome) return ok(null)
      if (!PERFIS_VALIDOS.has(perfil)) return ok(null)

      return ok({
        id:           Number(id),
        nome,
        nif:          '',
        email:        null,
        perfil:       perfil as Perfil,
        lojaBaseId:   Number(lojaId),
        lojaBaseNome: lojaNome
      })
    } catch (erro) {
      return fail((erro as Error).message)
    }
  }
}