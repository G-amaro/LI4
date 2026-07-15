/**
 * ProdutoImagem — Imagem do produto com prioridade em cascata:
 *   1º imagemUrl (definido no backoffice)
 *   2º ficheiro local (assets/produtos/{id}.jpg)
 *   3º emoji da categoria (fallback final)
 */

import { useState } from 'react'

const imagensLocais = import.meta.glob(
  '../assets/produtos/*.{jpg,jpeg,png,webp}',
  { eager: true, import: 'default' }
) as Record<string, string>

function getImagemLocal(produtoId: number): string | null {
  for (const path in imagensLocais) {
    const filename = path.split('/').pop()?.replace(/\.\w+$/, '')
    if (filename === String(produtoId)) return imagensLocais[path]
  }
  return null
}

export function emojiCategoria(cat: string): string {
  const c = cat.toLowerCase()
  if (c.includes('bebida'))                                             return '🥤'
  if (c.includes('lact'))                                               return '🥛'
  if (c.includes('padaria') || c.includes('pão') || c.includes('pao')) return '🍞'
  if (c.includes('snack') || c.includes('doce') || c.includes('bolach')) return '🍪'
  if (c.includes('higiene') || c.includes('limpeza'))                   return '🧴'
  if (c.includes('fruta') || c.includes('legume'))                      return '🥦'
  if (c.includes('carne') || c.includes('peixe'))                       return '🥩'
  if (c.includes('congelado'))                                          return '🧊'
  return '🛒'
}

interface Props {
  produtoId:  number
  categoria:  string
  imagemUrl?: string | null
  className?: string
  emojiSize?: string
}

export function ProdutoImagem({ produtoId, categoria, imagemUrl, className = '', emojiSize = 'text-4xl' }: Props) {
  const imagemLocal = getImagemLocal(produtoId)
  const [urlErro, setUrlErro]     = useState(false)
  const [localErro, setLocalErro] = useState(false)

  // Cascata: URL → local → emoji
  const usarUrl   = !!imagemUrl && !urlErro
  const usarLocal = !usarUrl && !!imagemLocal && !localErro

  if (!usarUrl && !usarLocal) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className={`${emojiSize} leading-none select-none`}>
          {emojiCategoria(categoria)}
        </span>
      </div>
    )
  }

  const src = usarUrl ? imagemUrl! : imagemLocal!

  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src={src}
        alt=""
        onError={() => usarUrl ? setUrlErro(true) : setLocalErro(true)}
        className="object-contain w-full h-full rounded"
      />
    </div>
  )
}
