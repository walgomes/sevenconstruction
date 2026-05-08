import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listar, marcarTodasLidas } from "@/lib/notificacoes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const sp = req.nextUrl.searchParams;
  const r = await listar({
    loja_id: sessao.loja_id!,
    user_id: sessao.id,
    apenas_nao_lidas: sp.get("nao_lidas") === "1",
    tipo: sp.get("tipo") || undefined,
    limite: Number(sp.get("limite")) || 50,
  });
  return NextResponse.json({ ok: true, notificacoes: r });
}

export async function POST(req: NextRequest) {
  // POST sem body = marcar todas como lidas
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const n = await marcarTodasLidas(sessao.loja_id!, sessao.id);
  return NextResponse.json({ ok: true, marcadas: n });
}
