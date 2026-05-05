import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { registrarIndicacao } from "@/lib/profissionais";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;

  let body: {
    profissional_id?: number;
    cliente_id?: number;
    valor_venda?: number;
    descricao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const profissional_id = Number(body.profissional_id);
  const valor_venda = Number(body.valor_venda);
  if (!Number.isFinite(profissional_id) || profissional_id <= 0) {
    return NextResponse.json({ ok: false, motivo: "profissional_id obrigatório" }, { status: 400 });
  }
  if (!Number.isFinite(valor_venda) || valor_venda <= 0) {
    return NextResponse.json({ ok: false, motivo: "valor_venda obrigatório" }, { status: 400 });
  }

  try {
    const id = await registrarIndicacao({
      loja_id: sessao.loja_id,
      profissional_id,
      cliente_id: body.cliente_id ?? null,
      valor_venda,
      descricao: body.descricao,
      criado_por: sessao.id,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Profissional nao encontrado|Cliente nao pertence/i.test(msg)) {
      return NextResponse.json({ ok: false, motivo: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: false, motivo: "Falha ao registrar indicação" }, { status: 500 });
  }
}
