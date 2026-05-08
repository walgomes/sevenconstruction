import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarOfertasLoja, criarOferta, alternarAtivoOferta, removerOferta } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const r = await listarOfertasLoja(sessao.loja_id!);
  return NextResponse.json({ ok: true, ofertas: r });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  const b = await req.json().catch(() => ({}));
  if (!b.produto) return NextResponse.json({ ok: false, motivo: "produto obrigatorio" }, { status: 400 });
  try {
    const o = await criarOferta({
      loja_id: sessao.loja_id!,
      produto: String(b.produto),
      categoria: b.categoria || undefined,
      unidade: b.unidade || undefined,
      preco_atacado: b.preco_atacado != null ? Number(b.preco_atacado) : undefined,
      estoque_min: b.estoque_min != null ? Number(b.estoque_min) : undefined,
      prazo_entrega_dias: b.prazo_entrega_dias != null ? Number(b.prazo_entrega_dias) : undefined,
      raio_entrega_km: b.raio_entrega_km != null ? Number(b.raio_entrega_km) : undefined,
      observacoes: b.observacoes || undefined,
    });
    return NextResponse.json({ ok: true, oferta: o }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await alternarAtivoOferta(id, sessao.loja_id!);
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await removerOferta(id, sessao.loja_id!);
  return NextResponse.json({ ok });
}
