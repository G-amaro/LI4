/**
 * NovoProdutoModal — formulário de criação e edição de produto.
 *
 * Modo criação: aberto sem prop `produto`
 * Modo edição:  aberto com prop `produto` preenchida
 */

import { useEffect, useState } from 'react'
import { CatalogoService } from '../services/CatalogoService'
import type { Produto, CriarProdutoInput } from '../types/catalogo'

interface Props {
  aberto:       boolean
  onFechar:     () => void
  onCriado:     (produto: Produto) => void
  onEditado?:   (produto: Produto) => void
  produto?:     Produto   // se definido → modo edição
}

export function NovoProdutoModal({ aberto, onFechar, onCriado, onEditado, produto }: Props) {
  const modoEdicao = produto !== undefined

  const [form, setForm] = useState<CriarProdutoInput>({
    ean: '', artigo: '', categoria: '', precoCusto: 0, pvp: 0, perecivel: false, taxaIVA: 23, imagemUrl: ''
  })
  const [submittendo, setSubmittendo] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Quando abre em modo edição, preenche o form com os dados do produto
  useEffect(() => {
    if (aberto && produto) {
      setForm({
        ean:        produto.ean,
        artigo:     produto.artigo,
        categoria:  produto.categoria,
        precoCusto: produto.precoCusto,
        pvp:        produto.pvp,
        perecivel:  produto.perecivel,
        taxaIVA:    produto.taxaIVA ?? 23,
        imagemUrl:  produto.imagemUrl ?? ''
      })
      setErro(null)
    } else if (aberto && !produto) {
      reset()
    }
  }, [aberto, produto])

  if (!aberto) return null

  const validar = (): string | null => {
    if (!modoEdicao && !/^\d{13}$/.test(form.ean.trim())) return 'O EAN deve ter exactamente 13 dígitos.'
    if (form.artigo.trim().length < 2)    return 'O nome do artigo deve ter pelo menos 2 caracteres.'
    if (form.categoria.trim().length < 2) return 'A categoria deve ter pelo menos 2 caracteres.'
    if (form.precoCusto <= 0)             return 'O preço de custo deve ser superior a 0€.'
    if (form.pvp <= 0)                    return 'O PVP deve ser superior a 0€.'
    if (form.pvp < form.precoCusto)       return 'O PVP não pode ser inferior ao preço de custo.'
    return null
  }

  const reset = (): void => {
    setForm({ ean: '', artigo: '', categoria: '', precoCusto: 0, pvp: 0, perecivel: false, taxaIVA: 23, imagemUrl: '' })
    setErro(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErro(null)

    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setSubmittendo(true)
    try {
      if (modoEdicao && produto) {
        // Modo edição — PUT /api/catalogo/:id
        const editado = await CatalogoService.editar(produto.id, {
          ...form,
          ean:       produto.ean,  // EAN não editável
          artigo:    form.artigo.trim(),
          categoria: form.categoria.trim()
        })
        onEditado?.(editado)
      } else {
        // Modo criação — POST /api/catalogo
        const criado = await CatalogoService.criar({
          ...form,
          ean:       form.ean.trim(),
          artigo:    form.artigo.trim(),
          categoria: form.categoria.trim()
        })
        onCriado(criado)
      }
      onFechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSubmittendo(false)
    }
  }

  const handleCancelar = (): void => { reset(); onFechar() }

  const margem = form.pvp > 0 && form.precoCusto > 0
    ? ((form.pvp - form.precoCusto) / form.pvp) * 100
    : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {modoEdicao ? `Editar — ${produto!.artigo}` : 'Novo Produto'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {modoEdicao
                ? 'As alterações serão propagadas para os POS na próxima sincronização.'
                : 'Será propagado para os POS na próxima sincronização.'}
            </p>
          </div>
          <button type="button" onClick={handleCancelar}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* EAN — só editável em modo criação */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Código EAN {!modoEdicao && <span className="text-red-500">*</span>}
            </label>
            {modoEdicao ? (
              <div className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-500">
                {produto!.ean}
                <span className="ml-2 text-xs text-slate-400">(não editável)</span>
              </div>
            ) : (
              <>
                <input type="text" inputMode="numeric" value={form.ean}
                  onChange={(e) => setForm({ ...form, ean: e.target.value.replace(/\D/g, '') })}
                  placeholder="5601010010019" maxLength={13}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <p className="text-xs text-slate-500 mt-1">{form.ean.length}/13 dígitos</p>
              </>
            )}
          </div>

          {/* Artigo */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nome do Artigo <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.artigo}
              onChange={(e) => setForm({ ...form, artigo: e.target.value })}
              placeholder="Ex: Leite Mimosa Meio-Gordo 1L" maxLength={200}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Categoria <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Ex: Lacticínios, Bebidas, Mercearia" maxLength={100}
              list="categorias-sugeridas"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <datalist id="categorias-sugeridas">
              <option value="Lacticínios" /><option value="Bebidas" />
              <option value="Mercearia" /><option value="Congelados" />
              <option value="Higiene" /><option value="Limpeza" />
              <option value="Padaria" /><option value="Snacks" />
            </datalist>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Preço de Custo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="number" min="0.01" step="0.01" value={form.precoCusto || ''}
                  onChange={(e) => setForm({ ...form, precoCusto: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                PVP <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="number" min="0.01" step="0.01" value={form.pvp || ''}
                  onChange={(e) => setForm({ ...form, pvp: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
              </div>
            </div>
          </div>

          {/* Preview margem */}
          {form.pvp > 0 && form.precoCusto > 0 && (
            <div className={`rounded-lg p-3 text-sm ${
              margem >= 20 ? 'bg-green-50 border border-green-200 text-green-800' :
              margem >= 0  ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                             'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <strong>Margem bruta:</strong> {margem.toFixed(1)}%
              {margem < 0  && <span className="ml-2">⚠ PVP inferior ao custo</span>}
              {margem >= 0 && margem < 20 && <span className="ml-2">⚠ Margem reduzida</span>}
            </div>
          )}

          {/* Perecível */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.perecivel}
                onChange={(e) => setForm({ ...form, perecivel: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
              <div>
                <div className="text-sm font-medium text-slate-900">Produto perecível</div>
                <div className="text-xs text-slate-500">Tem prazo de validade — afecta a lógica de quebras</div>
              </div>
            </label>
          </div>

          {/* Taxa de IVA */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Taxa de IVA <span className="text-red-500">*</span>
            </label>
            <select value={form.taxaIVA}
              onChange={(e) => setForm({ ...form, taxaIVA: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value={23}>23% — Taxa normal (bebidas, snacks, higiene)</option>
              <option value={13}>13% — Taxa intermédia</option>
              <option value={6}>6% — Taxa reduzida (lacticínios, pão, essenciais)</option>
              <option value={0}>0% — Isento</option>
            </select>
          </div>

          {/* URL de imagem */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              URL de Imagem <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input type="url" value={form.imagemUrl ?? ''}
              onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })}
              placeholder="https://exemplo.com/imagem.jpg"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            {form.imagemUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={form.imagemUrl} alt="" className="w-10 h-10 object-contain rounded border border-slate-200"
                  onError={(e) => (e.currentTarget.style.display = 'none')} />
                <span className="text-xs text-slate-500">Pré-visualização</span>
              </div>
            )}
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
              {submittendo
                ? (modoEdicao ? 'A guardar...' : 'A criar...')
                : (modoEdicao ? 'Guardar Alterações' : 'Criar Produto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
