-- =========================================================
-- SevenConstruction — Marketplace de lojas concorrentes (B2B)
-- "Eu nao tenho cimento? Voce tem? Eu vendo, voce entrega, dividimos."
-- Cada loja publica ofertas (o que vende para outras lojas) + necessidades
-- (o que precisa). Plataforma matcha e regista as transacoes.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.b2b_oferta (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  produto         TEXT NOT NULL,
  -- ex: "Cimento CP-II 50kg Votoran"
  categoria       TEXT,
  -- 'cimento' | 'areia' | 'brita' | 'blocos' | 'ferragens' | 'tintas' | 'outros'
  unidade         TEXT NOT NULL DEFAULT 'un',
  -- un | saco | m3 | kg | litros
  preco_atacado   NUMERIC(10,2),
  -- preco que oferece pra outra loja (atacado)
  estoque_min     INT,
  -- minimo que mantem disponivel
  prazo_entrega_dias INT NOT NULL DEFAULT 1,
  raio_entrega_km INT NOT NULL DEFAULT 30,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS b2b_oferta_loja_idx
  ON sevenconstruction.b2b_oferta(loja_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS b2b_oferta_categoria_idx
  ON sevenconstruction.b2b_oferta(categoria) WHERE ativo;

CREATE TABLE IF NOT EXISTS sevenconstruction.b2b_demanda (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  cliente_id      INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  produto         TEXT NOT NULL,
  categoria       TEXT,
  quantidade      NUMERIC(10,2),
  unidade         TEXT,
  prazo_max_dias  INT,
  preco_max_un    NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'aberta',
  -- 'aberta' | 'matched' | 'fechada' | 'cancelada'
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS b2b_demanda_loja_idx
  ON sevenconstruction.b2b_demanda(loja_id, status);

CREATE TABLE IF NOT EXISTS sevenconstruction.b2b_transacao (
  id                BIGSERIAL PRIMARY KEY,
  loja_compradora   INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  loja_fornecedora  INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  oferta_id         INT REFERENCES sevenconstruction.b2b_oferta(id) ON DELETE SET NULL,
  demanda_id        INT REFERENCES sevenconstruction.b2b_demanda(id) ON DELETE SET NULL,
  produto_snapshot  TEXT,
  quantidade        NUMERIC(10,2) NOT NULL,
  preco_unit        NUMERIC(10,2) NOT NULL,
  valor_total       NUMERIC(15,2) NOT NULL,
  margem_pct        NUMERIC(5,2),
  -- % que a compradora retem (vende a varejo, paga atacado pra fornecedora)
  status            TEXT NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'aceita' | 'em_transito' | 'entregue' | 'cancelada'
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (loja_compradora <> loja_fornecedora)
);
CREATE INDEX IF NOT EXISTS b2b_transacao_compradora_idx
  ON sevenconstruction.b2b_transacao(loja_compradora, criado_em DESC);
CREATE INDEX IF NOT EXISTS b2b_transacao_fornecedora_idx
  ON sevenconstruction.b2b_transacao(loja_fornecedora, criado_em DESC);
