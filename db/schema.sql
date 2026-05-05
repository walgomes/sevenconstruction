-- =========================================================
-- SevenConstruction — schema F0 + F1
-- SaaS standalone para lojas de material de construcao.
-- Roda em Postgres proprio (sevenconstruction_db), schema nativo.
-- =========================================================

CREATE SCHEMA IF NOT EXISTS sevenconstruction;
SET search_path TO sevenconstruction, public;

-- =========================================================
-- F0 — TENANT: LOJAS
-- Cada loja eh um tenant. Toda query DEVE filtrar por loja_id.
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.lojas (
  id              SERIAL PRIMARY KEY,
  nome_fantasia   TEXT NOT NULL,
  razao_social    TEXT,
  cnpj            TEXT UNIQUE,
  email_contato   TEXT NOT NULL,
  telefone        TEXT,
  whatsapp        TEXT,
  cep             TEXT,
  endereco        TEXT,
  numero          TEXT,
  bairro          TEXT,
  cidade          TEXT,
  uf              CHAR(2),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  raio_atuacao_km INT NOT NULL DEFAULT 10,
  plano           TEXT NOT NULL DEFAULT 'starter',
  -- starter | pro | enterprise
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes     TEXT
);
CREATE INDEX IF NOT EXISTS lojas_cidade_uf_idx
  ON sevenconstruction.lojas(cidade, uf);
CREATE INDEX IF NOT EXISTS lojas_ativo_idx
  ON sevenconstruction.lojas(ativo) WHERE ativo;

-- =========================================================
-- F0 — USUARIOS DA LOJA (dono, gerente, vendedor)
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.loja_users (
  id            SERIAL PRIMARY KEY,
  loja_id       INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  senha_hash    TEXT NOT NULL,
  nome          TEXT NOT NULL,
  papel         TEXT NOT NULL DEFAULT 'vendedor',
  -- dono | gerente | vendedor
  telefone      TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_login  TIMESTAMPTZ,
  UNIQUE(loja_id, email)
);
CREATE INDEX IF NOT EXISTS loja_users_email_idx
  ON sevenconstruction.loja_users(email);

-- =========================================================
-- F0 — CLIENTES FINAIS DA LOJA (PJ ou PF)
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.loja_clientes (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  tipo_pessoa     CHAR(1) NOT NULL DEFAULT 'J',  -- J=PJ | F=PF
  cnpj            TEXT,
  cpf             TEXT,
  nome_razao      TEXT NOT NULL,
  nome_fantasia   TEXT,
  email           TEXT,
  telefone        TEXT,
  whatsapp        TEXT,
  cep             TEXT,
  endereco        TEXT,
  numero          TEXT,
  bairro          TEXT,
  cidade          TEXT,
  uf              CHAR(2),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  cnae_principal  TEXT,
  porte           TEXT,
  capital_social  NUMERIC(15,2),
  data_abertura   DATE,
  origem          TEXT NOT NULL DEFAULT 'manual',
  -- manual | prospec | importacao | wizard
  rating_interno  TEXT,
  -- verde | amarelo | vermelho | null
  rating_score    INT,
  -- 0..100
  observacoes     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  senha_hash      TEXT,
  ultimo_login    TIMESTAMPTZ,
  UNIQUE(loja_id, cnpj),
  UNIQUE(loja_id, cpf)
);
CREATE INDEX IF NOT EXISTS loja_clientes_loja_idx
  ON sevenconstruction.loja_clientes(loja_id);
CREATE INDEX IF NOT EXISTS loja_clientes_cidade_idx
  ON sevenconstruction.loja_clientes(loja_id, cidade);
CREATE INDEX IF NOT EXISTS loja_clientes_rating_idx
  ON sevenconstruction.loja_clientes(loja_id, rating_interno);
CREATE INDEX IF NOT EXISTS loja_clientes_email_idx
  ON sevenconstruction.loja_clientes(email) WHERE email IS NOT NULL;

-- =========================================================
-- F0 — LOG DE LOGIN
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.login_tentativas (
  id          BIGSERIAL PRIMARY KEY,
  ip          TEXT,
  email       TEXT,
  papel       TEXT,  -- 'super' | 'loja_user' | 'loja_cliente'
  loja_id     INT,
  sucesso     BOOLEAN NOT NULL,
  user_agent  TEXT,
  motivo      TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_tent_ip_idx
  ON sevenconstruction.login_tentativas(ip, criado_em DESC);
CREATE INDEX IF NOT EXISTS login_tent_email_idx
  ON sevenconstruction.login_tentativas(email, criado_em DESC);

-- =========================================================
-- F1 — LISTAS DE PROSPECCAO GEO
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.prospec_listas (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  nome            TEXT NOT NULL,
  cep_centro      TEXT,
  raio_km         INT NOT NULL DEFAULT 10,
  cidade          TEXT,
  uf              CHAR(2),
  cnaes_alvo      TEXT[],
  porte_min       TEXT,
  porte_max       TEXT,
  apenas_ativas   BOOLEAN NOT NULL DEFAULT TRUE,
  total_itens     INT NOT NULL DEFAULT 0,
  filtros_extra   JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS prospec_listas_loja_idx
  ON sevenconstruction.prospec_listas(loja_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS sevenconstruction.prospec_lista_itens (
  id            BIGSERIAL PRIMARY KEY,
  lista_id      INT NOT NULL REFERENCES sevenconstruction.prospec_listas(id) ON DELETE CASCADE,
  cnpj          TEXT NOT NULL,
  razao_social  TEXT,
  nome_fantasia TEXT,
  cnae          TEXT,
  porte         TEXT,
  cidade        TEXT,
  uf            CHAR(2),
  bairro        TEXT,
  capital_social NUMERIC(15,2),
  data_abertura DATE,
  telefone      TEXT,
  email         TEXT,
  distancia_km  NUMERIC(8,2),
  score         INT,
  cliente_id    INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lista_id, cnpj)
);
CREATE INDEX IF NOT EXISTS prospec_lista_itens_lista_idx
  ON sevenconstruction.prospec_lista_itens(lista_id);
CREATE INDEX IF NOT EXISTS prospec_lista_itens_cnpj_idx
  ON sevenconstruction.prospec_lista_itens(cnpj);
CREATE INDEX IF NOT EXISTS prospec_lista_itens_score_idx
  ON sevenconstruction.prospec_lista_itens(lista_id, score DESC NULLS LAST);

-- =========================================================
-- F1 — PRESETS DE CNAE POR LOJA
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.cnae_presets (
  id          SERIAL PRIMARY KEY,
  loja_id     INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cnaes       TEXT[] NOT NULL,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- VIEW: resumo por loja com contadores
-- =========================================================
CREATE OR REPLACE VIEW sevenconstruction.v_loja_resumo AS
SELECT
  l.id                                                       AS loja_id,
  l.nome_fantasia,
  l.cidade,
  l.uf,
  l.plano,
  l.ativo,
  COUNT(DISTINCT c.id) FILTER (WHERE c.ativo)                AS clientes_ativos,
  COUNT(DISTINCT c.id) FILTER (
    WHERE c.ativo AND c.rating_interno = 'verde'
  )                                                          AS clientes_verdes,
  COUNT(DISTINCT u.id) FILTER (WHERE u.ativo)                AS usuarios_ativos,
  COUNT(DISTINCT pl.id)                                      AS listas_prospec
FROM sevenconstruction.lojas l
LEFT JOIN sevenconstruction.loja_clientes  c  ON c.loja_id = l.id
LEFT JOIN sevenconstruction.loja_users     u  ON u.loja_id = l.id
LEFT JOIN sevenconstruction.prospec_listas pl ON pl.loja_id = l.id
GROUP BY l.id;
