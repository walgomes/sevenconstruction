-- =========================================================
-- SevenConstruction — Esqueleto FIDC / Credito no checkout
-- Cadastro de parceiros financeiros que vao receber leads de credito.
-- Modelo final: cada parceiro = 1 adapter no codigo (1+ semana de
-- integracao por parceiro). Esta tabela armazena o cadastro;
-- as integracoes reais vem como adapters em /lib/financeiro/adapters/.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.parceiros_financeiros (
  id              SERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL,
  -- 'fidc' | 'banco' | 'fintech' | 'factoring' | 'cooperativa' | 'cartao'
  cnpj            TEXT,
  site            TEXT,
  contato_nome    TEXT,
  contato_email   TEXT,
  contato_tel     TEXT,
  -- Modelo de operacao
  taxa_minima_aa  NUMERIC(6,3),
  -- taxa de juros minima ao ano (ex: 24.500 = 24,5% a.a.)
  taxa_maxima_aa  NUMERIC(6,3),
  prazo_min_dias  INT,
  prazo_max_dias  INT,
  ticket_min      NUMERIC(15,2),
  ticket_max      NUMERIC(15,2),
  comissao_loja_pct NUMERIC(5,2),
  -- % da operacao que volta pra loja como comissao
  -- Setup
  status          TEXT NOT NULL DEFAULT 'avaliacao',
  -- 'avaliacao' | 'contrato_pendente' | 'integrando' | 'ativo' | 'pausado'
  adapter_codigo  TEXT,
  -- chave do adapter no codigo (ex: 'banco_xpto_v1')
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quais parceiros cada loja escolhe usar (multi-tenant)
CREATE TABLE IF NOT EXISTS sevenconstruction.loja_parceiros (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  parceiro_id     INT NOT NULL REFERENCES sevenconstruction.parceiros_financeiros(id) ON DELETE CASCADE,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  prioridade      INT NOT NULL DEFAULT 100,
  -- ordem que aparece no checkout (menor = primeiro)
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, parceiro_id)
);
CREATE INDEX IF NOT EXISTS loja_parceiros_loja_idx
  ON sevenconstruction.loja_parceiros(loja_id) WHERE ativo;

-- Histórico de propostas geradas
CREATE TABLE IF NOT EXISTS sevenconstruction.proposta_credito (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  cliente_id      INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  parceiro_id     INT REFERENCES sevenconstruction.parceiros_financeiros(id) ON DELETE SET NULL,
  -- Snapshot
  valor_solicitado NUMERIC(15,2) NOT NULL,
  prazo_dias       INT,
  taxa_aa_ofertada NUMERIC(6,3),
  status           TEXT NOT NULL DEFAULT 'simulada',
  -- 'simulada' | 'enviada' | 'analise' | 'aprovada' | 'recusada' | 'cancelada' | 'efetivada'
  numero_proposta  TEXT,
  observacoes      TEXT,
  metadados        JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proposta_credito_loja_idx
  ON sevenconstruction.proposta_credito(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS proposta_credito_cliente_idx
  ON sevenconstruction.proposta_credito(cliente_id) WHERE cliente_id IS NOT NULL;
