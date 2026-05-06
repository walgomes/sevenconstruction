import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarNotasEntrada, criarNotaEntrada } from "@/lib/sistema-loja";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const notas = await listarNotasEntrada(sessao.loja_id);
  return NextResponse.json({ ok: true, notas });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  const numero = String(body.numero || "").trim();
  const valor_produtos = Number(body.valor_produtos);
  if (!numero || !Number.isFinite(valor_produtos) || valor_produtos <= 0) {
    return NextResponse.json({ ok: false, motivo: "numero e valor_produtos obrigatórios" }, { status: 400 });
  }
  const id = await criarNotaEntrada({
    loja_id: sessao.loja_id, criado_por: sessao.id,
    numero,
    serie: body.serie as string | undefined,
    fornecedor_id: body.fornecedor_id ? Number(body.fornecedor_id) : undefined,
    fornecedor_nome: body.fornecedor_nome as string | undefined,
    fornecedor_cnpj: body.fornecedor_cnpj as string | undefined,
    data_emissao: body.data_emissao as string | undefined,
    data_entrada: body.data_entrada as string | undefined,
    valor_produtos,
    valor_frete: Number(body.valor_frete) || 0,
    valor_desconto: Number(body.valor_desconto) || 0,
  });
  return NextResponse.json({ ok: true, id });
}
