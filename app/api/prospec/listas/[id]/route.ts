import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { lerListaComItens } from "@/lib/prospec";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const lista_id = parseInt(id, 10);
  if (!Number.isFinite(lista_id)) {
    return NextResponse.json({ ok: false, motivo: "ID inválido" }, { status: 400 });
  }

  const dados = await lerListaComItens(lista_id, sessao.loja_id);
  if (!dados) {
    return NextResponse.json({ ok: false, motivo: "Lista não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...dados });
}
