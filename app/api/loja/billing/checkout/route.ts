import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { criarCheckoutSession } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 10 });
  if (sessao instanceof NextResponse) return sessao;

  const b = await req.json().catch(() => ({}));
  const plano = String(b.plano_codigo || "").trim();
  if (!["starter", "pro", "enterprise"].includes(plano)) {
    return NextResponse.json({ ok: false, motivo: "plano_codigo invalido" }, { status: 400 });
  }

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:8800";
  const origemUrl = `${proto}://${host}`;

  try {
    const url = await criarCheckoutSession({
      loja_id: sessao.loja_id!,
      plano_codigo: plano,
      origem_url: origemUrl,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nao configurado")) {
      return NextResponse.json({ ok: false, motivo: msg }, { status: 503 });
    }
    return NextResponse.json({ ok: false, motivo: msg }, { status: 500 });
  }
}
