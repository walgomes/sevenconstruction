import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarContasPagar, criarContaPagar, pagarConta } from "@/lib/sistema-loja";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const url = new URL(req.url);
  const contas = await listarContasPagar(sessao.loja_id, url.searchParams.get("status") || undefined);
  return NextResponse.json({ ok: true, contas });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  // Acao especial: marcar como paga
  if (body.acao === "pagar" && Number(body.id)) {
    await pagarConta(sessao.loja_id, Number(body.id), body.valor_pago ? Number(body.valor_pago) : undefined);
    return NextResponse.json({ ok: true });
  }

  const descricao = String(body.descricao || "").trim();
  const valor = Number(body.valor);
  const vencimento = String(body.vencimento || "");
  if (descricao.length < 2 || !Number.isFinite(valor) || valor <= 0 || !vencimento) {
    return NextResponse.json({ ok: false, motivo: "descricao, valor e vencimento obrigatórios" }, { status: 400 });
  }
  const id = await criarContaPagar({
    loja_id: sessao.loja_id, criado_por: sessao.id,
    descricao, valor, vencimento,
    fornecedor_id: body.fornecedor_id ? Number(body.fornecedor_id) : undefined,
    categoria_despesa: body.categoria_despesa as string | undefined,
    forma_pagamento: body.forma_pagamento as string | undefined,
  });
  return NextResponse.json({ ok: true, id });
}
