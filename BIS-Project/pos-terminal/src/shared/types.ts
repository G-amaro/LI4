/**
 * Tipos partilhados entre main process e renderer process.
 * NÃO importa nada do Node nem do DOM — apenas tipos.
 */

// ─── Result pattern ──────────────────────────────────────────────────

export type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

export const ok   = <T>(data: T): Result<T>         => ({ ok: true, data })
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })

// ─── Config ─────────────────────────────────────────────────────────

export type ConfigKey =
  | 'loja_id'
  | 'loja_nome'
  | 'operador_id'
  | 'operador_nome'
  | 'operador_perfil'
  | 'jwt_token'
  | 'jwt_expires_at'
  | 'api_base_url'
  | 'ultimo_sync_catalogo'
  | 'ultimo_sync_vendas'
  | 'ultimo_sync_fornecedores'

// ─── Catálogo ────────────────────────────────────────────────────────

export interface ProdutoLocal {
  id:           number
  ean:          string
  artigo:       string
  categoria:    string
  precoCusto:   number
  pvp:          number
  perecivel:    boolean
  taxaIVA:      number
  imagemUrl?:   string | null
  atualizadoEm: string
}

export interface StockItem {
  produtoId:         number
  quantidade:        number
  minimoConfigurado: number
  atualizadoEm:      string
}

export interface ProdutoComStock extends ProdutoLocal {
  stock: number
}

export interface SyncCatalogoResultado {
  inseridos:   number
  atualizados: number
  total:       number
  timestamp:   string
}

// ─── [Fase 4] Fornecedores ───────────────────────────────────────────

export interface FornecedorLocal {
  id:           number
  nome:         string
  nif:          string | null
  ativo:        boolean
  atualizadoEm: string
}

export interface SyncFornecedoresResultado {
  inseridos:   number
  atualizados: number
  total:       number
  timestamp:   string
}

// ─── Auth ────────────────────────────────────────────────────────────

export type Perfil = 'Funcionario' | 'GerenteLoja' | 'GerenteSede' | 'Administrador'

export interface OperadorSessao {
  id:           number
  nome:         string
  nif:          string
  email:        string | null
  perfil:       Perfil
  lojaBaseId:   number
  lojaBaseNome: string
}

export interface LoginPosInput {
  nif:     string
  pin:     string
  lojaId:  number
}

export interface LoginSucesso {
  operador:   OperadorSessao
  expiresAt:  string
}

// ─── Vendas ──────────────────────────────────────────────────────────

export enum MetodoPagamento {
  Numerario  = 1,
  Multibanco = 2,
  MBWay      = 3
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error'

export interface LinhaVendaInput {
  produtoId:     number
  quantidade:    number
  precoUnitario: number
  subtotal:      number
}

export interface VendaInput {
  operadorId:      number
  metodoPagamento: MetodoPagamento
  nifCliente:      string | null
  linhas:          LinhaVendaInput[]
}

export interface VendaLocal {
  id:              string
  lojaId:          number
  operadorId:      number
  dataTransacao:   string
  valorTotal:      number
  metodoPagamento: MetodoPagamento
  nifCliente:      string | null
  syncStatus:      SyncStatus
  syncTentativas:  number
  syncUltimoErro:  string | null
  criadoEm:        string
}

export interface VendaCriadaResultado {
  id:            string
  valorTotal:    number
  numeroLinhas:  number
  dataTransacao: string
}

// ─── Transferências (UC10) ───────────────────────────────────────

export type TipoMovimentoTransferencia = 'ENVIO' | 'RECECAO'

export interface LinhaTransferenciaInput {
  produtoId:  number
  quantidade: number
}

export interface EnvioInput {
  operadorId:          number
  lojaDestinoId:       number
  documentoReferencia: string | null
  observacoes:         string | null
  linhas:              LinhaTransferenciaInput[]
}

export interface RececaoTransferenciaInput {
  operadorId:            number
  transferenciaEnvioId:  string
  observacoes:           string | null
  linhas:                LinhaTransferenciaInput[]
}

export interface LinhaTransferenciaDetalhe {
  produtoId:   number
  ean:         string
  artigo:      string
  categoria:   string
  quantidade:  number
  imagemUrl?:  string | null
}

export interface GuiaEnvio {
  id:                    string
  lojaOrigemId:          number
  lojaDestinoId:         number
  dataEnvio:             string
  documentoReferencia:   string | null
  observacoes:           string | null
  linhas:                LinhaTransferenciaDetalhe[]
  jaRecebida:            boolean
}

export interface TransferenciaResultado {
  id:             string
  numeroLinhas:   number
  totalUnidades:  number
  dataMovimento:  string
}

// ─── API exposta ao renderer ─────────────────────────────────────────

export interface BisApi {
  config: {
    get:    (chave: ConfigKey)                => Promise<Result<string | null>>
    set:    (chave: ConfigKey, valor: string) => Promise<Result<void>>
    delete: (chave: ConfigKey)                => Promise<Result<void>>
    getAll: ()                                => Promise<Result<Record<string, string>>>
  }
  catalogo: {
    listar:     ()                         => Promise<Result<ProdutoLocal[]>>
    porEan:     (ean: string)              => Promise<Result<ProdutoLocal | null>>
    porId:      (id: number)               => Promise<Result<ProdutoLocal | null>>
    pesquisar:  (termo: string)            => Promise<Result<ProdutoLocal[]>>
    upsertMany: (produtos: ProdutoLocal[]) => Promise<Result<{ inseridos: number; atualizados: number }>>
    contar:     ()                         => Promise<Result<number>>
    sync:       ()                         => Promise<Result<SyncCatalogoResultado>>
  }
  fornecedores: {
    listar:  ()           => Promise<Result<FornecedorLocal[]>>
    porId:   (id: number) => Promise<Result<FornecedorLocal | null>>
    contar:  ()           => Promise<Result<number>>
    sync:    ()           => Promise<Result<SyncFornecedoresResultado>>
  }
  // [+ Stock lookup para UI de Transferências]
  stock: {
    porProduto: (produtoId: number)    => Promise<Result<number>>
    batch:      (ids: number[])        => Promise<Result<Record<number, number>>>
  }
  auth: {
    loginPos:    (input: LoginPosInput) => Promise<Result<LoginSucesso>>
    logout:      ()                     => Promise<Result<void>>
    sessaoAtual: ()                     => Promise<Result<OperadorSessao | null>>
  }
  vendas: {
    criar:            (input: VendaInput)  => Promise<Result<VendaCriadaResultado>>
    contarPorStatus:  (status: SyncStatus) => Promise<Result<number>>
    listarRecentes:   (limite: number)     => Promise<Result<VendaLocal[]>>
  }
  quebras: {
    registar: (input: QuebraInput) => Promise<Result<QuebrasRegistadaResultado>>
  }
  sync: {
    getStatus:       ()                                             => Promise<Result<SyncWorkerStatus>>
    forcar:          ()                                             => Promise<Result<void>>
    onStatusChanged: (callback: (status: SyncWorkerStatus) => void) => void
  }
  fecho: {
    calcularTeorico: ()                  => Promise<Result<ValoresPorMetodo>>
    registar:        (input: FechoInput) => Promise<Result<ResultadoFecho>>
  }
  devolucoes: {
    obterVenda: (vendaId: string)       => Promise<Result<VendaOriginal | null>>
    registar:   (input: DevolucaoInput) => Promise<Result<DevolucaoResultado>>
  }
  rececoes: {
    registar: (input: RececaoInput) => Promise<Result<RececaoResultado>>
  }
  transferencias: {
    registarEnvio:        (input: EnvioInput)               => Promise<Result<TransferenciaResultado>>
    obterGuia:            (transferenciaId: string)         => Promise<Result<GuiaEnvio | null>>
    registarRececao:      (input: RececaoTransferenciaInput) => Promise<Result<TransferenciaResultado>>
    listarLojas:          ()                                 => Promise<Result<Array<{ id: number; nome: string }>>>
    sincronizarGuias:     ()                                 => Promise<Result<{ novas: number; total: number }>>
    listarGuiasPendentes: ()                                 => Promise<Result<Array<{
      id:                   string
      lojaOrigemId:         number
      dataMovimento:        string
      documentoReferencia:  string | null
      numeroLinhas:         number
      totalUnidades:        number
    }>>>
  }
}

// ─── Tipos auxiliares ────────────────────────────────────────────────

export interface LinhaVendaCompleta {
  produtoId:     number
  quantidade:    number
  precoUnitario: number
  subtotal:      number
}

export interface VendaCompleta {
  id:              string
  lojaId:          number
  operadorId:      number
  valorTotal:      number
  metodoPagamento: MetodoPagamento
  syncStatus:      'pending' | 'syncing' | 'synced' | 'error'
  criadoEm:        string
  nifCliente?:     string | null
  linhas:          LinhaVendaCompleta[]
}

export type WorkerEstado = 'idle' | 'syncing' | 'error' | 'offline' | 'paused'

export interface SyncWorkerStatus {
  estado:              WorkerEstado
  ultimaSincronizacao: string | null
  pendentes:           number
  sincronizadasTotal:  number
  proximoTickEm:       string | number | null
  ultimoErro?:         string | null
}

// ─── Quebras ─────────────────────────────────────────────────────────

export enum MotivoQuebra {
  ValidadeExpirada     = 1,
  DanoQuebraFisica     = 2,
  FurtoDesaparecimento = 3
}

export interface QuebraInput {
  operadorId: number
  produtoId:  number
  quantidade: number
  motivo:     MotivoQuebra
}

export interface QuebraLocal {
  id:           string
  lojaId:       number
  operadorId:   number
  produtoId:    number
  quantidade:   number
  valorPerdido: number
  motivo:       MotivoQuebra
  dataRegisto:  string
  syncStatus:   'pending' | 'syncing' | 'synced' | 'error'
  criadoEm:     string
}

export interface QuebrasRegistadaResultado {
  id:           string
  valorPerdido: number
  artigo:       string
}

export interface ValoresPorMetodo {
  numerario:  number
  multibanco: number
  mbway:      number
}

export interface FechoInput {
  operadorId:   number
  contado:      ValoresPorMetodo
  justificacao: string | null
}

export interface ResultadoFecho {
  id:              string
  teorico:         ValoresPorMetodo
  contado:         ValoresPorMetodo
  discrepancia:    number
  temDiscrepancia: boolean
  dataFecho:       string
}

export interface QuebraParaSync {
  id:           string
  lojaId:       number
  operadorId:   number
  produtoId:    number
  quantidade:   number
  valorPerdido: number
  motivo:       number
  dataRegisto:  string
}

export interface FechoParaSync {
  id:                string
  lojaId:            number
  operadorId:        number
  dataFecho:         string
  teoricoNumerario:  number
  teoricoMultibanco: number
  teoricoMbway:      number
  teoricoTotal:      number
  contadoNumerario:  number
  contadoMultibanco: number
  contadoMbway:      number
  contadoTotal:      number
  discrepancia:      number
  temDiscrepancia:   boolean
  justificacao:      string | null
}

// ─── Devoluções ──────────────────────────────────────────────────────

export interface LinhaVendaOriginal {
  produtoId:             number
  artigo:                string
  quantidadeOriginal:    number
  precoUnitario:         number
  subtotal:              number
  quantidadeJaDevolvida: number
}

export interface VendaOriginal {
  id:              string
  dataTransacao:   string
  valorTotal:      number
  metodoPagamento: MetodoPagamento
  nifCliente:      string | null
  linhas:          LinhaVendaOriginal[]
}

export interface LinhaDevolucaoInput {
  produtoId:     number
  quantidade:    number
  precoUnitario: number
}

export interface DevolucaoInput {
  vendaOriginalId: string
  operadorId:      number
  motivo:          string | null
  linhas:          LinhaDevolucaoInput[]
}

export interface DevolucaoResultado {
  id:               string
  valorReembolsado: number
  numeroLinhas:     number
  dataDevolucao:    string
}

// ─── Receções de Mercadoria (UC09) ───────────────────────────────────

export interface LinhaRececaoInput {
  produtoId:    number
  quantidade:   number
  lote:         string | null
  dataValidade: string | null
  precoCusto:   number
}

export interface RececaoInput {
  operadorId:          number
  documentoReferencia: string | null
  fornecedorId:        number
  linhas:              LinhaRececaoInput[]
}

export interface RececaoResultado {
  id:            string
  numeroLinhas:  number
  totalUnidades: number
  dataRececao:   string
}
