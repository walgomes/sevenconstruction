// IA marketing — gera 3 templates (1 email + 2 WhatsApp) pra loja.
// POST sem body: gera pra loja do user logado.
// POST com x-sc-admin-key: gera pra todas as lojas (cron diario).

import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import {
  gerarTemplatesParaLoja,
  gerarParaTodasLojas,
} from "@/lib/disparo/ia-marketing";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-sc-admin-key");
  const expected = process.env.SC_ADMIN_API_KEY;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const isAdmin =
    (apiKey && expected && apiKey === expected) ||
    (bearer && cronSecret && bearer === cronSecret);

  if (isAdmin) {
    try {
      const r = await gerarParaTodasLojas();
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, motivo: msg }, { status: 500 });
    }
  }

  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  try {
    const r = await gerarTemplatesParaLoja(sessao.loja_id);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, motivo: r.motivo },
        { status: r.motivo === "Ja gerou hoje" ? 409 : 500 },
      );
    }
    return NextResponse.json({ ok: true, inseridos: r.inseridos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ia-gerar] erro:", msg);
    return NextResponse.json({ ok: false, motivo: msg }, { status: 500 });
  }
}
