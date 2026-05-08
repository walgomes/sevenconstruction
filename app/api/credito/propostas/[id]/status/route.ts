import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { mudarStatusProposta } from "@/lib/credito";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  let body: { status?: string; numero_proposta?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.status) return NextResponse.json({ ok: false, motivo: "status obrigatorio" }, { status: 400 });

  try {
    const ok = await mudarStatusProposta(n, sessao.loja_id!, body.status, body.numero_proposta);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
