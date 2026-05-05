-- =========================================================
-- SevenConstruction — Revendedor multi-nivel (MLM)
-- Cliente da loja pode virar revendedor → tem codigo proprio → indica
-- novos clientes/revendedores → ganha comissao em N niveis (default 3).
--
-- *** AVISO LEGAL ***
-- Lei 1.521/51: pirâmide é crime no Brasil. Pra ser MLM lícito:
--   1) PRODUTO REAL e tem valor por si só (✅ servicos digitais reais)
--   2) Remuneração vem MAJORITARIAMENTE da venda do produto, NÃO do recrutamento
--   3) SEM "fee de entrada" obrigatório
--   4) Comissões com cap (sem promessa de "renda passiva infinita")
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.revendedor (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  cliente_id      INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  -- Pode existir sem cliente_id se for revendedor "puro" sem ter sido cliente antes
  nome            TEXT NOT NULL,
  cpf             TEXT,
  cnpj            TEXT,
  email           TEXT,
  telefone        TEXT,
  whatsapp        TEXT,
  cidade          TEXT,
  uf              CHAR(2),
  -- Codigo unico
  codigo          TEXT NOT NULL,
  -- Hierarquia
  upline_id       INT REFERENCES sevenconstruction.revendedor(id) ON DELETE SET NULL,
  -- quem indicou este revendedor (NULL = topo da arvore = a propria loja)
  nivel           INT NOT NULL DEFAULT 1,
  -- 1 = direto (loja indicou), 2 = nivel 2 (revendedor de revendedor), etc.
  -- Comissoes
  pct_n1          NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  -- % de comissao quando ESTE revendedor traz cliente
  pct_n2          NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  -- % bonus quando alguem que ESTE revendedor cadastrou traz cliente
  pct_n3          NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  -- nivel 3 (raro)
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  termo_aceito_em TIMESTAMPTZ,
  -- LGPD: revendedor consentiu com termo de uso (obrigatorio antes de ativar)
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, codigo),
  UNIQUE(loja_id, cpf),
  UNIQUE(loja_id, cnpj)
);
CREATE INDEX IF NOT EXISTS revendedor_loja_idx
  ON sevenconstruction.revendedor(loja_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS revendedor_upline_idx
  ON sevenconstruction.revendedor(upline_id);
CREATE INDEX IF NOT EXISTS revendedor_codigo_idx
  ON sevenconstruction.revendedor(codigo);

-- Comissoes geradas (por venda + nivel da arvore)
CREATE TABLE IF NOT EXISTS sevenconstruction.revendedor_comissao (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  revendedor_id   INT NOT NULL REFERENCES sevenconstruction.revendedor(id) ON DELETE CASCADE,
  cliente_id      INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  origem_comissao_id BIGINT,
  -- referencia opcional ao comissao_evento que gerou esta cascata
  nivel           INT NOT NULL,
  -- 1, 2, 3
  valor_venda     NUMERIC(15,2) NOT NULL,
  pct_aplicado    NUMERIC(5,2) NOT NULL,
  comissao_valor  NUMERIC(15,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aprovada',
  -- 'aprovada' | 'pendente' | 'paga' | 'cancelada'
  pago_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS revendedor_comissao_loja_idx
  ON sevenconstruction.revendedor_comissao(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS revendedor_comissao_revendedor_idx
  ON sevenconstruction.revendedor_comissao(revendedor_id, criado_em DESC);

-- View: hierarquia + totais
CREATE OR REPLACE VIEW sevenconstruction.v_revendedor_arvore AS
WITH RECURSIVE arvore AS (
  -- Nivel 1: revendedores que tem upline NULL (direto da loja)
  SELECT id, loja_id, nome, codigo, upline_id, nivel, ativo, 1 AS profundidade,
         ARRAY[id] AS path
    FROM sevenconstruction.revendedor
   WHERE upline_id IS NULL
  UNION ALL
  SELECT r.id, r.loja_id, r.nome, r.codigo, r.upline_id, r.nivel, r.ativo,
         a.profundidade + 1, a.path || r.id
    FROM sevenconstruction.revendedor r
    JOIN arvore a ON r.upline_id = a.id
   WHERE NOT (r.id = ANY(a.path))  -- evita ciclo
)
SELECT a.*,
       (SELECT COUNT(*)::int FROM sevenconstruction.revendedor d WHERE d.upline_id = a.id) AS downlines_diretos,
       (SELECT COALESCE(SUM(comissao_valor), 0)
          FROM sevenconstruction.revendedor_comissao c
         WHERE c.revendedor_id = a.id AND c.status IN ('aprovada','paga'))                 AS total_comissao,
       (SELECT COALESCE(SUM(comissao_valor), 0)
          FROM sevenconstruction.revendedor_comissao c
         WHERE c.revendedor_id = a.id AND c.status IN ('aprovada','paga')
           AND c.criado_em >= DATE_TRUNC('month', NOW()))                                  AS comissao_mes
FROM arvore a;
