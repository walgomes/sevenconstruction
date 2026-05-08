-- Rede B2B de Performance — copiada do projeto seven-empresas (consultTudo)
-- e adaptada pra sevenconstruction.*. VIDA INDEPENDENTE: alterar aqui nao
-- altera la, alterar la nao altera aqui. Tabelas proprias, dados proprios.
--
-- 4 tabelas:
--   b2b_perfis    — cadastro do que cada CNPJ vende + ICP declarado
--   b2b_matches   — historico de cruzamentos gerados (fit_score 0-100)
--   b2b_conversas — canal direto entre 2 CNPJs (1 conversa unica por par)
--   b2b_mensagens — mensagens dentro de cada conversa

SET search_path = sevenconstruction, public;

-- ===== Perfis declarados =====
CREATE TABLE IF NOT EXISTS b2b_perfis (
  id                            SERIAL PRIMARY KEY,
  cnpj                          VARCHAR(14) NOT NULL UNIQUE,
  cliente_id                    INTEGER,
  o_que_vende                   TEXT,
  diferencial                   TEXT,
  icp_cnaes                     TEXT[],
  icp_ufs                       TEXT[],
  icp_porte                     TEXT[],
  icp_faturamento_min           NUMERIC,
  icp_faturamento_max           NUMERIC,
  icp_descricao                 TEXT,
  capacidade_atendimentos_mes   INTEGER,
  ticket_medio_centavos         INTEGER,
  modalidade                    TEXT[],
  visivel                       BOOLEAN NOT NULL DEFAULT TRUE,
  aberto_para_conversas         BOOLEAN NOT NULL DEFAULT TRUE,
  procurando_clientes           BOOLEAN NOT NULL DEFAULT TRUE,
  procurando_fornecedores       BOOLEAN NOT NULL DEFAULT FALSE,
  procurando_parcerias          BOOLEAN NOT NULL DEFAULT FALSE,
  verificado                    BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_perfis_visivel ON b2b_perfis(visivel) WHERE visivel;
CREATE INDEX IF NOT EXISTS idx_b2b_perfis_procurando_forn ON b2b_perfis(cnpj) WHERE procurando_fornecedores;
CREATE INDEX IF NOT EXISTS idx_b2b_perfis_cliente ON b2b_perfis(cliente_id) WHERE cliente_id IS NOT NULL;

-- ===== Matches gerados =====
CREATE TABLE IF NOT EXISTS b2b_matches (
  id            SERIAL PRIMARY KEY,
  cnpj_origem   VARCHAR(14) NOT NULL,
  cnpj_alvo     VARCHAR(14) NOT NULL,
  fit_score     INTEGER NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
  fonte         TEXT NOT NULL DEFAULT 'icp',     -- 'icp' | 'lookalike' | 'manual'
  motivo        TEXT,
  status        TEXT NOT NULL DEFAULT 'novo',    -- novo | conversando | descartado
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT b2b_matches_unico UNIQUE (cnpj_origem, cnpj_alvo, fonte)
);

CREATE INDEX IF NOT EXISTS idx_b2b_matches_origem ON b2b_matches(cnpj_origem, fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_matches_alvo ON b2b_matches(cnpj_alvo);

-- ===== Conversas =====
CREATE TABLE IF NOT EXISTS b2b_conversas (
  id                  SERIAL PRIMARY KEY,
  match_id            INTEGER REFERENCES b2b_matches(id) ON DELETE SET NULL,
  cnpj_origem         VARCHAR(14) NOT NULL,
  cnpj_alvo           VARCHAR(14) NOT NULL,
  decisor_nome        TEXT,
  decisor_cargo       TEXT,
  decisor_email       TEXT,
  decisor_telefone    TEXT,
  status              TEXT NOT NULL DEFAULT 'aberta',  -- aberta|aceita|reuniao_agendada|fechada|recusada
  iniciada_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_mensagem_em  TIMESTAMPTZ,
  CONSTRAINT b2b_conversas_par_unico UNIQUE (cnpj_origem, cnpj_alvo)
);

CREATE INDEX IF NOT EXISTS idx_b2b_conv_origem ON b2b_conversas(cnpj_origem, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_conv_alvo ON b2b_conversas(cnpj_alvo, iniciada_em DESC);

-- ===== Mensagens =====
CREATE TABLE IF NOT EXISTS b2b_mensagens (
  id                  SERIAL PRIMARY KEY,
  conversa_id         INTEGER NOT NULL REFERENCES b2b_conversas(id) ON DELETE CASCADE,
  remetente_cnpj      VARCHAR(14),
  remetente_user_id   INTEGER,
  conteudo            TEXT NOT NULL,
  lida                BOOLEAN NOT NULL DEFAULT FALSE,
  criada_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_msg_conversa ON b2b_mensagens(conversa_id, criada_em ASC);
CREATE INDEX IF NOT EXISTS idx_b2b_msg_nao_lidas ON b2b_mensagens(conversa_id) WHERE NOT lida;

-- Trigger pra atualizado_em em b2b_perfis
CREATE OR REPLACE FUNCTION trg_b2b_perfis_atualizado_em() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2b_perfis_atualizado_em ON b2b_perfis;
CREATE TRIGGER b2b_perfis_atualizado_em
  BEFORE UPDATE ON b2b_perfis
  FOR EACH ROW EXECUTE FUNCTION trg_b2b_perfis_atualizado_em();

-- Trigger pra ultima_mensagem_em em b2b_conversas (auto quando insere msg)
CREATE OR REPLACE FUNCTION trg_b2b_conversas_ultima_msg() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sevenconstruction.b2b_conversas
     SET ultima_mensagem_em = NEW.criada_em
   WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2b_msg_atualiza_conversa ON b2b_mensagens;
CREATE TRIGGER b2b_msg_atualiza_conversa
  AFTER INSERT ON b2b_mensagens
  FOR EACH ROW EXECUTE FUNCTION trg_b2b_conversas_ultima_msg();
