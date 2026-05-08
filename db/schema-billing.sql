-- Billing SaaS: cobranca de mensalidade das lojas via Stripe.
-- Trial 14 dias automatico ao cadastrar loja. Apos trial, loja precisa
-- ter assinatura ativa (status='active' ou 'trialing') pra usar features
-- avancadas. Modulos basicos continuam disponiveis sem assinatura.

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS planos (
  id              SERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL UNIQUE,         -- 'starter' | 'pro' | 'enterprise'
  nome            TEXT NOT NULL,
  preco_mensal_centavos INT NOT NULL,
  stripe_price_id TEXT,                          -- price_xxx no Stripe (env-driven)
  features        TEXT[] NOT NULL DEFAULT '{}',
  trial_dias      INT NOT NULL DEFAULT 14,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  ordem           INT NOT NULL DEFAULT 100,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO planos (codigo, nome, preco_mensal_centavos, features, ordem)
VALUES
  ('starter', 'Starter',  9900,  ARRAY['Base de clientes', 'Catálogo', 'Comissões', 'Concierge', 'Disparo Email/WhatsApp', 'Sistema Loja (ERP mínimo)'], 10),
  ('pro',     'Pro',      29900, ARRAY['Tudo do Starter', 'Lookalike de carteira', 'Rede B2B (matches + conversas)', 'Marketplace cross-fulfillment', 'FIDC + comparador de bancos', 'Fidelização + PWA cliente', 'Catálogo de SKUs/NCM', 'Prospecção RFB ilimitada'], 20),
  ('enterprise', 'Enterprise', 99900, ARRAY['Tudo do Pro', 'Suporte prioritário', 'Múltiplas filiais', 'API key dedicada', 'White label parcial'], 30)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS loja_assinaturas (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL UNIQUE REFERENCES lojas(id) ON DELETE CASCADE,
  plano_id        INT REFERENCES planos(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'trialing',
  -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  trial_termina_em       TIMESTAMPTZ,
  periodo_atual_termina_em TIMESTAMPTZ,
  cancelar_no_fim_periodo BOOLEAN NOT NULL DEFAULT FALSE,
  cancelada_em    TIMESTAMPTZ,
  metadados       JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assin_status ON loja_assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assin_stripe_sub ON loja_assinaturas(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pagamento_eventos (
  id                BIGSERIAL PRIMARY KEY,
  stripe_event_id   TEXT UNIQUE,
  tipo              TEXT NOT NULL,
  assinatura_id     INT REFERENCES loja_assinaturas(id) ON DELETE SET NULL,
  loja_id           INT REFERENCES lojas(id) ON DELETE SET NULL,
  valor_centavos    INT,
  moeda             TEXT,
  status            TEXT,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pag_eventos_loja ON pagamento_eventos(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pag_eventos_tipo ON pagamento_eventos(tipo);

-- Trigger atualizado_em em loja_assinaturas
CREATE OR REPLACE FUNCTION trg_assinatura_atualizado_em() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assinatura_atualizado_em ON loja_assinaturas;
CREATE TRIGGER assinatura_atualizado_em
  BEFORE UPDATE ON loja_assinaturas
  FOR EACH ROW EXECUTE FUNCTION trg_assinatura_atualizado_em();

-- Cria assinatura trialing automaticamente quando uma loja eh cadastrada
CREATE OR REPLACE FUNCTION trg_loja_inicia_trial() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  plano_starter_id INT;
BEGIN
  SELECT id INTO plano_starter_id FROM sevenconstruction.planos WHERE codigo = 'starter' LIMIT 1;
  INSERT INTO sevenconstruction.loja_assinaturas
    (loja_id, plano_id, status, trial_termina_em)
  VALUES
    (NEW.id, plano_starter_id, 'trialing', NOW() + INTERVAL '14 days')
  ON CONFLICT (loja_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loja_inicia_trial ON lojas;
CREATE TRIGGER loja_inicia_trial
  AFTER INSERT ON lojas
  FOR EACH ROW EXECUTE FUNCTION trg_loja_inicia_trial();

-- Backfill: cria assinatura trialing pra lojas que ja existem sem
INSERT INTO loja_assinaturas (loja_id, plano_id, status, trial_termina_em)
SELECT l.id,
       (SELECT id FROM planos WHERE codigo = 'starter'),
       'trialing',
       NOW() + INTERVAL '14 days'
  FROM lojas l
  WHERE NOT EXISTS (SELECT 1 FROM loja_assinaturas a WHERE a.loja_id = l.id);

-- View pra UI: assinatura + plano + dias restantes
CREATE OR REPLACE VIEW v_assinaturas AS
SELECT
  a.loja_id,
  a.id AS assinatura_id,
  a.status,
  a.cancelar_no_fim_periodo,
  p.codigo AS plano_codigo,
  p.nome AS plano_nome,
  p.preco_mensal_centavos,
  p.features,
  a.trial_termina_em,
  a.periodo_atual_termina_em,
  GREATEST(0, EXTRACT(DAY FROM COALESCE(a.trial_termina_em, a.periodo_atual_termina_em) - NOW())::int) AS dias_restantes,
  a.stripe_customer_id,
  a.stripe_subscription_id
FROM loja_assinaturas a
LEFT JOIN planos p ON p.id = a.plano_id;
