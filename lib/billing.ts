// Billing SaaS via Stripe — cobranca de mensalidade por loja.
// Trial 14 dias automatico (trigger SQL); apos trial, loja precisa
// ter status='active' ou 'trialing' pra usar features Pro/Enterprise.
//
// Env vars necessarias:
//   STRIPE_SECRET_KEY        sk_test_... ou sk_live_...
//   STRIPE_WEBHOOK_SECRET    whsec_... (validacao do x-stripe-signature)
//   STRIPE_PRICE_STARTER     price_xxx
//   STRIPE_PRICE_PRO         price_xxx
//   STRIPE_PRICE_ENTERPRISE  price_xxx
//
// Sem env: endpoints retornam 503 graciosamente.

import Stripe from "stripe";
import pool from "@/lib/db";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  _stripe = new Stripe(k, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

export interface Plano {
  id: number;
  codigo: string;
  nome: string;
  preco_mensal_centavos: number;
  stripe_price_id: string | null;
  features: string[];
  trial_dias: number;
  ativo: boolean;
  ordem: number;
}

export async function listarPlanos(): Promise<Plano[]> {
  const r = await pool.query<Plano>(
    `SELECT id, codigo, nome, preco_mensal_centavos, stripe_price_id, features,
            trial_dias, ativo, ordem
       FROM sevenconstruction.planos WHERE ativo
      ORDER BY ordem ASC`,
  );
  return r.rows;
}

// Mapeia codigo → price_id via env
export function priceIdDoPlano(codigo: string): string | null {
  switch (codigo) {
    case "starter": return process.env.STRIPE_PRICE_STARTER || null;
    case "pro": return process.env.STRIPE_PRICE_PRO || null;
    case "enterprise": return process.env.STRIPE_PRICE_ENTERPRISE || null;
    default: return null;
  }
}

export interface AssinaturaInfo {
  loja_id: number;
  assinatura_id: number;
  status: string;
  cancelar_no_fim_periodo: boolean;
  plano_codigo: string | null;
  plano_nome: string | null;
  preco_mensal_centavos: number | null;
  features: string[] | null;
  trial_termina_em: string | null;
  periodo_atual_termina_em: string | null;
  dias_restantes: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export async function lerAssinatura(loja_id: number): Promise<AssinaturaInfo | null> {
  const r = await pool.query<AssinaturaInfo>(
    `SELECT loja_id, assinatura_id, status, cancelar_no_fim_periodo,
            plano_codigo, plano_nome, preco_mensal_centavos, features,
            trial_termina_em::text AS trial_termina_em,
            periodo_atual_termina_em::text AS periodo_atual_termina_em,
            dias_restantes, stripe_customer_id, stripe_subscription_id
       FROM sevenconstruction.v_assinaturas
      WHERE loja_id = $1 LIMIT 1`,
    [loja_id],
  );
  return r.rows[0] ?? null;
}

export async function obterOuCriarStripeCustomer(loja_id: number): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY nao configurado");

  const r = await pool.query<{ stripe_customer_id: string | null; nome_fantasia: string; email: string | null }>(
    `SELECT a.stripe_customer_id, l.nome_fantasia, l.email_contato AS email
       FROM sevenconstruction.lojas l
       JOIN sevenconstruction.loja_assinaturas a ON a.loja_id = l.id
      WHERE l.id = $1 LIMIT 1`,
    [loja_id],
  );
  const row = r.rows[0];
  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const cust = await stripe.customers.create({
    name: row?.nome_fantasia ?? `Loja ${loja_id}`,
    email: row?.email ?? undefined,
    metadata: { loja_id: String(loja_id) },
  });
  await pool.query(
    `UPDATE sevenconstruction.loja_assinaturas SET stripe_customer_id = $1 WHERE loja_id = $2`,
    [cust.id, loja_id],
  );
  return cust.id;
}

export async function criarCheckoutSession(opts: {
  loja_id: number;
  plano_codigo: string;
  origem_url: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY nao configurado");

  const priceId = priceIdDoPlano(opts.plano_codigo);
  if (!priceId) throw new Error(`STRIPE_PRICE_${opts.plano_codigo.toUpperCase()} nao configurado`);

  const customerId = await obterOuCriarStripeCustomer(opts.loja_id);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.origem_url}/loja/billing?ok=1`,
    cancel_url: `${opts.origem_url}/loja/billing?cancelled=1`,
    subscription_data: {
      metadata: { loja_id: String(opts.loja_id), plano_codigo: opts.plano_codigo },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe nao retornou URL de checkout");
  return session.url;
}

export async function criarPortalSession(opts: { loja_id: number; origem_url: string }): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY nao configurado");

  const customerId = await obterOuCriarStripeCustomer(opts.loja_id);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${opts.origem_url}/loja/billing`,
  });
  return session.url;
}

// Aplica evento Stripe → atualiza loja_assinaturas + grava em pagamento_eventos
export async function aplicarEventoStripe(event: Stripe.Event): Promise<void> {
  // Idempotencia: se ja processou esse event_id, nao faz de novo
  const ja = await pool.query(
    `SELECT 1 FROM sevenconstruction.pagamento_eventos WHERE stripe_event_id = $1`,
    [event.id],
  );
  if (ja.rows[0]) return;

  let loja_id: number | null = null;
  let assinatura_id: number | null = null;
  let valor_centavos: number | null = null;
  let moeda: string | null = null;
  let status: string | null = null;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      loja_id = parseInt(sub.metadata.loja_id ?? "", 10) || null;
      status = sub.status;
      // Atualiza assinatura
      if (loja_id) {
        const planoCodigo = sub.metadata.plano_codigo ?? null;
        const planoIdRow = planoCodigo
          ? await pool.query<{ id: number }>(`SELECT id FROM sevenconstruction.planos WHERE codigo = $1`, [planoCodigo])
          : { rows: [] };
        const planoId = planoIdRow.rows[0]?.id ?? null;
        const item = sub.items.data[0];
        // Em Stripe Subscription, o periodo fica em items.current_period_end (nao em sub.current_period_end na nova API)
        const periodoFim = item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null;
        await pool.query(
          `UPDATE sevenconstruction.loja_assinaturas
              SET status = $1,
                  plano_id = COALESCE($2, plano_id),
                  stripe_subscription_id = $3,
                  periodo_atual_termina_em = COALESCE($4::timestamptz, periodo_atual_termina_em),
                  cancelar_no_fim_periodo = $5,
                  cancelada_em = CASE WHEN $1 = 'canceled' THEN NOW() ELSE cancelada_em END
            WHERE loja_id = $6
            RETURNING id`,
          [sub.status, planoId, sub.id, periodoFim, sub.cancel_at_period_end, loja_id],
        );
        const assRow = await pool.query<{ id: number }>(
          `SELECT id FROM sevenconstruction.loja_assinaturas WHERE loja_id = $1`, [loja_id],
        );
        assinatura_id = assRow.rows[0]?.id ?? null;
      }
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (customerId) {
        const r = await pool.query<{ loja_id: number; id: number }>(
          `SELECT loja_id, id FROM sevenconstruction.loja_assinaturas WHERE stripe_customer_id = $1`,
          [customerId],
        );
        loja_id = r.rows[0]?.loja_id ?? null;
        assinatura_id = r.rows[0]?.id ?? null;
      }
      valor_centavos = inv.amount_paid;
      moeda = inv.currency;
      status = inv.status ?? null;
      break;
    }
  }

  await pool.query(
    `INSERT INTO sevenconstruction.pagamento_eventos
       (stripe_event_id, tipo, assinatura_id, loja_id, valor_centavos, moeda, status, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [event.id, event.type, assinatura_id, loja_id, valor_centavos, moeda, status, JSON.stringify(event)],
  );
}
