import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { criarIndicacao, listarIndicacoes } from "@/lib/fidelizacao";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const cliente = Number(req.nextUrl.searchParams.get("cliente_origem"));
  if (!Number.isFinite(cliente)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await listarIndicacoes(cliente);
  return NextResponse.json({ ok: true, indicacoes: r });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  const b = await req.json().catch(() => ({}));
  const cliente_origem = Number(b.cliente_origem);
  if (!Number.isFinite(cliente_origem) || !b.nome_indicado || !b.contato_indicado) {
    return NextResponse.json({ ok: false, motivo: "campos obrigatorios faltando" }, { status: 400 });
  }
  try {
    const r = await criarIndicacao({
      loja_id: sessao.loja_id!,
      cliente_origem,
      nome_indicado: String(b.nome_indicado),
      contato_indicado: String(b.contato_indicado),
      recompensa_pontos: Number(b.recompensa_pontos) || undefined,
    });
    return NextResponse.json({ ok: true, indicacao: r }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
