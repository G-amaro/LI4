/**
 * UtilizadoresPage (UC11) — Gestão de Utilizadores + Kill Switch.
 *
 * Funcionalidades:
 *   - Lista todos os utilizadores numa tabela
 *   - Botão "Novo Utilizador" que abre modal
 *   - Kill Switch por linha: botão "Desactivar" / "Activar"
 *   - PIN escondido por defeito (****) com botão 👁 para revelar individualmente
 *
 * Regras:
 *   - export function (sem FC)
 *   - Tailwind puro
 *   - Estados loading/erro sem ecrãs brancos
 *   - Update optimista no toggle (UI responde imediato, rollback se falhar)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { UtilizadorService } from '../services/UtilizadorService'
import { NovoUtilizadorModal } from '../components/NovoUtilizadorModal'
import type { Utilizador } from '../types/utilizador'

export function UtilizadoresPage() {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro,    setErro]              = useState<string | null>(null)
  const [filtro,  setFiltro]            = useState('')
  const [modalAberto, setModalAberto]   = useState(false)
  const [pinsVisiveis, setPinsVisiveis] = useState<Set<number>>(new Set())
  const [idEmToggle,   setIdEmToggle]   = useState<number | null>(null)
  const [utilizadorParaRevogar, setUtilizadorParaRevogar] = useState<Utilizador | null>(null)
  const [textoConfirmacao, setTextoConfirmacao]           = useState('')
  const [toast,        setToast]        = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setErro(null)
    try {
      const lista = await UtilizadorService.listar()
      setUtilizadores(lista)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // ─── Filtro ──────────────────────────────────────────────────────

  const utilizadoresFiltrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return utilizadores
    return utilizadores.filter((u) =>
      u.nome.toLowerCase().includes(termo) ||
      u.nif.includes(termo) ||
      (u.email?.toLowerCase().includes(termo) ?? false) ||
      u.perfil.toLowerCase().includes(termo)
    )
  }, [utilizadores, filtro])

  // ─── Toggle individual do PIN visível ────────────────────────────

  const togglePinVisivel = (id: number): void => {
    setPinsVisiveis((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Kill Switch ─────────────────────────────────────────────────

  const handleToggleStatus = (utilizador: Utilizador): void => {
    if (utilizador.ativo) {
      // Desactivar → abre modal de confirmação
      setUtilizadorParaRevogar(utilizador)
      setTextoConfirmacao('')
    } else {
      // Activar → acção directa (sem modal)
      void executarToggle(utilizador)
    }
  }

  const executarToggle = async (utilizador: Utilizador): Promise<void> => {
    if (idEmToggle !== null) return
    setIdEmToggle(utilizador.id)
    setUtilizadorParaRevogar(null)

    const estadoAnterior = utilizador.ativo
    setUtilizadores((prev) =>
      prev.map((u) => u.id === utilizador.id ? { ...u, ativo: !estadoAnterior } : u)
    )

    try {
      const actualizado = await UtilizadorService.toggleStatus(utilizador.id)
      setUtilizadores((prev) =>
        prev.map((u) => u.id === utilizador.id ? actualizado : u)
      )
      setToast({
        tipo: 'ok',
        msg: `${utilizador.nome} ${actualizado.ativo ? 'activado' : 'desactivado'} com sucesso.`
      })
    } catch (e) {
      setUtilizadores((prev) =>
        prev.map((u) => u.id === utilizador.id ? { ...u, ativo: estadoAnterior } : u)
      )
      setToast({ tipo: 'erro', msg: (e as Error).message })
    } finally {
      setIdEmToggle(null)
    }
  }

  // ─── Callback após criação ───────────────────────────────────────

  const handleUtilizadorCriado = (novo: Utilizador): void => {
    setUtilizadores((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)))
    setToast({ tipo: 'ok', msg: `"${novo.nome}" criado com sucesso.` })
  }

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="p-8 space-y-6">

      {/* ─── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Utilizadores</h1>
          <p className="text-sm text-slate-500 mt-1">
            {utilizadores.length} {utilizadores.length === 1 ? 'utilizador' : 'utilizadores'} registado(s) · {utilizadores.filter((u) => u.ativo).length} activo(s)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          Novo Utilizador
        </button>
      </div>

      {/* ─── Filtro ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Pesquisar por nome, NIF, email ou perfil..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* ─── Estados ────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar utilizadores...</div>
        </div>
      )}

      {erro && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold mb-2">Erro ao carregar utilizadores</div>
          <div className="text-sm text-red-700 mb-4">{erro}</div>
          <button
            type="button"
            onClick={carregar}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ─── Tabela ─────────────────────────────────────────────── */}
      {!loading && !erro && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {utilizadoresFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-sm font-medium text-slate-900">
                {utilizadores.length === 0
                  ? 'Nenhum utilizador registado'
                  : 'Nenhum utilizador corresponde ao filtro'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {utilizadores.length === 0
                  ? 'Clique em "Novo Utilizador" para começar.'
                  : 'Tente um termo diferente.'}
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Nome</Th>
                  <Th>NIF</Th>
                  <Th>Perfil</Th>
                  <Th>Loja Base</Th>
                  <Th>PIN</Th>
                  <Th className="text-center">Estado</Th>
                  <Th className="text-center">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {utilizadoresFiltrados.map((u) => {
                  const pinVisivel = pinsVisiveis.has(u.id)
                  const emToggle   = idEmToggle === u.id
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition ${!u.ativo ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{u.nome}</div>
                        {u.email && (
                          <div className="text-xs text-slate-500">{u.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{u.nif}</td>
                      <td className="px-4 py-3 text-xs">
                        <PerfilBadge perfil={u.perfil} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{u.lojaBaseNome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono tracking-widest text-slate-700">
                            {pinVisivel ? u.pin : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePinVisivel(u.id)}
                            className="text-xs text-slate-400 hover:text-slate-700"
                            title={pinVisivel ? 'Esconder PIN' : 'Mostrar PIN'}
                          >
                            {pinVisivel ? '🙈' : '👁'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <EstadoBadge ativo={u.ativo} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          disabled={emToggle}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                            u.ativo
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          {emToggle
                            ? 'A actualizar...'
                            : u.ativo
                              ? 'Desactivar'
                              : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {utilizadoresFiltrados.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
              A mostrar {utilizadoresFiltrados.length} de {utilizadores.length} utilizador(es)
            </div>
          )}
        </div>
      )}

      {/* ─── Modal ──────────────────────────────────────────────── */}
      <NovoUtilizadorModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onCriado={handleUtilizadorCriado}
      />

      {/* ─── Modal Revogar Acesso ─────────────────────────────── */}
      {utilizadorParaRevogar && (
        <ModalRevogarAcesso
          utilizador={utilizadorParaRevogar}
          textoConfirmacao={textoConfirmacao}
          onTextoChange={setTextoConfirmacao}
          onConfirmar={() => executarToggle(utilizadorParaRevogar)}
          onCancelar={() => { setUtilizadorParaRevogar(null); setTextoConfirmacao('') }}
        />
      )}

      {/* ─── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-lg text-sm z-50 max-w-sm ${
          toast.tipo === 'ok' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ SUBCOMPONENTES ═══════════════════════

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3 ${className}`}>
      {children}
    </th>
  )
}

function EstadoBadge({ ativo }: { ativo: boolean }) {
  if (ativo) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        Activo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
      Inactivo
    </span>
  )
}

function PerfilBadge({ perfil }: { perfil: string }) {
  const cores: Record<string, string> = {
    'Administrador': 'bg-purple-100 text-purple-800',
    'GerenteSede':   'bg-blue-100 text-blue-800',
    'GerenteLoja':   'bg-indigo-100 text-indigo-800',
    'Funcionario':   'bg-slate-100 text-slate-700'
  }
  const labels: Record<string, string> = {
    'Administrador': 'Administrador',
    'GerenteSede':   'Gerente Sede',
    'GerenteLoja':   'Gerente Loja',
    'Funcionario':   'Funcionário'
  }
  const classe = cores[perfil] ?? 'bg-slate-100 text-slate-700'
  const label  = labels[perfil] ?? perfil
  return (
    <span className={`inline-block ${classe} text-xs font-medium px-2 py-0.5 rounded`}>
      {label}
    </span>
  )
}

// ─── Modal de confirmação de revogação ────────────────────────────
interface ModalRevogarAcessoProps {
  utilizador:        Utilizador
  textoConfirmacao:  string
  onTextoChange:     (v: string) => void
  onConfirmar:       () => void
  onCancelar:        () => void
}

function ModalRevogarAcesso({
  utilizador,
  textoConfirmacao,
  onTextoChange,
  onConfirmar,
  onCancelar
}: ModalRevogarAcessoProps) {
  const confirmado = textoConfirmacao.trim().toUpperCase() === 'REVOGAR'
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header âmbar de aviso */}
        <div className="bg-amber-600 text-white px-6 py-4 flex items-center gap-3">
          <span className="text-2xl">⚠</span>
          <span className="text-lg font-bold">Atenção</span>
        </div>
        <div className="p-6 space-y-4">
          {/* Descrição */}
          <p className="text-sm text-slate-700 leading-relaxed">
            Está prestes a revogar o acesso de{' '}
            <span className="font-semibold text-slate-900">{utilizador.nome}</span>{' '}
            a todos os terminais POS e Sede. Esta ação entra em vigor na próxima sincronização.
          </p>
          {/* Input de confirmação */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Digite a palavra <span className="text-red-600">REVOGAR</span> para confirmar:
            </label>
            <input
              type="text"
              value={textoConfirmacao}
              onChange={(e) => onTextoChange(e.target.value)}
              placeholder="REVOGAR"
              autoFocus
              className={`w-full px-4 py-3 text-base font-semibold tracking-widest border-2 rounded-xl focus:outline-none text-center uppercase ${
                confirmado
                  ? 'border-red-500 bg-red-50 text-red-900'
                  : 'border-slate-300 focus:border-amber-500'
              }`}
            />
          </div>
          {/* Botões */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onCancelar}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-3 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={!confirmado}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
            >
              🔒 Revogar Acesso
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
