/**
 * NovoUtilizadorModal — formulário de criação de utilizador.
 * Fix RF01: lojas carregadas dinamicamente da API (incluindo Gualtar)
 */

import { useEffect, useState } from 'react'
import { UtilizadorService } from '../services/UtilizadorService'
import { api } from '../services/api'
import type { Utilizador, CriarUtilizadorInput, PerfilUtilizador } from '../types/utilizador'

interface Props {
  aberto:   boolean
  onFechar: () => void
  onCriado: (novo: Utilizador) => void
}

interface LojaOpcao {
  id:   number
  nome: string
}

const PERFIS: { valor: PerfilUtilizador; label: string; descricao: string }[] = [
  { valor: 'Funcionario',   label: 'Funcionário',     descricao: 'Acesso ao POS — vendas' },
  { valor: 'GerenteLoja',   label: 'Gerente de Loja', descricao: 'POS + quebras + fecho de caixa' },
  { valor: 'GerenteSede',   label: 'Gerente de Sede', descricao: 'Backoffice — gestão geral' },
  { valor: 'Administrador', label: 'Administrador',   descricao: 'Acesso total ao sistema' }
]

export function NovoUtilizadorModal({ aberto, onFechar, onCriado }: Props) {
  const [lojas, setLojas] = useState<LojaOpcao[]>([])

  const [form, setForm] = useState<CriarUtilizadorInput>({
    nome: '', nif: '', email: '', perfil: 'Funcionario', pin: '', lojaBaseId: 0
  })
  const [submittendo, setSubmittendo] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Carregar lojas da API quando o modal abre
  useEffect(() => {
    if (!aberto) return
    api.get<LojaOpcao[]>('/api/lojas')
      .then((r) => {
        setLojas(r.data)
        if (r.data.length > 0) {
          setForm((prev) => ({ ...prev, lojaBaseId: prev.lojaBaseId || r.data[0].id }))
        }
      })
      .catch(() => {
        // Fallback estático se a API falhar
        const fallback = [
          { id: 1, nome: 'Sede'    },
          { id: 2, nome: 'Fraião'  },
          { id: 3, nome: 'Centro'  },
          { id: 4, nome: 'Gualtar' },
        ]
        setLojas(fallback)
        setForm((prev) => ({ ...prev, lojaBaseId: prev.lojaBaseId || 1 }))
      })
  }, [aberto])

  if (!aberto) return null

  const validar = (): string | null => {
    if (form.nome.trim().length < 2)      return 'O nome deve ter pelo menos 2 caracteres.'
    if (!/^\d{9}$/.test(form.nif))        return 'O NIF deve ter 9 dígitos.'
    if (form.email && !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) return 'Email inválido.'
    if (!/^\d{4}$/.test(form.pin))        return 'O PIN deve ter exactamente 4 dígitos.'
    if (form.lojaBaseId < 1)              return 'Seleccione uma loja base válida.'
    return null
  }

  const reset = (): void => {
    setForm({ nome: '', nif: '', email: '', perfil: 'Funcionario', pin: '', lojaBaseId: lojas[0]?.id ?? 1 })
    setErro(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErro(null)
    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setSubmittendo(true)
    try {
      const novo = await UtilizadorService.criar({
        ...form,
        nome:  form.nome.trim(),
        email: form.email?.trim() || null
      })
      onCriado(novo)
      reset()
      onFechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSubmittendo(false)
    }
  }

  const handleCancelar = (): void => { reset(); onFechar() }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Novo Utilizador</h2>
            <p className="text-xs text-slate-500 mt-0.5">Criará credenciais de acesso ao POS ou Backoffice</p>
          </div>
          <button type="button" onClick={handleCancelar}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: João Silva" maxLength={150}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIF <span className="text-red-500">*</span>
              </label>
              <input type="text" inputMode="numeric" value={form.nif}
                onChange={(e) => setForm({ ...form, nif: e.target.value.replace(/\D/g, '') })}
                placeholder="123456789" maxLength={9}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email <span className="text-xs text-slate-400">(opcional, necessário para backoffice)</span>
            </label>
            <input type="email" value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="joao@bragaconvenience.pt"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Perfil / Função <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERFIS.map((p) => (
                <button key={p.valor} type="button"
                  onClick={() => setForm({ ...form, perfil: p.valor })}
                  className={`text-left px-3 py-2 rounded-lg border-2 transition ${
                    form.perfil === p.valor
                      ? 'bg-blue-50 border-blue-500 text-blue-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.descricao}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                PIN do POS <span className="text-red-500">*</span>
              </label>
              <input type="text" inputMode="numeric" value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="0000" maxLength={4}
                className="w-full px-3 py-2 text-sm font-mono text-center tracking-widest border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <p className="text-xs text-slate-500 mt-1">4 dígitos</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Loja base <span className="text-red-500">*</span>
              </label>
              <select value={form.lojaBaseId}
                onChange={(e) => setForm({ ...form, lojaBaseId: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{erro}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={handleCancelar} disabled={submittendo}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submittendo}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition">
              {submittendo ? 'A criar...' : 'Criar Utilizador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
