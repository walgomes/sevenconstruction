import { NextRequest, NextResponse } from "next/server";
import { lerSessaoCliente } from "@/lib/cliente-auth";
import { criarIndicacao } from "@/lib/fidelizacao";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await lerSessaoCliente();
  if (!sessao) return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.nome_indicado || !b.contato_indicado) {
    return NextResponse.json({ ok: false, motivo: "campos obrigatorios" }, { status: 400 });
  }
  try {
    const r = await criarIndicacao({
      loja_id: sessao.loja_id,
      cliente_origem: sessao.cliente_id,
      nome_indicado: String(b.nome_indicado),
      contato_indicado: String(b.contato_indicado),
    });
    return NextResponse.json({ ok: true, indicacao: r });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
