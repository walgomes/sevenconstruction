import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { buscarMatches } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const sp = req.nextUrl.searchParams;
  const r = await buscarMatches({
    loja_origem: sessao.loja_id!,
    produto: sp.get("produto") || undefined,
    categoria: sp.get("categoria") || undefined,
    preco_max: sp.get("preco_max") ? Number(sp.get("preco_max")) : undefined,
    prazo_max_dias: sp.get("prazo_max_dias") ? Number(sp.get("prazo_max_dias")) : undefined,
    limite: Number(sp.get("limite")) || 50,
  });
  return NextResponse.json({ ok: true, ofertas: r });
}
