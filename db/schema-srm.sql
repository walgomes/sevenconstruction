-- SRM (Supplier Relationship Management) — esteira de homologacao de parceiros.
-- Inspiracao: Pipefy SRM AI Studio. Aplicavel sobre tabela parceiros existente.
--
-- 5 fases obrigatorias (kanban):
--   solicitacao   — recem cadastrado, ainda nao analisado
--   pre_check     — Pre Check AI rodou (consulta CNPJ + duplicidade + risco inicial)
--   analises      — analises paralelas em curso (Legal/Compliance/Finance/Operacional)
--   consolidacao  — Trust Score AI gerou score 0-100
--   decisao       — Decision Assist AI recomendou; aguarda confirmacao humana
--   homologado    — aprovado e ativo
--   reprovado     — rejeitado (mantem registro pra historico/auditoria)
--
-- Trust score: 0-100 ponderado: compliance 40% + finance 20% + operacional 20% + legal 20%.

SET search_path = sevenconstruction, public;

-- ===== Super-admin =====
CREATE TABLE IF NOT EXISTS super_admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  nome          TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== SRM em cima de parceiros =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sevenconstruction'
      AND table_name = 'parceiros'
      AND column_name = 'fase_homolog'
  ) THEN
    ALTER TABLE sevenconstruction.parceiros
      ADD COLUMN fase_homolog TEXT NOT NULL DEFAULT 'solicitacao'
        CHECK (fase_homolog IN ('solicitacao','pre_check','analises','consolidacao','decisao','homologado','reprovado')),
      ADD COLUMN trust_score INTEGER CHECK (trust_score IS NULL OR (trust_score >= 0 AND trust_score <= 100)),
      ADD COLUMN risco_inicial TEXT CHECK (risco_inicial IS NULL OR risco_inicial IN ('baixo','medio','alto')),
      ADD COLUMN parecer_compliance JSONB,
      ADD COLUMN parecer_finance JSONB,
      ADD COLUMN parecer_operacional JSONB,
      ADD COLUMN parecer_legal JSONB,
      ADD COLUMN recomendacao_ia TEXT CHECK (recomendacao_ia IS NULL OR recomendacao_ia IN ('aprovar','revisar','reprovar')),
      ADD COLUMN recomendacao_motivo TEXT,
      ADD COLUMN homologado_por INTEGER,         -- super_admins.id
      ADD COLUMN homologado_em TIMESTAMPTZ,
      ADD COLUMN ultima_analise_em TIMESTAMPTZ;
    CREATE INDEX idx_parceiros_fase ON sevenconstruction.parceiros(fase_homolog);
    CREATE INDEX idx_parceiros_trust ON sevenconstruction.parceiros(trust_score) WHERE trust_score IS NOT NULL;
  END IF;
END $$;

-- ===== Log de transicoes (auditoria) =====
CREATE TABLE IF NOT EXISTS parceiros_log_decisoes (
  id            SERIAL PRIMARY KEY,
  parceiro_id   INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  fase_de       TEXT,
  fase_para     TEXT NOT NULL,
  ator_id       INTEGER,                        -- super_admins.id ou null se IA
  ator_tipo     TEXT NOT NULL CHECK (ator_tipo IN ('humano','ia','sistema')),
  ator_nome     TEXT,                           -- nome do super-admin OU "Pre Check AI" etc
  motivo        TEXT,
  trust_score   INTEGER,                        -- snapshot
  payload_json  JSONB,                          -- pareceres/dados no momento
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pld_parceiro ON parceiros_log_decisoes(parceiro_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pld_data ON parceiros_log_decisoes(criado_em DESC);

-- ===== Documentos do parceiro =====
CREATE TABLE IF NOT EXISTS parceiros_docs (
  id            SERIAL PRIMARY KEY,
  parceiro_id   INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  tipo_doc      TEXT NOT NULL,    -- 'contrato_social','iso','catalogo','foto_fachada','rg_socio','outro'
  nome          TEXT NOT NULL,
  url           TEXT NOT NULL,    -- URL externa OU futura URL Storage
  mime          TEXT,
  tamanho_bytes INTEGER,
  hash_sha256   TEXT,
  uploaded_by   INTEGER,          -- super_admins.id
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pd_parceiro ON parceiros_docs(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_pd_tipo ON parceiros_docs(tipo_doc);

-- ===== View pro dashboard SRM =====
CREATE OR REPLACE VIEW v_srm_dashboard AS
SELECT
  COUNT(*)                                                               AS total,
  COUNT(*) FILTER (WHERE fase_homolog = 'solicitacao')                   AS solicitacao,
  COUNT(*) FILTER (WHERE fase_homolog = 'pre_check')                     AS pre_check,
  COUNT(*) FILTER (WHERE fase_homolog = 'analises')                      AS analises,
  COUNT(*) FILTER (WHERE fase_homolog = 'consolidacao')                  AS consolidacao,
  COUNT(*) FILTER (WHERE fase_homolog = 'decisao')                       AS decisao,
  COUNT(*) FILTER (WHERE fase_homolog = 'homologado')                    AS homologado,
  COUNT(*) FILTER (WHERE fase_homolog = 'reprovado')                     AS reprovado,
  AVG(trust_score) FILTER (WHERE trust_score IS NOT NULL)::INTEGER       AS trust_medio,
  COUNT(*) FILTER (WHERE risco_inicial = 'alto')                         AS risco_alto,
  COUNT(*) FILTER (WHERE risco_inicial = 'medio')                        AS risco_medio,
  COUNT(*) FILTER (WHERE risco_inicial = 'baixo')                        AS risco_baixo,
  COUNT(*) FILTER (WHERE homologado_em > NOW() - INTERVAL '7 days')      AS homologados_7d,
  COUNT(*) FILTER (WHERE fase_homolog NOT IN ('homologado','reprovado')) AS em_andamento
FROM parceiros;

-- ===== Tempo medio por fase (cards p/ dashboard) =====
CREATE OR REPLACE VIEW v_srm_tempo_medio AS
WITH transicoes AS (
  SELECT
    parceiro_id,
    fase_para,
    criado_em,
    LAG(criado_em) OVER (PARTITION BY parceiro_id ORDER BY criado_em) AS chegou_anterior
  FROM parceiros_log_decisoes
)
SELECT
  fase_para AS fase,
  COUNT(*)  AS amostras,
  AVG(EXTRACT(EPOCH FROM (criado_em - chegou_anterior))/3600)::NUMERIC(10,2) AS horas_media
FROM transicoes
WHERE chegou_anterior IS NOT NULL
GROUP BY fase_para;
