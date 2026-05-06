import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarProdutos, criarProduto } from "@/lib/sistema-loja";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const url = new URL(req.url);
  const produtos = await listarProdutos(sessao.loja_id, {
    busca: url.searchParams.get("busca") || undefined,
    categoria: url.searchParams.get("categoria") || undefined,
    estoque_baixo: url.searchParams.get("estoque_baixo") === "1",
  });
  return NextResponse.json({ ok: true, produtos });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  const nome = String(body.nome || "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ ok: false, motivo: "Nome obrigatório" }, { status: 400 });
  }
  const id = await criarProduto({
    loja_id: sessao.loja_id, criado_por: sessao.id,
    nome,
    codigo: body.codigo as string | undefined,
    categoria: body.categoria as string | undefined,
    marca: body.marca as string | undefined,
    ncm: body.ncm as string | undefined,
    unidade: body.unidade as string | undefined,
    preco_custo: Number(body.preco_custo) || 0,
    preco_venda: Number(body.preco_venda) || 0,
    estoque_atual: Number(body.estoque_atual) || 0,
    estoque_minimo: Number(body.estoque_minimo) || 0,
  });
  return NextResponse.json({ ok: true, id });
}
