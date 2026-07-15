/**
 * Root do renderer — controla a navegação entre páginas via state local.
 */

import { useEffect, useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { VendaPage } from './pages/VendaPage'                        // ★ NOVO ★
import type { OperadorSessao } from '../../shared/types'
import { QuebrasPage } from './pages/QuebrasPage'
import { FechoCaixaPage } from './pages/FechoCaixaPage'
import { DevolucoesPage } from './pages/DevolucoesPage'
import { RececoesPage } from './pages/RececoesPage'
import { TransferenciasPage } from './pages/TransferenciasPage'


type Ecra = 'loading' | 'login' | 'dashboard' | 'venda' | 'quebras' | 'fecho' | 'devolucoes' |'rececoes' | 'transferencias' | 'sobre'

function App(){
  const [ecra,     setEcra]     = useState<Ecra>('loading')
  const [operador, setOperador] = useState<OperadorSessao | null>(null)

  useEffect(() => {
    const init = async (): Promise<void> => {
      const r = await window.api.auth.sessaoAtual()
      if (r.ok && r.data) {
        setOperador(r.data)
        setEcra('dashboard')
      } else {
        setEcra('login')
      }
    }
    init()
  }, [])

  const handleLoginSuccess = (op: OperadorSessao): void => {
    setOperador(op)
    setEcra('dashboard')
  }

  const handleLogout = async (): Promise<void> => {
    await window.api.auth.logout()
    setOperador(null)
    setEcra('login')
  }

  const handleNavigate = (destino: 'venda' | 'quebras' | 'fecho'| 'devolucoes' | 'rececoes' | 'transferencias' | 'sobre'): void => {
    setEcra(destino)
  }

  if (ecra === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        A verificar sessão...
      </div>
    )
  }

  if (ecra === 'login' || !operador) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  if (ecra === 'dashboard') {
    return (
      <DashboardPage
        operador={operador}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  // ★ NOVO ★  rota de venda
  if (ecra === 'venda') {
    return (
      <VendaPage
        operador={operador}
        onVoltar={() => setEcra('dashboard')}
      />
    )
  }

  if (ecra === 'quebras') {
  return (
    <QuebrasPage
      operador={operador}
      onVoltar={() => setEcra('dashboard')}
    />
  )
}
  if (ecra === 'fecho') {
  return (
    <FechoCaixaPage
      operador={operador}
      onVoltar={() => setEcra('dashboard')}
    />
  )
}
  if (ecra === 'devolucoes') {
  return (
    <DevolucoesPage
      operador={operador}
      onVoltar={() => setEcra('dashboard')}
    />
  )
}
  if (ecra === 'rececoes') {
    return (
     <RececoesPage
        operador={operador}
        onVoltar={() => setEcra('dashboard')}
     />
  )
}

if (ecra === 'transferencias') {
  return (
    <TransferenciasPage
      operador={operador}
      onVoltar={() => setEcra('dashboard')}
    />
  )
}

  // Placeholders restantes (quebras, fecho)
  else return (
    <PlaceholderEcra
      titulo={'Fecho de Caixa'}
      onVoltar={() => setEcra('dashboard')}
    />
  )
}

function PlaceholderEcra({ titulo, onVoltar }: { titulo: string; onVoltar: () => void }){
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <div className="text-sm text-slate-500 mb-2">Página em construção</div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-600 mt-2">
          Esta funcionalidade será implementada no próximo milestone.
        </p>
        <button
          type="button"
          onClick={onVoltar}
          className="mt-6 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm"
        >
          ← Voltar ao Dashboard
        </button>
      </div>
    </div>
  )
}

export default App
