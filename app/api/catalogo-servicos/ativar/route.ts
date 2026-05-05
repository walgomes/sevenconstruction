import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { ativarServicoNaLoja } from "@/lib/servicos";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  let body: { servico_id?: number; ativo?: boolean; preco_venda_custom?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const servico_id = Number(body.servico_id);
  if (!Number.isFinite(servico_id) || servico_id <= 0) {
    return NextResponse.json({ ok: false, motivo: "servico_id obrigatório" }, { status: 400 });
  }

  const ativo = body.ativo !== false;
  const preco = body.preco_venda_custom != null ? Number(body.preco_venda_custom) : null;
  if (preco != null && (!Number.isFinite(preco) || preco < 0)) {
    return NextResponse.json({ ok: false, motivo: "preço inválido" }, { status: 400 });
  }

  try {
    await ativarServicoNaLoja(sessao.loja_id, servico_id, ativo, preco);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[catalogo-servicos/ativar] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao salvar" }, { status: 500 });
  }
}
