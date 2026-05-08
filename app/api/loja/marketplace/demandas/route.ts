import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarDemandasLoja, criarDemanda } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const r = await listarDemandasLoja(sessao.loja_id!, status);
  return NextResponse.json({ ok: true, demandas: r });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  const b = await req.json().catch(() => ({}));
  if (!b.produto) return NextResponse.json({ ok: false, motivo: "produto obrigatorio" }, { status: 400 });
  try {
    const d = await criarDemanda({
      loja_id: sessao.loja_id!,
      cliente_id: b.cliente_id != null ? Number(b.cliente_id) : undefined,
      produto: String(b.produto),
      categoria: b.categoria || undefined,
      quantidade: b.quantidade != null ? Number(b.quantidade) : undefined,
      unidade: b.unidade || undefined,
      prazo_max_dias: b.prazo_max_dias != null ? Number(b.prazo_max_dias) : undefined,
      preco_max_un: b.preco_max_un != null ? Number(b.preco_max_un) : undefined,
      observacoes: b.observacoes || undefined,
    });
    return NextResponse.json({ ok: true, demanda: d }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
