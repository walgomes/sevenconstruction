// Worker de envio. Pode ser chamado:
//  - Pelo super-admin com x-sc-admin-key (cron externo, GitHub Action)
//  - Por loja_user logada (dispara processamento manual)
//
// Processa um batch (default 20 envios). Idempotente.

import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { processarBatch } from "@/lib/disparo/worker";
import { statusProviders } from "@/lib/disparo/adapters";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-sc-admin-key");
  const expected = process.env.SC_ADMIN_API_KEY;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const isAdmin =
    (apiKey && expected && apiKey === expected) ||
    (bearer && cronSecret && bearer === cronSecret);

  if (!isAdmin) {
    const sessao = await lerSessao();
    if (!sessao || sessao.role !== "loja_user") {
      return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const batchSize = Math.min(
    Math.max(parseInt(url.searchParams.get("batch") || "20", 10), 1),
    100,
  );

  try {
    const r = await processarBatch(batchSize);
    return NextResponse.json({
      ok: true,
      providers: statusProviders(),
      ...r,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[disparo/processar] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao processar batch" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
