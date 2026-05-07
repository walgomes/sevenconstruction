// Webhook Meta WhatsApp Cloud API.
//
// GET  — verificacao inicial: Meta manda hub.mode=subscribe + hub.verify_token + hub.challenge.
//        Se token bater com META_WEBHOOK_VERIFY_TOKEN, devolvemos challenge em texto puro.
// POST — eventos: payload com entry[].changes[].value.statuses[] (sent, delivered, read, failed)
//        ou entry[].changes[].value.messages[] (mensagem inbound — fora de escopo aqui).
//        Autenticidade via header x-hub-signature-256 = "sha256=" + HMAC-SHA256(rawBody, META_APP_SECRET).
//
// Configurar no Meta Business Manager > WhatsApp > Configuration > Webhook:
//   URL    : https://<dominio>/api/disparo/webhook/meta
//   Token  : valor de META_WEBHOOK_VERIFY_TOKEN
//   Eventos: subscribe a "messages" (cobre statuses)

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    return new NextResponse("META_WEBHOOK_VERIFY_TOKEN not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

type MetaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string; message?: string }[];
};

type MetaWebhookBody = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        statuses?: MetaStatus[];
      };
    }[];
  }[];
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verificacao HMAC: Meta assina o body com META_APP_SECRET (App Settings > Basic).
  // Se nao configurado, log warning e segue (DEV) — em prod o env var DEVE estar setado.
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const sigHeader = req.headers.get("x-hub-signature-256");
    if (!sigHeader || !verificarMetaSignature(appSecret, raw, sigHeader)) {
      return NextResponse.json({ ok: false, motivo: "assinatura invalida" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[webhook/meta] META_APP_SECRET nao configurado em producao — rejeitando");
    return NextResponse.json({ ok: false, motivo: "config" }, { status: 500 });
  } else {
    console.warn("[webhook/meta] META_APP_SECRET nao configurado — aceitando sem verificar (DEV)");
  }

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const statuses: MetaStatus[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (s.id && s.status) statuses.push(s);
      }
    }
  }

  if (statuses.length === 0) {
    return NextResponse.json({ ok: true, processados: 0 });
  }

  let atualizados = 0;
  for (const s of statuses) {
    try {
      const novoStatus = mapearStatus(s.status);
      const erro = s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null;

      const r = await pool.query<{ campanha_id: number; loja_id: number; destino: string }>(
        `UPDATE sevenconstruction.mkt_envios e
            SET status = $1,
                erro = COALESCE($2, e.erro),
                aberto_em = CASE WHEN $1 = 'aberto' AND e.aberto_em IS NULL THEN NOW() ELSE e.aberto_em END
          WHERE e.provider_id = $3
          RETURNING e.campanha_id, (
            SELECT loja_id FROM sevenconstruction.mkt_campanhas WHERE id = e.campanha_id
          ) AS loja_id, e.destino`,
        [novoStatus, erro, s.id],
      );

      if (r.rowCount && r.rowCount > 0) {
        atualizados++;

        // Falha permanente do Meta → suprime para nao reenviar (depende do erro).
        // Codigos 131xxx/138xxx sao "user not on whatsapp" etc — supressao definitiva.
        const codigo = s.errors?.[0]?.code;
        const ehSupressavel =
          s.status === "failed" &&
          codigo &&
          (codigo === 131026 || codigo === 131047 || codigo === 131051 || codigo === 138000);
        if (ehSupressavel && r.rows[0]) {
          await pool.query(
            `INSERT INTO sevenconstruction.mkt_supressoes
               (loja_id, destino, canal, motivo, origem)
             VALUES ($1, $2, 'whatsapp', 'invalido', 'webhook:meta')
             ON CONFLICT (loja_id, destino, canal) DO NOTHING`,
            [r.rows[0].loja_id, r.rows[0].destino.toLowerCase()],
          );
        }
      }
    } catch (e) {
      console.error("[webhook/meta] erro ao atualizar status:", e);
    }
  }

  return NextResponse.json({ ok: true, processados: statuses.length, atualizados });
}

function mapearStatus(s: MetaStatus["status"]): string {
  switch (s) {
    case "sent": return "enviado";
    case "delivered": return "enviado";
    case "read": return "aberto";
    case "failed": return "falhou";
    default: return "enviado";
  }
}

function verificarMetaSignature(secret: string, raw: string, header: string): boolean {
  // Header tem formato "sha256=<hex>"
  const idx = header.indexOf("=");
  if (idx < 0) return false;
  const hexRecebido = header.slice(idx + 1);
  const hexEsperado = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  if (hexRecebido.length !== hexEsperado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(hexRecebido, "hex"), Buffer.from(hexEsperado, "hex"));
  } catch {
    return false;
  }
}
