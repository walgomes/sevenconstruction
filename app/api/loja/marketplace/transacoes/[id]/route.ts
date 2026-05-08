import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { mudarStatusTransacao } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  if (!b.status) return NextResponse.json({ ok: false, motivo: "status obrigatorio" }, { status: 400 });
  try {
    const ok = await mudarStatusTransacao(n, String(b.status), sessao.loja_id!);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
