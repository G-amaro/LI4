-- ═══════════════════════════════════════════════════════════════
--  Schema SQLite do Terminal POS — BIS BragaConvenience
--  Adaptado para MySQL Workbench (Reverse Engineering)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE config (
  chave  VARCHAR(100) PRIMARY KEY,
  valor  TEXT NOT NULL
);

CREATE TABLE catalogo_local (
  id            INT          PRIMARY KEY,
  ean           VARCHAR(13)  NOT NULL UNIQUE,
  artigo        VARCHAR(200) NOT NULL,
  categoria     VARCHAR(100) NOT NULL,
  preco_custo   DECIMAL(10,2) NOT NULL DEFAULT 0,
  pvp           DECIMAL(10,2) NOT NULL,
  perecivel     TINYINT(1)   NOT NULL DEFAULT 0,
  atualizado_em VARCHAR(50)  NOT NULL
);

CREATE TABLE fornecedores_locais (
  id            INT          PRIMARY KEY,
  nome          VARCHAR(150) NOT NULL,
  nif           VARCHAR(20),
  ativo         TINYINT(1)   NOT NULL DEFAULT 1,
  atualizado_em VARCHAR(50)  NOT NULL
);

CREATE TABLE stock_local (
  produto_id         INT           PRIMARY KEY,
  quantidade         DECIMAL(10,3) NOT NULL DEFAULT 0,
  minimo_configurado DECIMAL(10,3) NOT NULL DEFAULT 0,
  atualizado_em      VARCHAR(50)   NOT NULL,
  FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
);

-- ─── Vendas ───────────────────────────────────────────────────

CREATE TABLE vendas_locais (
  id                TEXT         PRIMARY KEY,
  loja_id           INT          NOT NULL,
  operador_id       INT          NOT NULL,
  data_transacao    VARCHAR(50)  NOT NULL,
  valor_total       DECIMAL(10,2) NOT NULL,
  metodo_pagamento  TINYINT      NOT NULL,
  nif_cliente       VARCHAR(9),
  sync_status       VARCHAR(10)  NOT NULL DEFAULT 'pending',
  sync_tentativas   INT          NOT NULL DEFAULT 0,
  sync_ultimo_erro  TEXT,
  criado_em         VARCHAR(50)  NOT NULL
);

CREATE TABLE linhas_venda_locais (
  id             INT           PRIMARY KEY AUTO_INCREMENT,
  venda_id       VARCHAR(36)   NOT NULL,
  produto_id     INT           NOT NULL,
  quantidade     DECIMAL(10,3) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (venda_id)   REFERENCES vendas_locais(id),
  FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
);

-- ─── Quebras ──────────────────────────────────────────────────

CREATE TABLE quebras_locais (
  id               VARCHAR(36)   PRIMARY KEY,
  loja_id          INT           NOT NULL,
  operador_id      INT           NOT NULL,
  produto_id       INT           NOT NULL,
  quantidade       INT           NOT NULL,
  valor_perdido    DECIMAL(10,2) NOT NULL,
  motivo           TINYINT       NOT NULL,
  data_registo     VARCHAR(50)   NOT NULL,
  sync_status      VARCHAR(10)   NOT NULL DEFAULT 'pending',
  sync_tentativas  INT           NOT NULL DEFAULT 0,
  sync_ultimo_erro TEXT,
  criado_em        VARCHAR(50)   NOT NULL,
  FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
);

-- ─── Fechos de Caixa ──────────────────────────────────────────

CREATE TABLE fechos_caixa_locais (
  id                  VARCHAR(36)    PRIMARY KEY,
  loja_id             INT            NOT NULL,
  operador_id         INT            NOT NULL,
  data_fecho          VARCHAR(50)    NOT NULL,
  teorico_numerario   DECIMAL(12,2)  NOT NULL DEFAULT 0,
  teorico_multibanco  DECIMAL(12,2)  NOT NULL DEFAULT 0,
  teorico_mbway       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  teorico_total       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  contado_numerario   DECIMAL(12,2)  NOT NULL DEFAULT 0,
  contado_multibanco  DECIMAL(12,2)  NOT NULL DEFAULT 0,
  contado_mbway       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  contado_total       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  discrepancia        DECIMAL(12,2)  NOT NULL DEFAULT 0,
  tem_discrepancia    TINYINT(1)     NOT NULL DEFAULT 0,
  justificacao        VARCHAR(1000),
  sync_status         VARCHAR(10)    NOT NULL DEFAULT 'pending',
  sync_tentativas     INT            NOT NULL DEFAULT 0,
  sync_ultimo_erro    TEXT,
  criado_em           VARCHAR(50)    NOT NULL
);

-- ─── Devoluções ───────────────────────────────────────────────

CREATE TABLE devolucoes_locais (
  id                VARCHAR(36)   PRIMARY KEY,
  venda_original_id VARCHAR(36)   NOT NULL,
  loja_id           INT           NOT NULL,
  operador_id       INT           NOT NULL,
  data_devolucao    VARCHAR(50)   NOT NULL,
  valor_reembolsado DECIMAL(10,2) NOT NULL,
  motivo            VARCHAR(500),
  sync_status       VARCHAR(10)   NOT NULL DEFAULT 'pending',
  sync_tentativas   INT           NOT NULL DEFAULT 0,
  sync_ultimo_erro  TEXT,
  criado_em         VARCHAR(50)   NOT NULL,
  FOREIGN KEY (venda_original_id) REFERENCES vendas_locais(id)
);

CREATE TABLE linhas_devolucao_locais (
  id             INT           PRIMARY KEY AUTO_INCREMENT,
  devolucao_id   VARCHAR(36)   NOT NULL,
  produto_id     INT           NOT NULL,
  quantidade     INT           NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (devolucao_id) REFERENCES devolucoes_locais(id),
  FOREIGN KEY (produto_id)   REFERENCES catalogo_local(id)
);

-- ─── Receções ─────────────────────────────────────────────────

CREATE TABLE rececoes_locais (
  id                   VARCHAR(36)   PRIMARY KEY,
  loja_id              INT           NOT NULL,
  operador_id          INT           NOT NULL,
  data_rececao         VARCHAR(50)   NOT NULL,
  documento_referencia VARCHAR(100),
  fornecedor_id        INT,
  numero_linhas        INT           NOT NULL DEFAULT 0,
  total_unidades       INT           NOT NULL DEFAULT 0,
  sync_status          VARCHAR(10)   NOT NULL DEFAULT 'pending',
  sync_tentativas      INT           NOT NULL DEFAULT 0,
  sync_ultimo_erro     TEXT,
  criado_em            VARCHAR(50)   NOT NULL,
  FOREIGN KEY (fornecedor_id) REFERENCES fornecedores_locais(id)
);

CREATE TABLE linhas_rececao_locais (
  id            INT           PRIMARY KEY AUTO_INCREMENT,
  rececao_id    VARCHAR(36)   NOT NULL,
  produto_id    INT           NOT NULL,
  quantidade    INT           NOT NULL,
  lote          VARCHAR(50),
  data_validade VARCHAR(20),
  preco_custo   DECIMAL(10,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (rececao_id) REFERENCES rececoes_locais(id),
  FOREIGN KEY (produto_id) REFERENCES catalogo_local(id)
);

-- ─── Transferências ───────────────────────────────────────────

CREATE TABLE transferencias_locais (
  id                     VARCHAR(36)  PRIMARY KEY,
  tipo_movimento         VARCHAR(10)  NOT NULL,
  loja_origem_id         INT          NOT NULL,
  loja_destino_id        INT          NOT NULL,
  operador_id            INT          NOT NULL,
  data_movimento         VARCHAR(50)  NOT NULL,
  transferencia_envio_id VARCHAR(36),
  documento_referencia   VARCHAR(100),
  observacoes            VARCHAR(500),
  numero_linhas          INT          NOT NULL DEFAULT 0,
  total_unidades         INT          NOT NULL DEFAULT 0,
  sync_status            VARCHAR(10)  NOT NULL DEFAULT 'pending',
  sync_tentativas        INT          NOT NULL DEFAULT 0,
  sync_ultimo_erro       TEXT,
  criado_em              VARCHAR(50)  NOT NULL,
  FOREIGN KEY (transferencia_envio_id) REFERENCES transferencias_locais(id)
);

CREATE TABLE linhas_transferencia_locais (
  id               INT         PRIMARY KEY AUTO_INCREMENT,
  transferencia_id VARCHAR(36) NOT NULL,
  produto_id       INT         NOT NULL,
  quantidade       INT         NOT NULL,
  FOREIGN KEY (transferencia_id) REFERENCES transferencias_locais(id),
  FOREIGN KEY (produto_id)       REFERENCES catalogo_local(id)
);