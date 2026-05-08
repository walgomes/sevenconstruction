-- Recuperacao de senha: token UUID enviado por email com validade de 1h.
-- Idempotente: gerar novo token desativa os anteriores do mesmo user.

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS senha_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES loja_users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ,
  ip_solicit  TEXT,
  ua_solicit  TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_user ON senha_reset_tokens(user_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_reset_expira ON senha_reset_tokens(expira_em) WHERE ativo;
