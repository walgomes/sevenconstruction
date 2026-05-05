-- =========================================================
-- SevenConstruction — Sprint 2: Ledger de comissoes
-- Cada vez que um servico digital é vendido, registra evento.
-- =========================================================

CREATE TABLE IF NOT EXISTS sevenconstruction.comissao_evento (
  id            BIGSERIAL PRIMARY KEY,
  loja_id       INT NOT NULL REFERENCES sevenconstruction.lojas(id) ON DELETE CASCADE,
  cliente_id    INT REFERENCES sevenconstruction.loja_clientes(id) ON DELETE SET NULL,
  servico_id    INT REFERENCES sevenconstruction.servicos_catalogo(id) ON DELETE SET NULL,
  -- Snapshot dos valores no momento da venda (servico_id pode mudar de preco depois):
  servico_codigo    TEXT,
  servico_nome      TEXT,
  valor_venda       NUMERIC(15,2) NOT NULL,
  valor_custo       NUMERIC(15,2) NOT NULL DEFAULT 0,
  comissao_loja     NUMERIC(15,2) NOT NULL,
  -- Status:
  status            TEXT NOT NULL DEFAULT 'aprovada',
  -- 'aprovada' | 'pendente' | 'cancelada' | 'estornada'
  descricao         TEXT,
  metadados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por        INT REFERENCES sevenconstruction.loja_users(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comissao_evento_loja_idx
  ON sevenconstruction.comissao_evento(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS comissao_evento_cliente_idx
  ON sevenconstruction.comissao_evento(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comissao_evento_status_idx
  ON sevenconstruction.comissao_evento(loja_id, status);

-- =========================================================
-- VIEW: KPIs de comissao por loja (mes corrente)
-- =========================================================
CREATE OR REPLACE VIEW sevenconstruction.v_loja_comissoes_resumo AS
SELECT
  l.id                                                        AS loja_id,
  COALESCE(SUM(e.comissao_loja) FILTER (
    WHERE e.status = 'aprovada' AND e.criado_em >= DATE_TRUNC('month', NOW())
  ), 0)                                                       AS total_mes,
  COALESCE(SUM(e.comissao_loja) FILTER (
    WHERE e.status = 'aprovada'
  ), 0)                                                       AS total_acumulado,
  COUNT(*) FILTER (
    WHERE e.status = 'aprovada' AND e.criado_em >= DATE_TRUNC('month', NOW())
  )                                                           AS qtd_eventos_mes,
  COUNT(*) FILTER (
    WHERE e.status = 'aprovada'
  )                                                           AS qtd_eventos_total,
  COALESCE(AVG(e.comissao_loja) FILTER (
    WHERE e.status = 'aprovada'
  ), 0)                                                       AS ticket_medio
FROM sevenconstruction.lojas l
LEFT JOIN sevenconstruction.comissao_evento e ON e.loja_id = l.id
GROUP BY l.id;
