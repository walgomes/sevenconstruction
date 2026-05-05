-- =========================================================
-- SevenConstruction — Sprint 2: extensao de loja_clientes
-- Adiciona campos de historico de compras pra que a loja
-- monetize a base que ja atende com produtos digitais.
-- =========================================================

ALTER TABLE sevenconstruction.loja_clientes
  ADD COLUMN IF NOT EXISTS ultimo_compra_em       DATE,
  ADD COLUMN IF NOT EXISTS valor_total_comprado   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_compras            INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS loja_clientes_ultima_compra_idx
  ON sevenconstruction.loja_clientes(loja_id, ultimo_compra_em DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS loja_clientes_valor_total_idx
  ON sevenconstruction.loja_clientes(loja_id, valor_total_comprado DESC);
