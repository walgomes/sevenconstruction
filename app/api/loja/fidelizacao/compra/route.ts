import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { registrarCompra } from "@/lib/fidelizacao";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;

  const b = await req.json().catch(() => ({}));
  const cliente_id = Number(b.cliente_id);
  const valor_brl = Number(b.valor_brl);
  if (!Number.isFinite(cliente_id) || !Number.isFinite(valor_brl) || valor_brl <= 0) {
    return NextResponse.json({ ok: false, motivo: "cliente_id e valor_brl > 0 obrigatorios" }, { status: 400 });
  }
  try {
    const m = await registrarCompra({ cliente_id, loja_id: sessao.loja_id!, valor_brl, descricao: b.descricao });
    return NextResponse.json({ ok: true, movimento: m }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
