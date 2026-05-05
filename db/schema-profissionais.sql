-- =========================================================
-- SevenConstruction — Sprint 3: Diretorio de profissionais
-- Cada loja tem seu time/parceiros: arquiteto, engenheiro, pedreiro,
-- ajudante, mestre, carpinteiro, eletricista, encanador, corretor.
-- Cada profissional tem codigo de indicacao e ledger de comissoes.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.profissionais (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  -- Identificacao
  nome            TEXT NOT NULL,
  cpf             TEXT,
  cnpj            TEXT,
  -- Contato
  telefone        TEXT,
  whatsapp        TEXT,
  email           TEXT,
  cidade          TEXT,
  uf              CHAR(2),
  bairro          TEXT,
  -- Categoria (multi-tag)
  categoria       TEXT NOT NULL,
  -- 'arquiteto' | 'engenheiro' | 'pedreiro' | 'ajudante' | 'mestre_obras'
  -- 'carpinteiro' | 'eletricista' | 'encanador' | 'pintor' | 'serralheiro'
  -- 'corretor_imovel' | 'designer' | 'paisagista' | 'outros'
  especialidade   TEXT,
  -- ex: "Reforma residencial", "Obras industriais", "Paisagismo"
  anos_experiencia INT,
  avaliacao_media NUMERIC(3,2),
  -- 0.00 a 5.00
  observacoes     TEXT,
  -- Indicacao
  codigo_indicacao TEXT NOT NULL,
  comissao_pct    NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  -- % da venda que vai pra ele quando indicar
  comissao_fixa   NUMERIC(10,2),
  -- Alternativa: valor fixo por indicacao convertida (ex: R$ 50)
  -- Status
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  destaque        BOOLEAN NOT NULL DEFAULT FALSE,
  -- aparece em "Top profissionais" no app
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, codigo_indicacao),
  UNIQUE(loja_id, cpf),
  UNIQUE(loja_id, cnpj)
);
CREATE INDEX IF NOT EXISTS profissionais_loja_idx
  ON sevenconstruction.profissionais(loja_id, ativo, categoria);
CREATE INDEX IF NOT EXISTS profissionais_categoria_idx
  ON sevenconstruction.profissionais(loja_id, categoria) WHERE ativo;
CREATE INDEX IF NOT EXISTS profissionais_codigo_idx
  ON sevenconstruction.profissionais(codigo_indicacao);
CREATE INDEX IF NOT EXISTS profissionais_cidade_idx
  ON sevenconstruction.profissionais(loja_id, cidade) WHERE ativo;

-- =========================================================
-- INDICACOES — registro de quando um profissional traz cliente
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.indicacao_evento (
  id                BIGSERIAL PRIMARY KEY,
  loja_id           INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  profissional_id   INT NOT NULL REFERENCES sevenconstruction.profissionais(id) ON DELETE CASCADE,
  cliente_id        INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  -- Snapshot
  profissional_nome TEXT,
  cliente_nome      TEXT,
  -- Venda
  valor_venda       NUMERIC(15,2) NOT NULL,
  comissao_valor    NUMERIC(15,2) NOT NULL,
  -- (calculada com base no comissao_pct ou comissao_fixa do profissional na hora)
  status            TEXT NOT NULL DEFAULT 'aprovada',
  -- 'aprovada' | 'pendente' | 'paga' | 'cancelada'
  pago_em           TIMESTAMPTZ,
  descricao         TEXT,
  metadados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por        INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS indicacao_evento_loja_idx
  ON sevenconstruction.indicacao_evento(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS indicacao_evento_prof_idx
  ON sevenconstruction.indicacao_evento(profissional_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS indicacao_evento_status_idx
  ON sevenconstruction.indicacao_evento(loja_id, status) WHERE status IN ('aprovada','pendente');

-- =========================================================
-- VIEW: ranking de profissionais por loja
-- =========================================================
CREATE OR REPLACE VIEW sevenconstruction.v_profissionais_ranking AS
SELECT
  p.id,
  p.loja_id,
  p.nome,
  p.categoria,
  p.cidade,
  p.uf,
  p.codigo_indicacao,
  p.ativo,
  COUNT(i.id) FILTER (WHERE i.status IN ('aprovada','paga'))      AS qtd_indicacoes,
  COALESCE(SUM(i.comissao_valor) FILTER (
    WHERE i.status IN ('aprovada','paga')
  ), 0)                                                            AS total_comissao,
  COALESCE(SUM(i.comissao_valor) FILTER (
    WHERE i.status IN ('aprovada','paga') AND i.criado_em >= DATE_TRUNC('month', NOW())
  ), 0)                                                            AS comissao_mes,
  MAX(i.criado_em)                                                  AS ultima_indicacao
FROM sevenconstruction.profissionais p
LEFT JOIN sevenconstruction.indicacao_evento i ON i.profissional_id = p.id
GROUP BY p.id;
