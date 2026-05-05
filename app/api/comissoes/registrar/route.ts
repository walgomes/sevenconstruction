import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { registrarVendaServico } from "@/lib/comissoes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;

  let body: {
    cliente_id?: number;
    servico_id?: number;
    valor_venda?: number;
    descricao?: string;
    codigo_indicacao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const servico_id = Number(body.servico_id);
  if (!Number.isFinite(servico_id) || servico_id <= 0) {
    return NextResponse.json({ ok: false, motivo: "servico_id obrigatório" }, { status: 400 });
  }

  try {
    const id = await registrarVendaServico({
      loja_id: sessao.loja_id,
      cliente_id: body.cliente_id ?? null,
      servico_id,
      valor_venda: body.valor_venda,
      descricao: body.descricao,
      codigo_indicacao: body.codigo_indicacao,
      criado_por: sessao.id,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Servico nao encontrado|Cliente nao pertence/i.test(msg)) {
      return NextResponse.json({ ok: false, motivo: msg }, { status: 400 });
    }
    console.error("[comissoes/registrar] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao registrar venda" }, { status: 500 });
  }
}
