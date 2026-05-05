-- =========================================================
-- SevenConstruction — Cache local de licitacoes
-- Resolve o timeout instavel do Supabase do SevenLicite (free tier).
-- Atualizado por write-through quando uma chamada bem-sucedida acontece,
-- e usado como fallback quando o Supabase timeoutar.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.licitacoes_cache (
  id_licitacao        TEXT PRIMARY KEY,
  numero_licitacao    TEXT,
  ano                 SMALLINT,
  modalidade          TEXT,
  situacao            TEXT,
  objeto              TEXT,
  data_abertura       DATE,
  data_resultado      DATE,
  valor_licitacao     NUMERIC(18,2),
  nome_orgao          TEXT,
  uf                  CHAR(2),
  municipio           TEXT,
  -- vencedor (snapshot)
  vencedor_cnpj       CHAR(14),
  vencedor_nome       TEXT,
  vencedor_valor      NUMERIC(18,2),
  -- contato enriquecido (RFB local)
  vencedor_telefone   TEXT,
  vencedor_email      TEXT,
  -- meta
  cached_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS licitacoes_cache_uf_idx
  ON sevenconstruction.licitacoes_cache(uf, data_abertura DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS licitacoes_cache_uf_objeto_idx
  ON sevenconstruction.licitacoes_cache USING gin (to_tsvector('portuguese', coalesce(objeto, '')));
CREATE INDEX IF NOT EXISTS licitacoes_cache_cached_em_idx
  ON sevenconstruction.licitacoes_cache(cached_em DESC);
