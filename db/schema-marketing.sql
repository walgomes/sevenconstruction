-- =========================================================
-- SevenConstruction — Marketing outbound (multi-tenant)
-- 5 tabelas: listas, campanhas, envios, supressoes, templates
-- Toda query de write/read DEVE filtrar por loja_id (tenant).
-- =========================================================

SET search_path TO sevenconstruction, public;

-- =========================================================
-- LISTAS — audiencia (importada do prospec ou manual)
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_listas (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  origem          TEXT NOT NULL DEFAULT 'manual',
  -- 'manual' | 'prospec' | 'importacao' | 'licitacoes'
  prospec_lista_id INT REFERENCES sevenconstruction.prospec_listas(id) ON DELETE SET NULL,
  total_contatos  INT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mkt_listas_loja_idx
  ON sevenconstruction.mkt_listas(loja_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_lista_contatos (
  id            BIGSERIAL PRIMARY KEY,
  lista_id      INT NOT NULL REFERENCES sevenconstruction.mkt_listas(id) ON DELETE CASCADE,
  cnpj          TEXT,
  nome          TEXT,
  empresa       TEXT,
  email         TEXT,
  telefone      TEXT,    -- formato livre
  whatsapp      TEXT,    -- formato livre (mesmo que telefone se nao informado)
  cidade        TEXT,
  uf            CHAR(2),
  metadados     JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- evita duplicatas dentro da mesma lista
  UNIQUE(lista_id, cnpj),
  UNIQUE(lista_id, email),
  UNIQUE(lista_id, whatsapp)
);
CREATE INDEX IF NOT EXISTS mkt_lista_contatos_lista_idx
  ON sevenconstruction.mkt_lista_contatos(lista_id);

-- =========================================================
-- TEMPLATES — modelos de mensagem (email + WhatsApp)
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_templates (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por      INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  nome            TEXT NOT NULL,
  canal           TEXT NOT NULL,
  -- 'email' | 'whatsapp'
  assunto         TEXT,    -- so email
  corpo           TEXT NOT NULL,
  -- Variaveis suportadas: {{nome}}, {{empresa}}, {{cidade}}, {{loja_nome}}
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mkt_templates_loja_idx
  ON sevenconstruction.mkt_templates(loja_id, canal);

-- =========================================================
-- CAMPANHAS — orquestracao do disparo
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_campanhas (
  id                   SERIAL PRIMARY KEY,
  loja_id              INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  criado_por           INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  nome                 TEXT NOT NULL,
  canal                TEXT NOT NULL,
  -- 'email' | 'whatsapp'
  lista_id             INT NOT NULL REFERENCES sevenconstruction.mkt_listas(id) ON DELETE CASCADE,
  template_id          INT REFERENCES sevenconstruction.mkt_templates(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'rascunho',
  -- 'rascunho' | 'agendada' | 'disparando' | 'pausada' | 'concluida' | 'cancelada'
  agendada_para        TIMESTAMPTZ,
  total_destinatarios  INT NOT NULL DEFAULT 0,
  total_enviados       INT NOT NULL DEFAULT 0,
  total_falhas         INT NOT NULL DEFAULT 0,
  total_descadastros   INT NOT NULL DEFAULT 0,
  taxa_envio_por_min   INT NOT NULL DEFAULT 60,
  -- limite de envios por minuto (rate)
  iniciado_em          TIMESTAMPTZ,
  concluido_em         TIMESTAMPTZ,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mkt_campanhas_loja_idx
  ON sevenconstruction.mkt_campanhas(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS mkt_campanhas_status_idx
  ON sevenconstruction.mkt_campanhas(status) WHERE status IN ('disparando', 'pausada', 'agendada');

-- =========================================================
-- ENVIOS — log de cada mensagem enviada
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_envios (
  id              BIGSERIAL PRIMARY KEY,
  campanha_id     INT NOT NULL REFERENCES sevenconstruction.mkt_campanhas(id) ON DELETE CASCADE,
  contato_id      BIGINT REFERENCES sevenconstruction.mkt_lista_contatos(id) ON DELETE SET NULL,
  destino         TEXT NOT NULL,
  -- email ou WhatsApp do destinatario
  status          TEXT NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'enviado' | 'aberto' | 'clicou' | 'falhou' | 'descadastrou'
  provider_id     TEXT,
  -- ID do email no Resend OU message ID do WhatsApp
  erro            TEXT,
  enviado_em      TIMESTAMPTZ,
  aberto_em       TIMESTAMPTZ,
  clicou_em       TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mkt_envios_campanha_idx
  ON sevenconstruction.mkt_envios(campanha_id, status);
CREATE INDEX IF NOT EXISTS mkt_envios_destino_idx
  ON sevenconstruction.mkt_envios(destino);

-- =========================================================
-- SUPRESSOES — quem nao quer mais receber
-- =========================================================
CREATE TABLE IF NOT EXISTS sevenconstruction.mkt_supressoes (
  id          BIGSERIAL PRIMARY KEY,
  loja_id     INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  destino     TEXT NOT NULL,
  -- email ou WhatsApp
  canal       TEXT NOT NULL,
  -- 'email' | 'whatsapp'
  motivo      TEXT,
  -- 'bounce' | 'descadastro' | 'manual' | 'spam' | 'invalido'
  origem      TEXT,
  -- 'campanha:N' | 'manual' | 'webhook'
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loja_id, destino, canal)
);
CREATE INDEX IF NOT EXISTS mkt_supressoes_loja_idx
  ON sevenconstruction.mkt_supressoes(loja_id);

-- =========================================================
-- VIEW: KPIs do dashboard de marketing por loja
-- =========================================================
CREATE OR REPLACE VIEW sevenconstruction.v_loja_marketing_kpis AS
SELECT
  l.id                                          AS loja_id,
  COUNT(DISTINCT li.id)                          AS total_listas,
  COUNT(DISTINCT c.id)                           AS total_campanhas,
  COUNT(DISTINCT c.id) FILTER (
    WHERE c.status IN ('disparando','pausada')
  )                                              AS campanhas_ativas,
  COUNT(DISTINCT t.id)                           AS total_templates,
  COUNT(DISTINCT s.id)                           AS total_supressoes,
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.enviado_em >= NOW() - INTERVAL '30 days' AND e.status = 'enviado'
  )                                              AS enviados_30d
FROM sevenconstruction.lojas l
LEFT JOIN sevenconstruction.mkt_listas      li ON li.loja_id = l.id
LEFT JOIN sevenconstruction.mkt_campanhas   c  ON c.loja_id = l.id
LEFT JOIN sevenconstruction.mkt_templates   t  ON t.loja_id = l.id AND t.ativo
LEFT JOIN sevenconstruction.mkt_supressoes  s  ON s.loja_id = l.id
LEFT JOIN sevenconstruction.mkt_envios      e  ON e.campanha_id = c.id
GROUP BY l.id;
