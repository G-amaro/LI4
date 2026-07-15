export interface VendasDiarias {
  data:         string
  valor:        number
  numeroVendas: number
}

export interface VendasPorLojaEDia {
  lojaId:   number
  lojaNome: string
  data:     string
  valor:    number
}

export interface LojaResumo {
  id:           number
  nome:         string
  receita:      number
  numeroVendas: number
}

export interface TransferenciaResumo {
  id:              string
  lojaOrigemNome:  string
  lojaDestinoNome: string
  dataMovimento:   string
  documentoRef:    string | null
  totalUnidades:   number
  estado:          'Em Trânsito' | 'Concluída'
}

export interface DashboardResumo {
  totalVendasHoje:         number
  totalVendasOntem:        number
  percentVariacaoVendas:   number
  lojasOnline:             number
  lojasTotal:              number
  transferenciasPendentes: number
  totalQuebras:            number
  totalDiscrepancias:      number
  numeroLojas:             number
  numeroProdutos:          number
  numeroOperadores:        number
  vendasPorDia:            VendasDiarias[]
  vendasPorLojaEDia:       VendasPorLojaEDia[]
  topLojas:                LojaResumo[]
  ultimasTransferencias:   TransferenciaResumo[]
}
