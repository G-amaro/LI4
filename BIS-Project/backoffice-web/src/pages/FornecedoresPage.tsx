/**
 * FornecedoresPage — CRUD de Fornecedores no backoffice.
 * Fase 4.3.
 */

import { useEffect, useState } from 'react'
import {
  FornecedorService,
  type Fornecedor,
  type CriarFornecedorInput,
  type AtualizarFornecedorInput
} from '../services/FornecedorService'

export function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)
  const [pesquisa, setPesquisa]         = useState('')
  const [modalAberto, setModalAberto]   = useState<'criar' | Fornecedor | null>(null)
  const [aGravar, setAGravar]           = useState(false)

  const carregar = async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await FornecedorService.listar()
      setFornecedores(data)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const filtrados = fornecedores.filter((f) => {
    const t = pesquisa.toLowerCase()
    return (
      f.nome.toLowerCase().includes(t) ||
      (f.nif?.includes(t) ?? false) ||
      (f.email?.toLowerCase().includes(t) ?? false)
    )
  })

  const handleEliminarOuDesativar = async (f: Fornecedor) => {
    if (f.numRececoes > 0) {
      if (!confirm(`"${f.nome}" tem ${f.numRececoes} receção(ões). Deseja desactivá-lo em vez de eliminar?`)) return
      setAGravar(true)
      try {
        await FornecedorService.atualizar(f.id, {
        nome:        f.nome,
        nif:         f.nif        ?? undefined,
        telefone:    f.telefone   ?? undefined,
        email:       f.email      ?? undefined,
        morada:      f.morada     ?? undefined,
        observacoes: f.observacoes ?? undefined,
        ativo: false
        })
        await carregar()
      } catch (e) { setErro((e as Error).message) }
      finally { setAGravar(false) }
    } else {
      if (!confirm(`Eliminar "${f.nome}"? Esta acção é irreversível.`)) return
      setAGravar(true)
      try {
        await FornecedorService.eliminar(f.id)
        await carregar()
      } catch (e) { setErro((e as Error).message) }
      finally { setAGravar(false) }
    }
  }

  const handleReativar = async (f: Fornecedor) => {
    setAGravar(true)
    try {
      await FornecedorService.atualizar(f.id, {
      nome:        f.nome,
      nif:         f.nif        ?? undefined,
      telefone:    f.telefone   ?? undefined,
      email:       f.email      ?? undefined,
      morada:      f.morada     ?? undefined,
      observacoes: f.observacoes ?? undefined,
      ativo: true
    })

      await carregar()
    } catch (e) { setErro((e as Error).message) }
    finally { setAGravar(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-500 mt-1">
            {fornecedores.filter(f => f.ativo).length} activos · {fornecedores.filter(f => !f.ativo).length} inactivos
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalAberto('criar')}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm"
        >
          + Novo Fornecedor
        </button>
      </div>

      {/* Pesquisa */}
      <div className="relative max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          type="text"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar por nome, NIF ou email..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {erro}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">A carregar fornecedores...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">🏪</div>
          <div className="text-sm text-slate-500">
            {pesquisa ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor criado ainda.'}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Nome</th>
                <th className="text-left px-4 py-3 font-semibold">NIF</th>
                <th className="text-left px-4 py-3 font-semibold">Contacto</th>
                <th className="text-right px-4 py-3 font-semibold">Receções</th>
                <th className="text-right px-4 py-3 font-semibold">Total Gasto</th>
                <th className="text-center px-4 py-3 font-semibold">Estado</th>
                <th className="text-right px-4 py-3 font-semibold">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((f) => (
                <tr key={f.id} className={`hover:bg-slate-50 ${!f.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{f.nome}</div>
                    {f.morada && <div className="text-xs text-slate-500 truncate max-w-[200px]">{f.morada}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {f.nif ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{f.telefone ?? '—'}</div>
                    {f.email && <div className="text-xs text-slate-500">{f.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {f.numRececoes}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-800">
                    {f.totalGasto.toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                      f.ativo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {f.ativo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setModalAberto(f)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        Editar
                      </button>
                      {f.ativo ? (
                        <button
                          type="button"
                          disabled={aGravar}
                          onClick={() => handleEliminarOuDesativar(f)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline disabled:opacity-50"
                        >
                          {f.numRececoes > 0 ? 'Desactivar' : 'Eliminar'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={aGravar}
                          onClick={() => handleReativar(f)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium hover:underline disabled:opacity-50"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modalAberto !== null && (
        <ModalFornecedor
          fornecedor={modalAberto === 'criar' ? null : modalAberto}
          onGuardar={async (input) => {
            setAGravar(true)
            try {
              if (modalAberto === 'criar') {
                await FornecedorService.criar(input as CriarFornecedorInput)
              } else {
                await FornecedorService.atualizar(
                  (modalAberto as Fornecedor).id,
                  input as AtualizarFornecedorInput
                )
              }
              setModalAberto(null)
              await carregar()
            } catch (e) {
              setErro((e as Error).message)
            } finally {
              setAGravar(false)
            }
          }}
          aGravar={aGravar}
          onFechar={() => setModalAberto(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════ Modal ═══════════════════════

interface ModalFornecedorProps {
  fornecedor: Fornecedor | null
  onGuardar:  (input: CriarFornecedorInput | AtualizarFornecedorInput) => Promise<void>
  aGravar:    boolean
  onFechar:   () => void
}

function ModalFornecedor({ fornecedor, onGuardar, aGravar, onFechar }: ModalFornecedorProps) {
  const edicao = fornecedor !== null

  const [nome, setNome]               = useState(fornecedor?.nome ?? '')
  const [nif, setNif]                 = useState(fornecedor?.nif ?? '')
  const [telefone, setTelefone]       = useState(fornecedor?.telefone ?? '')
  const [email, setEmail]             = useState(fornecedor?.email ?? '')
  const [morada, setMorada]           = useState(fornecedor?.morada ?? '')
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes ?? '')
  const [ativo, setAtivo]             = useState(fornecedor?.ativo ?? true)

  const nifValido = !nif || /^\d{9}$/.test(nif)
  const emailValido = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const podeGuardar = nome.trim().length > 0 && nifValido && emailValido

  const handleSubmit = async () => {
    if (!podeGuardar) return
    const input = {
      nome:        nome.trim(),
      nif:         nif.trim() || undefined,
      telefone:    telefone.trim() || undefined,
      email:       email.trim() || undefined,
      morada:      morada.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      ...(edicao ? { ativo } : {})
    }
    await onGuardar(input)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-900 text-white px-6 py-4">
          <h2 className="text-lg font-semibold">
            {edicao ? `Editar — ${fornecedor!.nome}` : 'Novo Fornecedor'}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Distribuição Norte, Lda."
              maxLength={150}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* NIF + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                NIF
              </label>
              <input
                type="text"
                value={nif}
                onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="500111222"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none font-mono ${
                  nifValido ? 'border-slate-300 focus:border-blue-500' : 'border-red-400'
                }`}
              />
              {!nifValido && (
                <div className="text-xs text-red-600 mt-1">NIF deve ter 9 dígitos</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="253 211 211"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="geral@fornecedor.pt"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                emailValido ? 'border-slate-300 focus:border-blue-500' : 'border-red-400'
              }`}
            />
          </div>

          {/* Morada */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Morada
            </label>
            <input
              type="text"
              value={morada}
              onChange={(e) => setMorada(e.target.value)}
              placeholder="Rua das Indústrias 45, Braga"
              maxLength={255}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Notas internas..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Toggle Activo (só na edição) */}
          {edicao && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">Fornecedor activo</div>
                <div className="text-xs text-slate-500">Inactivos não aparecem no POS</div>
              </div>
              <button
                type="button"
                onClick={() => setAtivo(!ativo)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ativo ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  ativo ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          {/* Botões */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!podeGuardar || aGravar}
              className="bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg shadow-sm"
            >
              {aGravar ? 'A guardar...' : edicao ? 'Guardar alterações' : 'Criar fornecedor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
