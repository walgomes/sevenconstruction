// Webhook do Stripe — recebe eventos de assinatura e pagamento.
// Validacao de assinatura via x-stripe-signature header (HMAC).
// Idempotente: stripe_event_id eh UNIQUE em pagamento_eventos.

import { NextRequest, NextResponse } from "next/server";
import { getStripe, aplicarEventoStripe } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "stripe_nao_configurado" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "sem assinatura" }, { status: 400 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: "assinatura invalida", motivo: err instanceof Error ? err.message : String(err) },
      { status: 401 },
    );
  }

  try {
    await aplicarEventoStripe(event);
    return NextResponse.json({ ok: true, received: event.type });
  } catch (e) {
    console.error("[stripe webhook] erro:", e);
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
