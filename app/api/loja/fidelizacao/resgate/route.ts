import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { resgatar } from "@/lib/fidelizacao";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  const b = await req.json().catch(() => ({}));
  const cliente_id = Number(b.cliente_id);
  const pontos = Number(b.pontos);
  if (!Number.isFinite(cliente_id) || !Number.isFinite(pontos) || pontos <= 0) {
    return NextResponse.json({ ok: false, motivo: "cliente_id e pontos > 0 obrigatorios" }, { status: 400 });
  }
  try {
    const m = await resgatar({ cliente_id, loja_id: sessao.loja_id!, pontos, descricao: b.descricao });
    return NextResponse.json({ ok: true, movimento: m }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
