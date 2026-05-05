import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import {
  listarClientesLoja,
  criarClienteManual,
  type FiltroClientes,
} from "@/lib/clientes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  const url = new URL(req.url);
  const filtro: FiltroClientes = {
    loja_id: sessao.loja_id,
    cidade: url.searchParams.get("cidade") || undefined,
    rating: url.searchParams.get("rating") || undefined,
    origem: url.searchParams.get("origem") || undefined,
    busca: url.searchParams.get("busca") || undefined,
    limite: parseInt(url.searchParams.get("limite") || "200", 10),
  };

  try {
    const clientes = await listarClientesLoja(filtro);
    return NextResponse.json({ ok: true, total: clientes.length, clientes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[clientes-base GET] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao listar clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  let body: {
    tipo_pessoa?: "J" | "F";
    cnpj?: string;
    cpf?: string;
    nome_razao?: string;
    nome_fantasia?: string;
    email?: string;
    telefone?: string;
    whatsapp?: string;
    cidade?: string;
    uf?: string;
    bairro?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  if (!body.nome_razao || body.nome_razao.trim().length < 2) {
    return NextResponse.json({ ok: false, motivo: "Nome obrigatório" }, { status: 400 });
  }
  if (!body.tipo_pessoa || !["J", "F"].includes(body.tipo_pessoa)) {
    return NextResponse.json({ ok: false, motivo: "Tipo inválido" }, { status: 400 });
  }

  try {
    const id = await criarClienteManual({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      tipo_pessoa: body.tipo_pessoa,
      cnpj: body.cnpj,
      cpf: body.cpf,
      nome_razao: body.nome_razao,
      nome_fantasia: body.nome_fantasia,
      email: body.email,
      telefone: body.telefone,
      whatsapp: body.whatsapp,
      cidade: body.cidade,
      uf: body.uf,
      bairro: body.bairro,
      origem: "manual",
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/CNPJ invalido|CPF invalido/i.test(msg)) {
      return NextResponse.json({ ok: false, motivo: msg }, { status: 400 });
    }
    console.error("[clientes-base POST] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao criar cliente" }, { status: 500 });
  }
}
