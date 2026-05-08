-- Convites de usuario pra loja. Dono/gerente cria convite com email +
-- papel; sistema gera token UUID + envia email; convidado clica → cria
-- conta com senha e cookie sc_auth. Convite eh 1-uso, validade 7 dias.

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS loja_user_convites (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  papel           TEXT NOT NULL DEFAULT 'vendedor',  -- dono | gerente | vendedor
  token           TEXT NOT NULL UNIQUE,
  criado_por      INT NOT NULL REFERENCES loja_users(id) ON DELETE CASCADE,
  expira_em       TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'aceito' | 'revogado' | 'expirado'
  aceito_user_id  INT REFERENCES loja_users(id) ON DELETE SET NULL,
  aceito_em       TIMESTAMPTZ,
  revogado_em     TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_convite_loja ON loja_user_convites(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_convite_email ON loja_user_convites(LOWER(email)) WHERE status = 'pendente';
