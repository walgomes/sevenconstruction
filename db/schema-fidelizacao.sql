-- Fidelizacao do cliente final — Bloco J do MVP SC.
-- Clube de pontos/cashback + indicacao cruzada entre clientes.
--
-- 3 tabelas:
--   cliente_pontos             saldo atual + totais (1 linha/cliente)
--   cliente_pontos_movimento   ledger imutavel de cada credito/debito
--   cliente_indicacoes         cliente A indica cliente B → bonus quando
--                              indicado fizer 1a compra (>= valor minimo)
--
-- Regras default (configuraveis por loja em loja_pontos_config no futuro):
--   Compra: 1 ponto por R$ 1 (1%) — pode ajustar via fator
--   Indicacao: 50 pts pra quem indica + 50 pts pro indicado (na 1a compra)
--   1 ponto = R$ 0,01 no resgate (1:1 com centavos)

SET search_path = sevenconstruction, public;

CREATE TABLE IF NOT EXISTS cliente_pontos (
  id              SERIAL PRIMARY KEY,
  cliente_id      INT NOT NULL UNIQUE REFERENCES loja_clientes(id) ON DELETE CASCADE,
  saldo           INT NOT NULL DEFAULT 0,
  total_ganho     INT NOT NULL DEFAULT 0,
  total_resgatado INT NOT NULL DEFAULT 0,
  total_expirado  INT NOT NULL DEFAULT 0,
  ultima_compra_em TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cli_pontos_saldo ON cliente_pontos(saldo DESC) WHERE saldo > 0;

CREATE TABLE IF NOT EXISTS cliente_pontos_movimento (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      INT NOT NULL REFERENCES loja_clientes(id) ON DELETE CASCADE,
  loja_id         INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('compra','resgate','indicacao_origem','indicacao_destino','ajuste','expiracao')),
  pontos          INT NOT NULL,                      -- pode ser negativo (resgate/expiracao)
  valor_referencia NUMERIC(15,2),                    -- valor monetario que originou (em compra)
  descricao       TEXT,
  origem          TEXT,                              -- 'compra_manual','indicacao_X','admin','sistema'
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_cliente ON cliente_pontos_movimento(cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mov_loja ON cliente_pontos_movimento(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON cliente_pontos_movimento(tipo);

CREATE TABLE IF NOT EXISTS cliente_indicacoes (
  id              SERIAL PRIMARY KEY,
  loja_id         INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  cliente_origem  INT NOT NULL REFERENCES loja_clientes(id) ON DELETE CASCADE,
  cliente_destino INT REFERENCES loja_clientes(id) ON DELETE SET NULL,
  -- Snapshot do indicado antes do cadastro (caso ainda nao seja cliente)
  nome_indicado   TEXT NOT NULL,
  contato_indicado TEXT NOT NULL,                    -- email ou telefone
  status          TEXT NOT NULL DEFAULT 'pendente',  -- 'pendente'|'cadastrado'|'comprou'|'pago'|'expirado'|'cancelado'
  recompensa_pontos INT NOT NULL DEFAULT 50,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cadastrado_em   TIMESTAMPTZ,
  comprou_em      TIMESTAMPTZ,
  pago_em         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_indic_origem ON cliente_indicacoes(cliente_origem);
CREATE INDEX IF NOT EXISTS idx_indic_destino ON cliente_indicacoes(cliente_destino) WHERE cliente_destino IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indic_loja ON cliente_indicacoes(loja_id, status);

-- View: KPIs do programa por loja
CREATE OR REPLACE VIEW v_fidelizacao_kpis AS
SELECT
  c.loja_id,
  COUNT(DISTINCT c.id)::int                                       AS clientes_no_clube,
  COALESCE(SUM(p.saldo), 0)::int                                  AS pontos_em_circulacao,
  COALESCE(SUM(p.total_ganho), 0)::int                            AS pontos_distribuidos,
  COALESCE(SUM(p.total_resgatado), 0)::int                        AS pontos_resgatados,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('cadastrado','comprou','pago'))::int AS indicacoes_efetivas,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'pendente')::int  AS indicacoes_pendentes
FROM lojas l
JOIN loja_clientes c ON c.loja_id = l.id
LEFT JOIN cliente_pontos p ON p.cliente_id = c.id
LEFT JOIN cliente_indicacoes i ON i.cliente_origem = c.id
GROUP BY c.loja_id;

-- Trigger: ao inserir movimento, atualiza saldo + totais em cliente_pontos
CREATE OR REPLACE FUNCTION trg_aplicar_movimento_pontos() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sevenconstruction.cliente_pontos (cliente_id, saldo, total_ganho, total_resgatado, total_expirado, atualizado_em)
  VALUES (
    NEW.cliente_id,
    NEW.pontos,
    CASE WHEN NEW.pontos > 0 AND NEW.tipo NOT IN ('resgate','expiracao') THEN NEW.pontos ELSE 0 END,
    CASE WHEN NEW.tipo = 'resgate' THEN ABS(NEW.pontos) ELSE 0 END,
    CASE WHEN NEW.tipo = 'expiracao' THEN ABS(NEW.pontos) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (cliente_id) DO UPDATE SET
    saldo = sevenconstruction.cliente_pontos.saldo + NEW.pontos,
    total_ganho = sevenconstruction.cliente_pontos.total_ganho +
      CASE WHEN NEW.pontos > 0 AND NEW.tipo NOT IN ('resgate','expiracao') THEN NEW.pontos ELSE 0 END,
    total_resgatado = sevenconstruction.cliente_pontos.total_resgatado +
      CASE WHEN NEW.tipo = 'resgate' THEN ABS(NEW.pontos) ELSE 0 END,
    total_expirado = sevenconstruction.cliente_pontos.total_expirado +
      CASE WHEN NEW.tipo = 'expiracao' THEN ABS(NEW.pontos) ELSE 0 END,
    ultima_compra_em = CASE WHEN NEW.tipo = 'compra' THEN NOW() ELSE sevenconstruction.cliente_pontos.ultima_compra_em END,
    atualizado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movimento_aplica_saldo ON cliente_pontos_movimento;
CREATE TRIGGER movimento_aplica_saldo
  AFTER INSERT ON cliente_pontos_movimento
  FOR EACH ROW EXECUTE FUNCTION trg_aplicar_movimento_pontos();
