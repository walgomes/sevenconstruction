import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarTransacoesLoja, criarTransacao } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const papel = req.nextUrl.searchParams.get("papel");
  const p: "compradora" | "fornecedora" | undefined =
    papel === "compradora" || papel === "fornecedora" ? papel : undefined;
  const r = await listarTransacoesLoja(sessao.loja_id!, p);
  return NextResponse.json({ ok: true, transacoes: r });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  const b = await req.json().catch(() => ({}));
  if (!b.oferta_id || !b.quantidade) {
    return NextResponse.json({ ok: false, motivo: "oferta_id e quantidade obrigatorios" }, { status: 400 });
  }
  try {
    const t = await criarTransacao({
      loja_compradora: sessao.loja_id!,
      oferta_id: Number(b.oferta_id),
      quantidade: Number(b.quantidade),
      preco_unit: b.preco_unit != null ? Number(b.preco_unit) : undefined,
      margem_pct: b.margem_pct != null ? Number(b.margem_pct) : undefined,
      observacoes: b.observacoes || undefined,
      demanda_id: b.demanda_id != null ? Number(b.demanda_id) : undefined,
    });
    return NextResponse.json({ ok: true, transacao: t }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
