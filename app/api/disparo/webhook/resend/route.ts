// Webhook Resend.
//
// Eventos suportados: email.delivered, email.opened, email.clicked, email.bounced, email.complained.
// Auto-supressao em bounce/complained.
//
// Verificacao de assinatura: Resend usa Svix headers (svix-id, svix-timestamp, svix-signature).
// Assinatura = base64( HMAC-SHA256( "<svix-id>.<svix-timestamp>.<rawBody>", RESEND_WEBHOOK_SECRET ) ).
// Se RESEND_WEBHOOK_SECRET nao configurado, aceita sem verificar (DEV) — log warning.
//
// Configurar em Resend Dashboard > Webhooks:
//   URL    : https://<dominio>/api/disparo/webhook/resend
//   Eventos: email.delivered, email.bounced, email.complained, email.opened, email.clicked

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import pool from "@/lib/db";

export const runtime = "nodejs";

type ResendEvento = {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { type?: string };
  };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const id = req.headers.get("svix-id");
    const ts = req.headers.get("svix-timestamp");
    const sigHeader = req.headers.get("svix-signature");
    if (!id || !ts || !sigHeader) {
      return NextResponse.json({ ok: false, motivo: "headers svix ausentes" }, { status: 401 });
    }
    if (!verificarSvix(secret, id, ts, raw, sigHeader)) {
      return NextResponse.json({ ok: false, motivo: "assinatura invalida" }, { status: 401 });
    }
  } else {
    console.warn("[webhook/resend] RESEND_WEBHOOK_SECRET nao configurado — aceitando sem verificar");
  }

  let body: ResendEvento;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON invalido" }, { status: 400 });
  }

  const emailId = body.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, ignorado: "sem email_id" });
  }

  const novoStatus = mapearTipo(body.type);
  if (!novoStatus) {
    return NextResponse.json({ ok: true, ignorado: body.type });
  }

  try {
    const r = await pool.query<{ campanha_id: number; loja_id: number; destino: string }>(
      `UPDATE sevenconstruction.mkt_envios e
          SET status = $1,
              aberto_em = CASE WHEN $1 = 'aberto' AND e.aberto_em IS NULL THEN NOW() ELSE e.aberto_em END,
              clicou_em = CASE WHEN $1 = 'clicou' AND e.clicou_em IS NULL THEN NOW() ELSE e.clicou_em END,
              erro = COALESCE($2, e.erro)
        WHERE e.provider_id = $3
        RETURNING e.campanha_id, (
          SELECT loja_id FROM sevenconstruction.mkt_campanhas WHERE id = e.campanha_id
        ) AS loja_id, e.destino`,
      [
        novoStatus,
        body.data.bounce?.message ?? body.data.bounce?.subType ?? null,
        emailId,
      ],
    );

    // Auto-supressao em bounce hard ou complaint
    const ehBounceHard =
      body.type === "email.bounced" &&
      (body.data.bounce?.type === "hard" || body.data.bounce?.subType === "Permanent");
    const ehComplaint = body.type === "email.complained";

    if ((ehBounceHard || ehComplaint) && r.rows[0]) {
      await pool.query(
        `INSERT INTO sevenconstruction.mkt_supressoes
           (loja_id, destino, canal, motivo, origem)
         VALUES ($1, $2, 'email', $3, 'webhook:resend')
         ON CONFLICT (loja_id, destino, canal) DO NOTHING`,
        [
          r.rows[0].loja_id,
          r.rows[0].destino.toLowerCase(),
          ehComplaint ? "spam" : "bounce",
        ],
      );
    }

    return NextResponse.json({ ok: true, atualizados: r.rowCount ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook/resend] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao processar" }, { status: 500 });
  }
}

function mapearTipo(tipo: string): string | null {
  switch (tipo) {
    case "email.sent":
    case "email.delivered":
      return "enviado";
    case "email.opened":
      return "aberto";
    case "email.clicked":
      return "clicou";
    case "email.bounced":
    case "email.complained":
      return "falhou";
    default:
      return null;
  }
}

function verificarSvix(
  secret: string,
  id: string,
  ts: string,
  body: string,
  sigHeader: string,
): boolean {
  // secret tem prefixo "whsec_" — strippar
  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");

  const payload = `${id}.${ts}.${body}`;
  const expected = createHmac("sha256", key).update(payload).digest("base64");

  // Header tem formato "v1,<sig> v1,<sig> ..." — pode ter varios em rotacao
  const sigs = sigHeader.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  for (const sig of sigs) {
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {}
  }
  return false;
}
