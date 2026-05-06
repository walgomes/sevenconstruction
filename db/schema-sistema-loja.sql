-- =========================================================
-- SevenConstruction — Sistema Loja (ERP minimo da loja)
-- 5 tabelas novas: produtos, fornecedores, nota_entrada (+ itens),
-- conta_pagar, conta_receber
-- Multi-tenant: tudo filtrado por loja_id.
-- =========================================================

-- ========== PRODUTOS ==========
CREATE TABLE IF NOT EXISTS sevenconstruction.produtos (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  codigo          TEXT,
  -- SKU interno da loja (opcional)
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       TEXT,
  -- 'cimento' | 'areia_brita' | 'blocos' | 'ferragens' | 'tintas' | 'eletrica' |
  -- 'hidraulica' | 'ferramentas' | 'acessorios' | 'outros'
  marca           TEXT,
  ncm             TEXT,
  -- Nomenclatura Comum Mercosul (8 digitos)
  unidade         TEXT NOT NULL DEFAULT 'un',
  -- un | saco | m3 | kg | litros | m | m2 | par | cx
  preco_custo     NUMERIC(15,2) NOT NULL DEFAULT 0,
  preco_venda     NUMERIC(15,2) NOT NULL DEFAULT 0,
  margem_pct      NUMERIC(5,2),
  -- calculado opcional: ((venda-custo)/custo)*100
  estoque_atual   NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_maximo  NUMERIC(12,3),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, codigo)
);
CREATE INDEX IF NOT EXISTS produtos_loja_idx
  ON sevenconstruction.produtos(loja_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS produtos_categoria_idx
  ON sevenconstruction.produtos(loja_id, categoria) WHERE ativo;
CREATE INDEX IF NOT EXISTS produtos_estoque_baixo_idx
  ON sevenconstruction.produtos(loja_id) WHERE ativo AND estoque_atual <= estoque_minimo;

-- ========== FORNECEDORES ==========
CREATE TABLE IF NOT EXISTS sevenconstruction.fornecedores (
  id                  SERIAL PRIMARY KEY,
  loja_id             INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por          INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  cnpj                TEXT,
  razao_social        TEXT NOT NULL,
  nome_fantasia       TEXT,
  email               TEXT,
  telefone            TEXT,
  whatsapp            TEXT,
  contato_nome        TEXT,
  cep                 TEXT,
  endereco            TEXT,
  numero              TEXT,
  bairro              TEXT,
  cidade              TEXT,
  uf                  CHAR(2),
  -- Comerciais
  prazo_pagamento_dias INT NOT NULL DEFAULT 0,
  -- 0 = a vista; 30 = 30 dias; 30/60/90 = parcelado (campo livre em condicao)
  condicao_pagamento  TEXT,
  -- ex: '30/60/90 dias', 'a vista 5% desc'
  banco_pagamento     TEXT,
  pix_chave           TEXT,
  observacoes         TEXT,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, cnpj)
);
CREATE INDEX IF NOT EXISTS fornecedores_loja_idx
  ON sevenconstruction.fornecedores(loja_id) WHERE ativo;

-- ========== NOTA ENTRADA + ITENS ==========
CREATE TABLE IF NOT EXISTS sevenconstruction.nota_entrada (
  id                  SERIAL PRIMARY KEY,
  loja_id             INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por          INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  fornecedor_id       INT REFERENCES sevenconstruction.fornecedores(id) ON DELETE SET NULL,
  -- Snapshot caso fornecedor seja deletado:
  fornecedor_nome     TEXT,
  fornecedor_cnpj     TEXT,
  -- Dados da NF
  numero              TEXT NOT NULL,
  serie               TEXT,
  chave_acesso        TEXT,
  -- 44 digitos NFe (opcional ate ter parser XML)
  data_emissao        DATE,
  data_entrada        DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Valores
  valor_produtos      NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_frete         NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_desconto      NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_total         NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Status
  status              TEXT NOT NULL DEFAULT 'recebida',
  -- 'recebida' | 'conferida' | 'lancada' | 'cancelada'
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, fornecedor_id, numero, serie)
);
CREATE INDEX IF NOT EXISTS nota_entrada_loja_idx
  ON sevenconstruction.nota_entrada(loja_id, data_entrada DESC);
CREATE INDEX IF NOT EXISTS nota_entrada_fornec_idx
  ON sevenconstruction.nota_entrada(fornecedor_id, data_entrada DESC) WHERE fornecedor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sevenconstruction.nota_entrada_item (
  id              BIGSERIAL PRIMARY KEY,
  nota_id         INT NOT NULL REFERENCES sevenconstruction.nota_entrada(id) ON DELETE CASCADE,
  produto_id      INT REFERENCES sevenconstruction.produtos(id) ON DELETE SET NULL,
  -- Snapshot mesmo se produto for deletado:
  descricao       TEXT NOT NULL,
  ncm             TEXT,
  unidade         TEXT,
  quantidade      NUMERIC(12,3) NOT NULL,
  valor_unitario  NUMERIC(15,4) NOT NULL,
  valor_total     NUMERIC(15,2) NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nota_entrada_item_nota_idx
  ON sevenconstruction.nota_entrada_item(nota_id);

-- ========== CONTAS A PAGAR ==========
CREATE TABLE IF NOT EXISTS sevenconstruction.conta_pagar (
  id                  SERIAL PRIMARY KEY,
  loja_id             INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por          INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  fornecedor_id       INT REFERENCES sevenconstruction.fornecedores(id) ON DELETE SET NULL,
  nota_id             INT REFERENCES sevenconstruction.nota_entrada(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  categoria_despesa   TEXT,
  -- 'mercadoria' | 'aluguel' | 'energia' | 'agua' | 'telefone' | 'salarios' |
  -- 'impostos' | 'manutencao' | 'marketing' | 'frete' | 'outros'
  valor               NUMERIC(15,2) NOT NULL,
  vencimento          DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'aberta',
  -- 'aberta' | 'paga' | 'atrasada' | 'cancelada' | 'parcial'
  forma_pagamento     TEXT,
  -- 'boleto' | 'pix' | 'transferencia' | 'cartao' | 'dinheiro' | 'outros'
  pago_em             TIMESTAMPTZ,
  valor_pago          NUMERIC(15,2),
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conta_pagar_loja_idx
  ON sevenconstruction.conta_pagar(loja_id, vencimento);
CREATE INDEX IF NOT EXISTS conta_pagar_status_idx
  ON sevenconstruction.conta_pagar(loja_id, status, vencimento) WHERE status IN ('aberta','atrasada','parcial');

-- ========== CONTAS A RECEBER ==========
CREATE TABLE IF NOT EXISTS sevenconstruction.conta_receber (
  id                  SERIAL PRIMARY KEY,
  loja_id             INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por          INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  cliente_id          INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  origem              TEXT,
  -- 'venda_balcao' | 'pedido' | 'servico' | 'outros'
  valor               NUMERIC(15,2) NOT NULL,
  vencimento          DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'aberta',
  -- 'aberta' | 'recebida' | 'atrasada' | 'cancelada' | 'parcial' | 'protestada'
  forma_recebimento   TEXT,
  recebido_em         TIMESTAMPTZ,
  valor_recebido      NUMERIC(15,2),
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conta_receber_loja_idx
  ON sevenconstruction.conta_receber(loja_id, vencimento);
CREATE INDEX IF NOT EXISTS conta_receber_status_idx
  ON sevenconstruction.conta_receber(loja_id, status, vencimento) WHERE status IN ('aberta','atrasada','parcial');
CREATE INDEX IF NOT EXISTS conta_receber_cliente_idx
  ON sevenconstruction.conta_receber(cliente_id, vencimento DESC) WHERE cliente_id IS NOT NULL;

-- ========== VIEW: KPIs do Sistema Loja ==========
CREATE OR REPLACE VIEW sevenconstruction.v_loja_sistema_kpis AS
SELECT
  l.id                                                              AS loja_id,
  -- Produtos
  (SELECT COUNT(*)::int FROM sevenconstruction.produtos p
    WHERE p.loja_id = l.id AND p.ativo)                             AS total_produtos,
  (SELECT COUNT(*)::int FROM sevenconstruction.produtos p
    WHERE p.loja_id = l.id AND p.ativo
      AND p.estoque_atual <= p.estoque_minimo)                       AS produtos_estoque_baixo,
  (SELECT COALESCE(SUM(p.estoque_atual * p.preco_custo), 0)::float
     FROM sevenconstruction.produtos p
    WHERE p.loja_id = l.id AND p.ativo)                             AS valor_estoque_custo,
  -- Fornecedores
  (SELECT COUNT(*)::int FROM sevenconstruction.fornecedores f
    WHERE f.loja_id = l.id AND f.ativo)                             AS total_fornecedores,
  -- Notas
  (SELECT COUNT(*)::int FROM sevenconstruction.nota_entrada n
    WHERE n.loja_id = l.id AND n.data_entrada >= CURRENT_DATE - 30)  AS notas_entrada_30d,
  -- Contas a pagar
  (SELECT COUNT(*)::int FROM sevenconstruction.conta_pagar c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','atrasada','parcial'))
                                                                     AS contas_pagar_abertas,
  (SELECT COALESCE(SUM(c.valor), 0)::float FROM sevenconstruction.conta_pagar c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','atrasada','parcial'))
                                                                     AS valor_contas_pagar,
  (SELECT COUNT(*)::int FROM sevenconstruction.conta_pagar c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','parcial')
      AND c.vencimento < CURRENT_DATE)                               AS contas_pagar_atrasadas,
  -- Contas a receber
  (SELECT COUNT(*)::int FROM sevenconstruction.conta_receber c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','atrasada','parcial'))
                                                                     AS contas_receber_abertas,
  (SELECT COALESCE(SUM(c.valor), 0)::float FROM sevenconstruction.conta_receber c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','atrasada','parcial'))
                                                                     AS valor_contas_receber,
  (SELECT COUNT(*)::int FROM sevenconstruction.conta_receber c
    WHERE c.loja_id = l.id AND c.status IN ('aberta','parcial')
      AND c.vencimento < CURRENT_DATE)                               AS contas_receber_atrasadas,
  -- Clientes
  (SELECT COUNT(*)::int FROM sevenconstruction.loja_clientes c
    WHERE c.loja_id = l.id AND c.ativo)                             AS total_clientes
FROM sevenconstruction.lojas l;
