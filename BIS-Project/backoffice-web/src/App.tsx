import { useState } from 'react'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { InventarioPage } from './pages/InventarioPage'
import { UtilizadoresPage } from './pages/UtilizadoresPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { TransferenciasPage } from './pages/TransferenciasPage'
import { LojasPage } from './pages/LojasPage'
import { LojaDetalhePage } from './pages/LojaDetalhePage'
import { FornecedoresPage } from './pages/FornecedoresPage'
import { ComprasPage } from './pages/ComprasPage'

type Pagina =
  | 'dashboard'
  | 'lojas'
  | 'loja-detalhe'
  | 'catalogo'
  | 'utilizadores'
  | 'inventario'
  | 'relatorios'
  | 'transferencias'
  | 'fornecedores'
  | 'compras'

function App() {
  const [pagina, setPagina]                       = useState<Pagina>('dashboard')
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState<number | null>(null)

  const handleSelecionarLoja = (id: number): void => {
    setLojaSelecionadaId(id)
    setPagina('loja-detalhe')
  }

  const handleVoltarParaLojas = (): void => {
    setLojaSelecionadaId(null)
    setPagina('lojas')
  }

  return (
    <AdminLayout
      paginaActiva={pagina === 'loja-detalhe' ? 'lojas' : pagina}
      onNavegar={setPagina}
    >
      {pagina === 'dashboard'      && <DashboardPage />}
      {pagina === 'catalogo'       && <CatalogoPage />}
      {pagina === 'inventario'     && <InventarioPage />}
      {pagina === 'utilizadores'   && <UtilizadoresPage />}
      {pagina === 'relatorios'     && <RelatoriosPage />}
      {pagina === 'transferencias' && <TransferenciasPage />}
      {pagina === 'fornecedores'   && <FornecedoresPage />}
      {pagina === 'compras'        && <ComprasPage />}

      {pagina === 'lojas' && (
        <LojasPage onSelecionarLoja={handleSelecionarLoja} />
      )}

      {pagina === 'loja-detalhe' && lojaSelecionadaId !== null && (
        <LojaDetalhePage
          lojaId={lojaSelecionadaId}
          onVoltar={handleVoltarParaLojas}
        />
      )}
    </AdminLayout>
  )
}

export default App
