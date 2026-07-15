/**
 * AdminLayout — Chrome aplicacional do Backoffice.
 *
 * Estrutura:
 *   ┌──────────┬──────────────────────────────────┐
 *   │          │  Header (breadcrumbs, user menu) │
 *   │ Sidebar  ├──────────────────────────────────┤
 *   │  (dark)  │                                  │
 *   │          │    Conteúdo da página            │
 *   │          │                                  │
 *   └──────────┴──────────────────────────────────┘
 */

import { type FC, type ReactNode } from 'react'

type PaginaActiva =
  | 'dashboard'
  | 'lojas'
  | 'catalogo'
  | 'utilizadores'
  | 'inventario'
  | 'relatorios'
  | 'transferencias'
  | 'fornecedores'   // [+ Fase 4]
  | 'compras'        // [+ Fase 4]

interface AdminLayoutProps {
  children:      ReactNode
  paginaActiva:  PaginaActiva
  onNavegar:     (pagina: PaginaActiva) => void
  tituloTopo?:   string
}

interface ItemMenu {
  id:    PaginaActiva
  label: string
  icone: string
}

const MENU: ItemMenu[] = [
  { id: 'dashboard',      label: 'Dashboard',      icone: '📊' },
  { id: 'lojas',          label: 'Lojas',          icone: '🏪' },
  { id: 'catalogo',       label: 'Catálogo',       icone: '📦' },
  { id: 'inventario',     label: 'Inventário',     icone: '📋' },
  { id: 'utilizadores',   label: 'Utilizadores',   icone: '👥' },
  { id: 'relatorios',     label: 'Relatórios',     icone: '📈' },
  { id: 'transferencias', label: 'Transferências', icone: '🔄' },
  { id: 'fornecedores',   label: 'Fornecedores',   icone: '🏭' },  // [+ Fase 4]
  { id: 'compras',        label: 'Compras',        icone: '🛒' },  // [+ Fase 4]
]

export const AdminLayout: FC<AdminLayoutProps> = ({
  children, paginaActiva, onNavegar, tituloTopo
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ═══════ SIDEBAR ═══════ */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">

        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
              <img
                 src="/src/assets/logo.png"
                 alt="BragaConvenience"
                 className="w-full h-full object-contain"
               />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">BragaConvenience</div>
              <div className="text-xs text-slate-400">Sede · Backoffice</div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavegar(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                paginaActiva === item.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{item.icone}</span>
              <span>{item.label}</span>
              {paginaActiva === item.id && (
                <span className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
              OF
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">Orlando Ferreira</div>
              <div className="text-xs text-slate-500 truncate">Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {tituloTopo ?? MENU.find((m) => m.id === paginaActiva)?.label}
            </h1>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('pt-PT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          <div className="text-xs text-slate-400">
            v1.0 · Fase 4
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
