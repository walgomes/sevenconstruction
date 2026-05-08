import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarPropostas, lerKpisCredito } from "@/lib/credito";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || undefined;
  const limite = Math.min(Math.max(Number(sp.get("limite")) || 100, 1), 500);

  const [propostas, kpis] = await Promise.all([
    listarPropostas(sessao.loja_id!, { status, limite }),
    lerKpisCredito(sessao.loja_id!),
  ]);

  return NextResponse.json({ ok: true, propostas, kpis });
}
