import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { lerResumoComissoes, listarEventosComissao } from "@/lib/comissoes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limite = parseInt(url.searchParams.get("limite") || "50", 10);

  const [resumo, eventos] = await Promise.all([
    lerResumoComissoes(sessao.loja_id),
    listarEventosComissao(sessao.loja_id, limite),
  ]);

  return NextResponse.json({ ok: true, resumo, eventos });
}
