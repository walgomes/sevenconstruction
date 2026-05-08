import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { criarPortalSession } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:8800";
  const origemUrl = `${proto}://${host}`;

  try {
    const url = await criarPortalSession({ loja_id: sessao.loja_id!, origem_url: origemUrl });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nao configurado")) {
      return NextResponse.json({ ok: false, motivo: msg }, { status: 503 });
    }
    return NextResponse.json({ ok: false, motivo: msg }, { status: 500 });
  }
}
