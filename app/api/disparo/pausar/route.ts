import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { pausarCampanha } from "@/lib/disparo/worker";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  let body: { campanha_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  const campanha_id = Number(body.campanha_id);
  if (!Number.isFinite(campanha_id)) {
    return NextResponse.json({ ok: false, motivo: "campanha_id obrigatório" }, { status: 400 });
  }
  await pausarCampanha(sessao.loja_id, campanha_id);
  return NextResponse.json({ ok: true });
}
