-- Auth do cliente final (papel loja_cliente). Sem senha tradicional —
-- a loja gera um link com token UUID e envia pro cliente. Token vale 30
-- dias e pode ser regenerado a qualquer momento.

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS cliente_acesso_token (
  id              SERIAL PRIMARY KEY,
  cliente_id      INT NOT NULL REFERENCES loja_clientes(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expira_em       TIMESTAMPTZ NOT NULL,
  ultimo_uso_em   TIMESTAMPTZ,
  usos            INT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cli_token_cliente ON cliente_acesso_token(cliente_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_cli_token_expira ON cliente_acesso_token(expira_em) WHERE ativo;
