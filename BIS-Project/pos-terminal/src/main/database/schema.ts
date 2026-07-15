/**
 * Schema da base de dados SQLite local do Terminal POS.
 *
 * Este schema é intencionalmente diferente do da Sede:
 *  - IDs das entidades transacionais (vendas, quebras) são UUIDs gerados localmente
 *  - Tabelas *_locais têm coluna sync_status para a fila de sincronização
 *  - catalogo_local, stock_local e fornecedores_locais são caches da Sede
 */

import type Database from 'better-sqlite3'

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    -- ═══════════════════════════════════════════════════════════════
    --  Config: metadados de sessão
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS config (
      chave  TEXT PRIMARY KEY,
      valor  TEXT NOT NULL
    );

    -- ═══════════════════════════════════════════════════════════════
    --  Catálogo local
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS catalogo_local (
      id            INTEGER PRIMARY KEY,
      ean           TEXT    NOT NULL UNIQUE,
      artigo        TEXT    NOT NULL,
      categoria     TEXT    NOT NULL,
      preco_custo   REAL    NOT NULL DEFAULT 0,
      pvp           REAL    NOT NULL,
      perecivel     INTEGER NOT NULL DEFAULT 0,
      taxa_iva      REAL    NOT NULL DEFAULT 23.00,
      imagem_url    TEXT,
      atualizado_em TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_catalogo_ean      ON catalogo_local(ean);
    CREATE INDEX IF NOT EXISTS idx_catalogo_artigo   ON catalogo_local(artigo);

    -- ═══════════════════════════════════════════════════════════════
    --  [Fase 4] Fornecedores locais — réplica da Sede (read-only)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS fornecedores_locais (
      id            INTEGER PRIMARY KEY,
      nome          TEXT    NOT NULL,
      nif           TEXT,
      ativo         INTEGER NOT NULL DEFAULT 1,
      atualizado_em TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fornecedores_nome  ON fornecedores_locais(nome);
    CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores_locais(ativo);

    -- ═══════════════════════════════════════════════════════════════
    --  Stock desta loja
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS stock_local (
      produto_id          INTEGER PRIMARY KEY,
      quantidade          REAL    NOT NULL DEFAULT 0,
      minimo_configurado  REAL    NOT NULL DEFAULT 0,
      atualizado_em       TEXT    NOT NULL,
      FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
    );

    -- ═══════════════════════════════════════════════════════════════
    --  Vendas locais (UC01)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS vendas_locais (
      id                  TEXT    PRIMARY KEY,
      loja_id             INTEGER NOT NULL,
      operador_id         INTEGER NOT NULL,
      data_transacao      TEXT    NOT NULL,
      valor_total         REAL    NOT NULL,
      metodo_pagamento    INTEGER NOT NULL,
      nif_cliente         TEXT,
      sync_status         TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
      sync_tentativas     INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro    TEXT,
      criado_em           TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vendas_sync_status ON vendas_locais(sync_status);
    CREATE INDEX IF NOT EXISTS idx_vendas_data        ON vendas_locais(data_transacao);

    CREATE TABLE IF NOT EXISTS linhas_venda_locais (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id        TEXT    NOT NULL,
      produto_id      INTEGER NOT NULL,
      quantidade      REAL    NOT NULL,
      preco_unitario  REAL    NOT NULL,
      subtotal        REAL    NOT NULL,
      FOREIGN KEY (venda_id)   REFERENCES vendas_locais(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
    );
    CREATE INDEX IF NOT EXISTS idx_linhas_venda_id ON linhas_venda_locais(venda_id);

    -- ═══════════════════════════════════════════════════════════════
    --  Quebras locais (UC08)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS quebras_locais (
      id               TEXT    PRIMARY KEY,
      loja_id          INTEGER NOT NULL,
      operador_id      INTEGER NOT NULL,
      produto_id       INTEGER NOT NULL,
      quantidade       INTEGER NOT NULL,
      valor_perdido    REAL    NOT NULL,
      motivo           INTEGER NOT NULL,
      data_registo     TEXT    NOT NULL,
      sync_status      TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
      sync_tentativas  INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro TEXT,
      criado_em        TEXT    NOT NULL,
      FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
    );
    CREATE INDEX IF NOT EXISTS idx_quebras_sync_status ON quebras_locais(sync_status);

    -- ═══════════════════════════════════════════════════════════════
    --  Fechos de Caixa (UC03)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS fechos_caixa_locais (
      id                       TEXT PRIMARY KEY,
      loja_id                  INTEGER NOT NULL,
      operador_id              INTEGER NOT NULL,
      data_fecho               TEXT    NOT NULL,
      teorico_numerario        REAL    NOT NULL DEFAULT 0,
      teorico_multibanco       REAL    NOT NULL DEFAULT 0,
      teorico_mbway            REAL    NOT NULL DEFAULT 0,
      teorico_total            REAL    NOT NULL DEFAULT 0,
      contado_numerario        REAL    NOT NULL DEFAULT 0,
      contado_multibanco       REAL    NOT NULL DEFAULT 0,
      contado_mbway            REAL    NOT NULL DEFAULT 0,
      contado_total            REAL    NOT NULL DEFAULT 0,
      discrepancia             REAL    NOT NULL DEFAULT 0,
      tem_discrepancia         INTEGER NOT NULL DEFAULT 0,
      justificacao             TEXT,
      sync_status              TEXT    NOT NULL DEFAULT 'pending'
                               CHECK (sync_status IN ('pending','syncing','synced','error')),
      sync_tentativas          INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro         TEXT,
      criado_em                TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fechos_data ON fechos_caixa_locais(data_fecho);

    -- ═══════════════════════════════════════════════════════════════
    --  Devoluções (UC02)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS devolucoes_locais (
      id                 TEXT PRIMARY KEY,
      venda_original_id  TEXT NOT NULL,
      loja_id            INTEGER NOT NULL,
      operador_id        INTEGER NOT NULL,
      data_devolucao     TEXT NOT NULL,
      valor_reembolsado  REAL NOT NULL,
      motivo             TEXT,
      sync_status        TEXT NOT NULL DEFAULT 'pending'
                         CHECK (sync_status IN ('pending','syncing','synced','error')),
      sync_tentativas    INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro   TEXT,
      criado_em          TEXT NOT NULL,
      FOREIGN KEY (venda_original_id) REFERENCES vendas_locais(id)
    );
    CREATE INDEX IF NOT EXISTS idx_devolucoes_venda ON devolucoes_locais(venda_original_id);
    CREATE INDEX IF NOT EXISTS idx_devolucoes_data  ON devolucoes_locais(data_devolucao);

    CREATE TABLE IF NOT EXISTS linhas_devolucao_locais (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      devolucao_id   TEXT NOT NULL,
      produto_id     INTEGER NOT NULL,
      quantidade     INTEGER NOT NULL,
      preco_unitario REAL NOT NULL,
      subtotal       REAL NOT NULL,
      FOREIGN KEY (devolucao_id) REFERENCES devolucoes_locais(id) ON DELETE CASCADE
    );

    -- ═══════════════════════════════════════════════════════════════
    --  Receções de Mercadoria (UC09)
    --  Fase 4: + fornecedor_id (cabeçalho), + preco_custo (linhas)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS rececoes_locais (
      id                     TEXT PRIMARY KEY,
      loja_id                INTEGER NOT NULL,
      operador_id            INTEGER NOT NULL,
      data_rececao           TEXT NOT NULL,
      documento_referencia   TEXT,
      fornecedor_id          INTEGER,
      numero_linhas          INTEGER NOT NULL DEFAULT 0,
      total_unidades         INTEGER NOT NULL DEFAULT 0,
      sync_status            TEXT NOT NULL DEFAULT 'pending'
                             CHECK (sync_status IN ('pending','syncing','synced','error')),
      sync_tentativas        INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro       TEXT,
      criado_em              TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rececoes_data       ON rececoes_locais(data_rececao);
    CREATE INDEX IF NOT EXISTS idx_rececoes_sync       ON rececoes_locais(sync_status);
    CREATE INDEX IF NOT EXISTS idx_rececoes_fornecedor ON rececoes_locais(fornecedor_id);

    CREATE TABLE IF NOT EXISTS linhas_rececao_locais (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      rececao_id     TEXT NOT NULL,
      produto_id     INTEGER NOT NULL,
      quantidade     INTEGER NOT NULL,
      lote           TEXT,
      data_validade  TEXT,
      preco_custo    REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (rececao_id) REFERENCES rececoes_locais(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
    );
    CREATE INDEX IF NOT EXISTS idx_linhas_rececao ON linhas_rececao_locais(rececao_id);

    -- ═══════════════════════════════════════════════════════════════
    --  Transferências entre Lojas (UC10)
    -- ═══════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS transferencias_locais (
      id                       TEXT PRIMARY KEY,
      tipo_movimento           TEXT NOT NULL
                               CHECK (tipo_movimento IN ('ENVIO','RECECAO')),
      loja_origem_id           INTEGER NOT NULL,
      loja_destino_id          INTEGER NOT NULL,
      operador_id              INTEGER NOT NULL,
      data_movimento           TEXT NOT NULL,
      transferencia_envio_id   TEXT,
      documento_referencia     TEXT,
      observacoes              TEXT,
      numero_linhas            INTEGER NOT NULL DEFAULT 0,
      total_unidades           INTEGER NOT NULL DEFAULT 0,
      sync_status              TEXT NOT NULL DEFAULT 'pending'
                               CHECK (sync_status IN ('pending','syncing','synced','error')),
      sync_tentativas          INTEGER NOT NULL DEFAULT 0,
      sync_ultimo_erro         TEXT,
      criado_em                TEXT NOT NULL,
      UNIQUE (tipo_movimento, transferencia_envio_id)
    );
    CREATE INDEX IF NOT EXISTS idx_transf_tipo  ON transferencias_locais(tipo_movimento);
    CREATE INDEX IF NOT EXISTS idx_transf_envio ON transferencias_locais(transferencia_envio_id);
    CREATE INDEX IF NOT EXISTS idx_transf_data  ON transferencias_locais(data_movimento);

    CREATE TABLE IF NOT EXISTS linhas_transferencia_locais (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transferencia_id TEXT NOT NULL,
      produto_id      INTEGER NOT NULL,
      quantidade      INTEGER NOT NULL,
      FOREIGN KEY (transferencia_id) REFERENCES transferencias_locais(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
    );
    CREATE INDEX IF NOT EXISTS idx_linhas_transf ON linhas_transferencia_locais(transferencia_id);
    
    CREATE TABLE IF NOT EXISTS operadores_cache (
    nif            TEXT PRIMARY KEY,
    pin_hash       TEXT NOT NULL,
    operador_id    INTEGER NOT NULL,
    nome           TEXT NOT NULL,
    perfil         TEXT NOT NULL,
    loja_base_id   INTEGER NOT NULL,
    loja_base_nome TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL
  );
  
    `)

  // ── Migrations incrementais (BDs antigas) ─────────────────────
  aplicarMigrationsIncrementais(db)

  // ── Índices que dependem de colunas migradas ─────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_linhas_rececao_validade
      ON linhas_rececao_locais(data_validade);
  `)
}

function aplicarMigrationsIncrementais(db: Database.Database): void {
  // Fase 2 (Lotes light)
  adicionarColunaSeNaoExistir(db, 'linhas_rececao_locais', 'lote',          'TEXT')
  adicionarColunaSeNaoExistir(db, 'linhas_rececao_locais', 'data_validade', 'TEXT')

  // Fase 4 (Fornecedores + Preço de custo)
  adicionarColunaSeNaoExistir(db, 'rececoes_locais',       'fornecedor_id', 'INTEGER')
  adicionarColunaSeNaoExistir(db, 'linhas_rececao_locais', 'preco_custo',   'REAL NOT NULL DEFAULT 0')
  // Fase 5 (IVA + Imagem URL)
  adicionarColunaSeNaoExistir(db, 'catalogo_local', 'taxa_iva',   'REAL NOT NULL DEFAULT 23.00')
  adicionarColunaSeNaoExistir(db, 'catalogo_local', 'imagem_url', 'TEXT')
}

function adicionarColunaSeNaoExistir(
  db: Database.Database,
  tabela: string,
  coluna: string,
  tipo: string
): void {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>
  const existe = colunas.some((c) => c.name === coluna)
  if (!existe) {
    db.prepare(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`).run()
    console.log(`[Schema/Migration] Adicionada coluna ${coluna} a ${tabela}`)
  }
}
