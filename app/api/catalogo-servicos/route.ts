import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarServicosComAtivacao } from "@/lib/servicos";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  const servicos = await listarServicosComAtivacao(sessao.loja_id);
  return NextResponse.json({ ok: true, servicos });
}
