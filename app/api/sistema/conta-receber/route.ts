import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarContasReceber, criarContaReceber, receberConta } from "@/lib/sistema-loja";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const url = new URL(req.url);
  const contas = await listarContasReceber(sessao.loja_id, url.searchParams.get("status") || undefined);
  return NextResponse.json({ ok: true, contas });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  if (body.acao === "receber" && Number(body.id)) {
    await receberConta(sessao.loja_id, Number(body.id), body.valor_recebido ? Number(body.valor_recebido) : undefined);
    return NextResponse.json({ ok: true });
  }

  const descricao = String(body.descricao || "").trim();
  const valor = Number(body.valor);
  const vencimento = String(body.vencimento || "");
  if (descricao.length < 2 || !Number.isFinite(valor) || valor <= 0 || !vencimento) {
    return NextResponse.json({ ok: false, motivo: "descricao, valor e vencimento obrigatórios" }, { status: 400 });
  }
  const id = await criarContaReceber({
    loja_id: sessao.loja_id, criado_por: sessao.id,
    descricao, valor, vencimento,
    cliente_id: body.cliente_id ? Number(body.cliente_id) : undefined,
    origem: body.origem as string | undefined,
  });
  return NextResponse.json({ ok: true, id });
}
