import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarFornecedores, criarFornecedor } from "@/lib/sistema-loja";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const url = new URL(req.url);
  const fornecedores = await listarFornecedores(
    sessao.loja_id,
    url.searchParams.get("busca") || undefined,
  );
  return NextResponse.json({ ok: true, fornecedores });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  const razao = String(body.razao_social || "").trim();
  if (razao.length < 2) {
    return NextResponse.json({ ok: false, motivo: "Razão social obrigatória" }, { status: 400 });
  }
  const id = await criarFornecedor({
    loja_id: sessao.loja_id, criado_por: sessao.id,
    razao_social: razao,
    cnpj: body.cnpj as string | undefined,
    nome_fantasia: body.nome_fantasia as string | undefined,
    email: body.email as string | undefined,
    telefone: body.telefone as string | undefined,
    whatsapp: body.whatsapp as string | undefined,
    cidade: body.cidade as string | undefined,
    uf: body.uf as string | undefined,
    prazo_pagamento_dias: Number(body.prazo_pagamento_dias) || 0,
    condicao_pagamento: body.condicao_pagamento as string | undefined,
    pix_chave: body.pix_chave as string | undefined,
  });
  return NextResponse.json({ ok: true, id });
}
