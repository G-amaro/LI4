/**
 * CatalogoPage (UC06) — Gestão do Catálogo de Produtos.
 * Fix RF03: adicionada edição de produtos por linha
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CatalogoService } from '../services/CatalogoService'
import { NovoProdutoModal } from '../components/NovoProdutoModal'
import type { Produto } from '../types/catalogo'

export function CatalogoPage() {
  const [produtos, setProdutos]       = useState<Produto[]>([])
  const [loading, setLoading]         = useState(true)
  const [erro,    setErro]            = useState<string | null>(null)
  const [filtro,  setFiltro]          = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [produtoAEditar, setProdutoAEditar] = useState<Produto | undefined>(undefined)
  const [toast, setToast]             = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    setLoading(true); setErro(null)
    try { setProdutos(await CatalogoService.listar()) }
    catch (e) { setErro((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const produtosFiltrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter((p) =>
      p.artigo.toLowerCase().includes(termo) ||
      p.categoria.toLowerCase().includes(termo) ||
      p.ean.includes(termo)
    )
  }, [produtos, filtro])

  const ordenar = (lista: Produto[]) =>
    [...lista].sort((a, b) =>
      a.categoria !== b.categoria
        ? a.categoria.localeCompare(b.categoria)
        : a.artigo.localeCompare(b.artigo)
    )

  const handleProdutoCriado = (novo: Produto): void => {
    setProdutos((prev) => ordenar([...prev, novo]))
    setToast({ msg: `✓ "${novo.artigo}" criado com sucesso`, tipo: 'ok' })
  }

  const handleProdutoEditado = (editado: Produto): void => {
    setProdutos((prev) => ordenar(prev.map((p) => p.id === editado.id ? editado : p)))
    setToast({ msg: `✓ "${editado.artigo}" actualizado`, tipo: 'ok' })
  }

  const abrirEdicao = (produto: Produto): void => {
    setProdutoAEditar(produto)
    setModalAberto(true)
  }

  const fecharModal = (): void => {
    setModalAberto(false)
    setProdutoAEditar(undefined)
  }

  return (
    <div className="p-8 space-y-6">

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catálogo</h1>
          <p className="text-sm text-slate-500 mt-1">
            {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'} no catálogo central
          </p>
        </div>
        <button type="button" onClick={() => { setProdutoAEditar(undefined); setModalAberto(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
          <span className="text-lg leading-none">+</span>
          Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <input type="text" value={filtro} onChange={(e) => setFiltro(e.target.value)}
          placeholder="Pesquisar por nome, categoria ou EAN..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-500">A carregar produtos...</div>
        </div>
      )}

      {erro && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-red-800 font-semibold mb-2">Erro ao carregar catálogo</div>
          <div className="text-sm text-red-700 mb-4">{erro}</div>
          <button type="button" onClick={carregar}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg">
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !erro && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {produtosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm font-medium text-slate-900">
                {produtos.length === 0 ? 'Catálogo vazio' : 'Nenhum produto corresponde ao filtro'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {produtos.length === 0 ? 'Clique em "Novo Produto" para começar.' : 'Tente um termo diferente.'}
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">EAN</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">Artigo</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">Categoria</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">Custo</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">PVP</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">Margem</th>
                  <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 py-3">Perecível</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtosFiltrados.map((p) => {
                  const margem = p.pvp > 0 ? ((p.pvp - p.precoCusto) / p.pvp) * 100 : 0
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{p.ean}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.artigo}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{p.categoria}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{p.precoCusto.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right tabular-nums">{p.pvp.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums">
                        <span className={
                          margem >= 30 ? 'text-green-700 font-medium' :
                          margem >= 15 ? 'text-amber-700' : 'text-red-700'
                        }>{margem.toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.perecivel
                          ? <span className="inline-block w-2 h-2 bg-orange-500 rounded-full" title="Perecível" />
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => abrirEdicao(p)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition">
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {produtosFiltrados.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
              A mostrar {produtosFiltrados.length} de {produtos.length} produtos
            </div>
          )}
        </div>
      )}

      <NovoProdutoModal
        aberto={modalAberto}
        onFechar={fecharModal}
        onCriado={handleProdutoCriado}
        onEditado={handleProdutoEditado}
        produto={produtoAEditar}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-lg text-sm z-50 ${
          toast.tipo === 'ok' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
