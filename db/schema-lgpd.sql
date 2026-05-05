-- =========================================================
-- SevenConstruction — LGPD: termo de aceite
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.termo_aceite (
  id          BIGSERIAL PRIMARY KEY,
  loja_id     INT REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  user_id     INT REFERENCES sevenconstruction.loja_users(id) ON DELETE CASCADE,
  cliente_id  INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE CASCADE,
  -- Quem aceitou: pelo menos um dos 3 (user, cliente, loja institucional)
  versao      TEXT NOT NULL,
  -- ex: '1.0', '2026-05-05'
  ip          TEXT,
  user_agent  TEXT,
  contexto    TEXT,
  -- 'login' | 'cadastro_cliente' | 'consulta_pf' | 'envio_marketing'
  aceito_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (user_id IS NOT NULL)::int +
    (cliente_id IS NOT NULL)::int +
    (loja_id IS NOT NULL AND user_id IS NULL AND cliente_id IS NULL)::int >= 1
  )
);
CREATE INDEX IF NOT EXISTS termo_aceite_user_idx
  ON sevenconstruction.termo_aceite(user_id, aceito_em DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS termo_aceite_loja_idx
  ON sevenconstruction.termo_aceite(loja_id, aceito_em DESC);
