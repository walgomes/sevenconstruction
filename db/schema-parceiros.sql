-- Schema de Parceiros (fornecedores upstream).
-- ADMIN ONLY: visivel apenas pra role=super. Lojas e clientes nao acessam.
--
-- Sequence comeca em 150.000 (regra do user). Codigo eh externo, mostrado em
-- todas as listagens. id numerico interno fica separado.
--
-- Tipos:
--   fabrica     — fabricante (CNAE divisao 10-33, foco 16/22/23/25)
--   importador  — importacao (CNAE 4634-3 ou similar)
--   distribuidor— atacado (CNAE 46xx)
--   lojista     — varejo (CNAE 47xx)
--   outros      — servicos, transporte, etc

SET search_path = sevenconstruction, public;

CREATE SEQUENCE IF NOT EXISTS parceiros_codigo_seq
  START WITH 150000
  INCREMENT BY 1
  MINVALUE 150000
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS parceiros (
  id              SERIAL PRIMARY KEY,
  codigo          INTEGER NOT NULL UNIQUE
                    DEFAULT nextval('sevenconstruction.parceiros_codigo_seq'),
  tipo            TEXT NOT NULL
                    CHECK (tipo IN ('fabrica','importador','distribuidor','lojista','outros')),
  razao_social    TEXT,
  nome_fantasia   TEXT NOT NULL,
  cnpj            TEXT,                  -- 14 digitos sem mascara, opcional
  cnae_principal  TEXT,                  -- 7 digitos sem mascara
  uf              TEXT,                  -- 2 chars
  cidade          TEXT,
  endereco        TEXT,
  cep             TEXT,
  telefone        TEXT,
  whatsapp        TEXT,
  email           TEXT,
  site            TEXT,
  logo_url        TEXT,
  notas           TEXT,                  -- observacoes internas do admin
  origem          TEXT,                  -- de onde veio: "manual", "guiafornecedoresic", "rfb", etc
  origem_url      TEXT,                  -- URL especifica da fonte
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parceiros_cnpj_unico UNIQUE (cnpj)
);

CREATE INDEX IF NOT EXISTS idx_parceiros_tipo ON parceiros(tipo);
CREATE INDEX IF NOT EXISTS idx_parceiros_uf ON parceiros(uf);
CREATE INDEX IF NOT EXISTS idx_parceiros_nome_lower ON parceiros(LOWER(nome_fantasia));
CREATE INDEX IF NOT EXISTS idx_parceiros_cnae ON parceiros(cnae_principal);

-- Produtos/categorias trabalhados pelo parceiro. Plural N:N permite cruzar
-- e identificar parceiros com produtos iguais (regra do user).
CREATE TABLE IF NOT EXISTS parceiros_produtos (
  id          SERIAL PRIMARY KEY,
  parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  produto     TEXT NOT NULL,            -- normalizado lower+sem acento
  produto_raw TEXT NOT NULL,            -- como veio
  origem      TEXT,                     -- "manual" | "guiafornecedoresic" | etc
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pp_unico UNIQUE (parceiro_id, produto)
);

CREATE INDEX IF NOT EXISTS idx_pp_produto ON parceiros_produtos(produto);
CREATE INDEX IF NOT EXISTS idx_pp_parceiro ON parceiros_produtos(parceiro_id);

-- Log de fontes externas raspadas. Ajuda dedupe (nao reimportar mesma URL 2x)
-- e auditoria (de onde cada parceiro veio).
CREATE TABLE IF NOT EXISTS parceiros_fontes (
  id            SERIAL PRIMARY KEY,
  parceiro_id   INTEGER REFERENCES parceiros(id) ON DELETE SET NULL,
  fonte         TEXT NOT NULL,         -- "guiafornecedoresic"
  url           TEXT NOT NULL,
  payload_json  JSONB,                 -- snapshot do que foi extraido
  importado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pf_url_unica UNIQUE (fonte, url)
);

CREATE INDEX IF NOT EXISTS idx_pf_fonte ON parceiros_fontes(fonte);

-- View pra KPIs do header da pagina admin (1 query, cache do Postgres).
CREATE OR REPLACE VIEW v_parceiros_kpis AS
SELECT
  COUNT(*)                                                 AS total,
  COUNT(*) FILTER (WHERE tipo = 'fabrica')                 AS fabrica,
  COUNT(*) FILTER (WHERE tipo = 'importador')              AS importador,
  COUNT(*) FILTER (WHERE tipo = 'distribuidor')            AS distribuidor,
  COUNT(*) FILTER (WHERE tipo = 'lojista')                 AS lojista,
  COUNT(*) FILTER (WHERE tipo = 'outros')                  AS outros,
  COUNT(*) FILTER (WHERE ativo)                            AS ativos,
  COUNT(DISTINCT uf) FILTER (WHERE uf IS NOT NULL)         AS estados
FROM parceiros;

-- Trigger pra atualizar atualizado_em.
CREATE OR REPLACE FUNCTION trg_parceiros_atualizado_em() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parceiros_atualizado_em ON parceiros;
CREATE TRIGGER parceiros_atualizado_em
  BEFORE UPDATE ON parceiros
  FOR EACH ROW EXECUTE FUNCTION trg_parceiros_atualizado_em();
