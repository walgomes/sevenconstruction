// Dashboard global do super-admin: visao consolidada do negocio SC
// (cross-tenant). Queries agregadas em SQL puro — sem materializar
// tabela; rapido o suficiente pro volume atual (<10k lojas).

import pool from "@/lib/db";

export interface ReceitaSc {
  mrr_centavos: number;            // soma das mensalidades das assinaturas active
  comissao_marketplace_30d: number; // 1.5% das transacoes 30d
  comissao_credito_30d: number;     // total comissao_loja_pct das propostas efetivadas 30d
  total_30d_brl: number;
}

export async function lerReceitaSc(): Promise<ReceitaSc> {
  // MRR: soma das assinaturas active+trialing × preco do plano
  const r1 = await pool.query<{ mrr_centavos: number }>(
    `SELECT COALESCE(SUM(p.preco_mensal_centavos), 0)::int AS mrr_centavos
       FROM sevenconstruction.loja_assinaturas a
       JOIN sevenconstruction.planos p ON p.id = a.plano_id
      WHERE a.status IN ('active', 'trialing')`,
  );

  // Comissao marketplace: 1.5% sobre transacoes dos ultimos 30d
  const r2 = await pool.query<{ comissao_brl: number }>(
    `SELECT COALESCE(SUM(valor_total) * 0.015, 0)::float AS comissao_brl
       FROM sevenconstruction.b2b_transacao
      WHERE criado_em >= NOW() - INTERVAL '30 days'
        AND status NOT IN ('cancelada')`,
  );

  // Comissao credito: media comissao_loja_pct dos parceiros × volume efetivado 30d
  const r3 = await pool.query<{ comissao_brl: number }>(
    `SELECT COALESCE(SUM(pc.valor_solicitado * (pf.comissao_loja_pct / 100)), 0)::float AS comissao_brl
       FROM sevenconstruction.proposta_credito pc
       LEFT JOIN sevenconstruction.parceiros_financeiros pf ON pf.id = pc.parceiro_id
      WHERE pc.status = 'efetivada'
        AND pc.criado_em >= NOW() - INTERVAL '30 days'`,
  );

  const mrrBrl = (r1.rows[0]?.mrr_centavos ?? 0) / 100;
  const total30d = mrrBrl + (r2.rows[0]?.comissao_brl ?? 0) + (r3.rows[0]?.comissao_brl ?? 0);

  return {
    mrr_centavos: r1.rows[0]?.mrr_centavos ?? 0,
    comissao_marketplace_30d: r2.rows[0]?.comissao_brl ?? 0,
    comissao_credito_30d: r3.rows[0]?.comissao_brl ?? 0,
    total_30d_brl: total30d,
  };
}

export interface KpisLojas {
  total: number;
  ativas: number;
  trial: number;
  active: number;
  churned: number;
  novas_30d: number;
  novas_7d: number;
  por_plano: Record<string, number>;
}

export async function lerKpisLojas(): Promise<KpisLojas> {
  const r = await pool.query<{
    total: number; ativas: number; trial: number; active: number;
    churned: number; novas_30d: number; novas_7d: number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE l.ativo)::int AS ativas,
       COUNT(*) FILTER (WHERE a.status = 'trialing')::int AS trial,
       COUNT(*) FILTER (WHERE a.status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE a.status IN ('canceled','past_due','unpaid'))::int AS churned,
       COUNT(*) FILTER (WHERE l.criado_em >= NOW() - INTERVAL '30 days')::int AS novas_30d,
       COUNT(*) FILTER (WHERE l.criado_em >= NOW() - INTERVAL '7 days')::int AS novas_7d
       FROM sevenconstruction.lojas l
       LEFT JOIN sevenconstruction.loja_assinaturas a ON a.loja_id = l.id`,
  );

  const r2 = await pool.query<{ codigo: string; n: number }>(
    `SELECT p.codigo, COUNT(*)::int AS n
       FROM sevenconstruction.loja_assinaturas a
       JOIN sevenconstruction.planos p ON p.id = a.plano_id
      WHERE a.status IN ('active', 'trialing')
      GROUP BY p.codigo`,
  );
  const por_plano: Record<string, number> = {};
  for (const x of r2.rows) por_plano[x.codigo] = x.n;

  return { ...r.rows[0], por_plano };
}

export interface TopLoja {
  loja_id: number;
  nome_fantasia: string;
  cidade: string | null;
  uf: string | null;
  plano: string;
  status: string;
  volume_30d: number;          // soma de transacoes marketplace + propostas efetivadas
  clientes_total: number;
  ultimo_login: string | null;
}

export async function lerTopLojas(limite = 10): Promise<TopLoja[]> {
  const r = await pool.query<TopLoja>(
    `SELECT l.id AS loja_id, l.nome_fantasia, l.cidade, l.uf,
            COALESCE(p.codigo, 'starter') AS plano,
            COALESCE(a.status, 'desconhecido') AS status,
            (
              COALESCE((SELECT SUM(valor_total)::float FROM sevenconstruction.b2b_transacao
                          WHERE (loja_compradora = l.id OR loja_fornecedora = l.id)
                            AND criado_em >= NOW() - INTERVAL '30 days'
                            AND status NOT IN ('cancelada')), 0)
              +
              COALESCE((SELECT SUM(valor_solicitado)::float FROM sevenconstruction.proposta_credito
                          WHERE loja_id = l.id
                            AND status = 'efetivada'
                            AND criado_em >= NOW() - INTERVAL '30 days'), 0)
            ) AS volume_30d,
            (SELECT COUNT(*)::int FROM sevenconstruction.loja_clientes WHERE loja_id = l.id) AS clientes_total,
            (SELECT MAX(ultimo_login)::text FROM sevenconstruction.loja_users WHERE loja_id = l.id) AS ultimo_login
       FROM sevenconstruction.lojas l
       LEFT JOIN sevenconstruction.loja_assinaturas a ON a.loja_id = l.id
       LEFT JOIN sevenconstruction.planos p ON p.id = a.plano_id
      WHERE l.ativo
      ORDER BY volume_30d DESC, clientes_total DESC
      LIMIT $1`,
    [limite],
  );
  return r.rows;
}

export interface FunilCadastro {
  cadastros_30d: number;
  cadastros_7d: number;
  trial_ativos: number;
  paid_ativos: number;
  conv_trial_pra_paid_pct: number; // taxa: paid / (paid + canceled+past_due+unpaid pos-trial)
}

export async function lerFunilCadastro(): Promise<FunilCadastro> {
  const r = await pool.query<{
    cadastros_30d: number; cadastros_7d: number;
    trial_ativos: number; paid_ativos: number; convertidos_total: number; encerrados_total: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE l.criado_em >= NOW() - INTERVAL '30 days')::int AS cadastros_30d,
       COUNT(*) FILTER (WHERE l.criado_em >= NOW() - INTERVAL '7 days')::int AS cadastros_7d,
       COUNT(*) FILTER (WHERE a.status = 'trialing')::int AS trial_ativos,
       COUNT(*) FILTER (WHERE a.status = 'active')::int AS paid_ativos,
       -- Convertidos: lojas que tem assinatura active (uma vez paga)
       COUNT(*) FILTER (WHERE a.status = 'active' OR a.cancelada_em IS NOT NULL)::int AS convertidos_total,
       COUNT(*) FILTER (WHERE a.status IN ('canceled','past_due','unpaid','incomplete'))::int AS encerrados_total
       FROM sevenconstruction.lojas l
       LEFT JOIN sevenconstruction.loja_assinaturas a ON a.loja_id = l.id`,
  );
  const row = r.rows[0];
  const denominador = row.paid_ativos + row.encerrados_total;
  const conv = denominador > 0 ? Math.round((row.paid_ativos / denominador) * 100) : 0;
  return {
    cadastros_30d: row.cadastros_30d,
    cadastros_7d: row.cadastros_7d,
    trial_ativos: row.trial_ativos,
    paid_ativos: row.paid_ativos,
    conv_trial_pra_paid_pct: conv,
  };
}

export interface KpisOperacionais {
  parceiros_total: number;
  parceiros_homologados: number;
  transacoes_marketplace_30d: number;
  volume_marketplace_30d: number;
  propostas_credito_30d: number;
  propostas_efetivadas_30d: number;
  clientes_no_clube: number;
  pontos_em_circulacao: number;
}

export async function lerKpisOperacionais(): Promise<KpisOperacionais> {
  const r = await pool.query<KpisOperacionais>(
    `SELECT
       (SELECT COUNT(*)::int FROM sevenconstruction.parceiros)                       AS parceiros_total,
       (SELECT COUNT(*)::int FROM sevenconstruction.parceiros WHERE fase_homolog = 'homologado') AS parceiros_homologados,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_transacao
         WHERE criado_em >= NOW() - INTERVAL '30 days')                              AS transacoes_marketplace_30d,
       COALESCE((SELECT SUM(valor_total)::float FROM sevenconstruction.b2b_transacao
         WHERE criado_em >= NOW() - INTERVAL '30 days'
           AND status NOT IN ('cancelada')), 0)                                       AS volume_marketplace_30d,
       (SELECT COUNT(*)::int FROM sevenconstruction.proposta_credito
         WHERE criado_em >= NOW() - INTERVAL '30 days')                              AS propostas_credito_30d,
       (SELECT COUNT(*)::int FROM sevenconstruction.proposta_credito
         WHERE status = 'efetivada' AND criado_em >= NOW() - INTERVAL '30 days')     AS propostas_efetivadas_30d,
       (SELECT COUNT(DISTINCT cliente_id)::int FROM sevenconstruction.cliente_pontos WHERE saldo > 0) AS clientes_no_clube,
       COALESCE((SELECT SUM(saldo)::int FROM sevenconstruction.cliente_pontos WHERE saldo > 0), 0) AS pontos_em_circulacao`,
  );
  return r.rows[0];
}
