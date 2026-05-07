-- Catalogo de SKUs por parceiro: diferencial #2 SC vs Pipefy generico.
-- Pipefy avalia "fornecedor" abstrato; SC sabe "este parceiro entrega
-- ESTE cimento CP-II 32 NBR 11578 em sacos de 50kg".
--
-- NCM 8 digitos (Nomenclatura Comum do Mercosul) — capitulos relevantes
-- pra construcao: 25 (cimento), 38 (aditivos), 39 (PVC), 44 (madeira),
-- 68/69 (ceramica), 70 (vidro), 72/73 (aco), 76 (aluminio), 84 (maquinas).

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS parceiros_skus (
  id                SERIAL PRIMARY KEY,
  parceiro_id       INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  ncm               VARCHAR(8),                 -- 8 digitos, sem mascara
  sku               TEXT,                       -- codigo interno do parceiro
  descricao         TEXT NOT NULL,              -- "Cimento CP-II-Z-32 saco 50kg"
  marca             TEXT,                       -- "Votorantim", "Vedacit"
  unidade           TEXT,                       -- "saco 50kg", "kg", "m3"
  norma_abnt        TEXT,                       -- "NBR 11578", "NBR 7480 CA-50"
  preco_referencia  NUMERIC(12,2),              -- referencia, nao tabela definitiva
  ativo             BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skus_parceiro ON parceiros_skus(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_skus_ncm ON parceiros_skus(ncm) WHERE ncm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skus_desc_lower ON parceiros_skus(LOWER(descricao));
CREATE INDEX IF NOT EXISTS idx_skus_marca_lower ON parceiros_skus(LOWER(marca)) WHERE marca IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_skus_atualizado_em() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skus_atualizado_em ON parceiros_skus;
CREATE TRIGGER skus_atualizado_em
  BEFORE UPDATE ON parceiros_skus
  FOR EACH ROW EXECUTE FUNCTION trg_skus_atualizado_em();

-- View: SKUs com nome do parceiro embutido (pra listagem cross-search)
CREATE OR REPLACE VIEW v_skus_com_parceiro AS
SELECT
  s.*,
  p.codigo       AS parceiro_codigo,
  p.nome_fantasia AS parceiro_nome,
  p.tipo         AS parceiro_tipo,
  p.uf           AS parceiro_uf,
  p.cidade       AS parceiro_cidade,
  p.fase_homolog AS parceiro_fase,
  p.trust_score  AS parceiro_trust
FROM parceiros_skus s
JOIN parceiros p ON p.id = s.parceiro_id
WHERE s.ativo AND p.ativo;
