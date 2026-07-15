/**
 * Nomes dos canais IPC.
 * Convenção: "dominio:acao"
 */

export const IpcChannels = {
  // Config
  ConfigGet:    'config:get',
  ConfigSet:    'config:set',
  ConfigDelete: 'config:delete',
  ConfigGetAll: 'config:get-all',

  // Catalogo
  CatalogoListar:     'catalogo:listar',
  CatalogoPorEan:     'catalogo:por-ean',
  CatalogoPorId:      'catalogo:por-id',
  CatalogoPesquisar:  'catalogo:pesquisar',
  CatalogoUpsertMany: 'catalogo:upsert-many',
  CatalogoContar:     'catalogo:contar',
  CatalogoSync:       'catalogo:sync',

  // [+ Fase 4] Fornecedores
  FornecedoresListar: 'fornecedores:listar',
  FornecedoresPorId:  'fornecedores:por-id',
  FornecedoresContar: 'fornecedores:contar',
  FornecedoresSync:   'fornecedores:sync',

  // [+ Stock lookup para UI]
  StockPorProduto: 'stock:por-produto',
  StockBatch:      'stock:batch',

  // Auth
  AuthLoginPos:    'auth:login-pos',
  AuthLogout:      'auth:logout',
  AuthSessaoAtual: 'auth:sessao-atual',

  // Vendas
  VendasCriar:           'vendas:criar',
  VendasContarPorStatus: 'vendas:contar-status',
  VendasListarRecentes:  'vendas:listar-recentes',

  // Sync Worker
  SyncGetStatus:     'sync:get-status',
  SyncForcar:        'sync:forcar',
  SyncStatusChanged: 'sync:status-changed',

  // Quebras
  QuebrasRegistar: 'quebras:registar',

  // Fecho de Caixa
  FechoCalcularTeorico: 'fecho:calcular-teorico',
  FechoRegistar:        'fecho:registar',

  // Devoluções
  DevolucoesObterVenda: 'devolucoes:obter-venda',
  DevolucoesRegistar:   'devolucoes:registar',

  // Receções
  RececoesRegistar: 'rececoes:registar',

  // Transferências
  TransferenciasRegistarEnvio:        'transferencias:registar-envio',
  TransferenciasObterGuia:            'transferencias:obter-guia',
  TransferenciasRegistarRececao:      'transferencias:registar-rececao',
  TransferenciasListarLojas:          'transferencias:listar-lojas',
  TransferenciasSincronizarGuias:     'transferencias:sincronizar-guias',
  TransferenciasListarGuiasPendentes: 'transferencias:listar-guias-pendentes',
} as const
