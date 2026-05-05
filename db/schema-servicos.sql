-- =========================================================
-- SevenConstruction — Sprint 2: Catalogo de servicos digitais
-- Catalogo MASTER (mesmo pra todas as lojas) + ativacao por loja.
-- A loja toggla quais oferece e pode customizar preco de venda.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.servicos_catalogo (
  id                   SERIAL PRIMARY KEY,
  codigo               TEXT UNIQUE NOT NULL,
  nome                 TEXT NOT NULL,
  categoria            TEXT NOT NULL,
  -- 'certidoes' | 'cert_digital' | 'consultas' | 'clube' | 'credito' | 'outros'
  preco_custo          NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_venda_sugerido NUMERIC(10,2) NOT NULL,
  comissao_loja_pct    INT NOT NULL DEFAULT 50,
  -- % da margem (preco_venda - preco_custo) que vai pra loja
  descricao            TEXT,
  ativo_default        BOOLEAN NOT NULL DEFAULT TRUE,
  ordem                INT NOT NULL DEFAULT 100,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS servicos_catalogo_categoria_idx
  ON sevenconstruction.servicos_catalogo(categoria, ordem);

CREATE TABLE IF NOT EXISTS sevenconstruction.servico_loja_ativacao (
  id                  SERIAL PRIMARY KEY,
  loja_id             INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  servico_id          INT NOT NULL REFERENCES sevenconstruction.servicos_catalogo(id) ON DELETE CASCADE,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  preco_venda_custom  NUMERIC(10,2),
  -- NULL = usa preco_venda_sugerido do catalogo
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, servico_id)
);
CREATE INDEX IF NOT EXISTS servico_loja_ativacao_loja_idx
  ON sevenconstruction.servico_loja_ativacao(loja_id) WHERE ativo;

-- =========================================================
-- SEED: 10 servicos iniciais
-- =========================================================
INSERT INTO sevenconstruction.servicos_catalogo
  (codigo, nome, categoria, preco_custo, preco_venda_sugerido, comissao_loja_pct, descricao, ordem)
VALUES
  ('CRT_FED',    'Certidão Negativa Federal (Receita+PGFN)', 'certidoes',    5,  25, 80,
   'Certidão negativa de débitos federais. Emissão na hora.', 10),
  ('CRT_EST',    'Certidão Negativa Estadual',                'certidoes',    8,  30, 80,
   'Certidão estadual da Sefaz da UF do CNPJ.', 20),
  ('CRT_TRB',    'Certidão Negativa Trabalhista (CNDT)',      'certidoes',    5,  20, 80,
   'CNDT do TST. Pré-requisito pra licitação pública.', 30),
  ('CRT_FAL',    'Certidão de Falência e Concordata',         'certidoes',   10,  35, 80,
   'Certidão do TJ da UF onde a empresa está sediada.', 40),
  ('CRT_DIG',    'Certificado Digital A1 (1 ano)',            'cert_digital', 90, 200, 50,
   'e-CNPJ ou e-CPF A1 emitido em até 24h.', 50),
  ('CONS_CNPJ',  'Consulta CNPJ Completa',                    'consultas',    2,  15, 85,
   'Dados RFB + CNAEs secundários + sócios + situação cadastral.', 60),
  ('CONS_SOC',   'Consulta Sócios + Cruzamento de Empresas',  'consultas',    5,  30, 80,
   'Lista todas as empresas em que cada sócio aparece.', 70),
  ('CONS_COMP',  'Análise Compliance Completa',               'consultas',   15,  80, 80,
   'CEIS, CNEP, CEPIM, CADIN, PGFN, sanções e processos.', 80),
  ('CONS_SCORE', 'Score de Crédito Empresa',                  'consultas',    8,  40, 80,
   'Rating Serasa + análise de capital social + tempo de mercado.', 90),
  ('CLUBE',      'Clube de Vantagens (mensal)',               'clube',       25,  49, 50,
   '3000+ empresas com desconto: farmácia, cinema, restaurante, combustível, passagem aérea.', 100)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      preco_custo = EXCLUDED.preco_custo,
      preco_venda_sugerido = EXCLUDED.preco_venda_sugerido,
      comissao_loja_pct = EXCLUDED.comissao_loja_pct,
      descricao = EXCLUDED.descricao,
      categoria = EXCLUDED.categoria,
      ordem = EXCLUDED.ordem;
