-- Sistema de notificacoes centralizado.
-- Inbox interna pra eventos importantes (match B2B, transacao entregue,
-- indicacao paga, fatura vencida, parceiro homologado).
-- Canal hoje: 'inbox' apenas. Futuro: 'whatsapp' (Meta Cloud API ja
-- configurada), 'email' (Resend ja configurada).

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS notificacoes (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  user_id         INT REFERENCES loja_users(id) ON DELETE CASCADE,
  -- user_id NULL = notificacao pra loja inteira (qualquer user da loja le)
  tipo            TEXT NOT NULL,
  -- 'match_b2b' | 'transacao_marketplace' | 'indicacao_paga' |
  -- 'fatura_vencida' | 'parceiro_homologado' | 'cliente_proximo_trial_fim' |
  -- 'sistema' (avisos genericos)
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  link            TEXT,                              -- URL pra clicar e ir
  icone           TEXT NOT NULL DEFAULT '🔔',
  prioridade      SMALLINT NOT NULL DEFAULT 1,       -- 0=baixa, 1=normal, 2=alta
  canal           TEXT NOT NULL DEFAULT 'inbox',     -- 'inbox' | 'whatsapp' | 'email'
  lida            BOOLEAN NOT NULL DEFAULT FALSE,
  lida_em         TIMESTAMPTZ,
  metadados       JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_loja_naolidas
  ON notificacoes(loja_id, criado_em DESC) WHERE NOT lida;
CREATE INDEX IF NOT EXISTS idx_notif_user
  ON notificacoes(user_id, criado_em DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_tipo
  ON notificacoes(tipo, criado_em DESC);

-- View: contagem por loja (top header)
CREATE OR REPLACE VIEW v_notif_contagem AS
SELECT
  loja_id,
  user_id,
  COUNT(*) FILTER (WHERE NOT lida)::int AS nao_lidas,
  COUNT(*) FILTER (WHERE NOT lida AND prioridade = 2)::int AS nao_lidas_alta,
  COUNT(*)::int AS total,
  MAX(criado_em) AS ultima_em
FROM notificacoes
GROUP BY loja_id, user_id;
