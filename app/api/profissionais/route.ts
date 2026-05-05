import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import {
  listarProfissionais,
  criarProfissional,
  resumoProfissionais,
} from "@/lib/profissionais";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const url = new URL(req.url);
  const [profissionais, resumo] = await Promise.all([
    listarProfissionais({
      loja_id: sessao.loja_id,
      categoria: url.searchParams.get("categoria") || undefined,
      cidade: url.searchParams.get("cidade") || undefined,
      busca: url.searchParams.get("busca") || undefined,
    }),
    resumoProfissionais(sessao.loja_id),
  ]);
  return NextResponse.json({ ok: true, profissionais, resumo });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  let body: {
    nome?: string;
    categoria?: string;
    telefone?: string;
    whatsapp?: string;
    email?: string;
    cidade?: string;
    uf?: string;
    bairro?: string;
    cpf?: string;
    cnpj?: string;
    especialidade?: string;
    anos_experiencia?: number;
    comissao_pct?: number;
    comissao_fixa?: number;
    observacoes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  if (!body.nome || body.nome.trim().length < 2) {
    return NextResponse.json({ ok: false, motivo: "Nome obrigatório" }, { status: 400 });
  }
  if (!body.categoria) {
    return NextResponse.json({ ok: false, motivo: "Categoria obrigatória" }, { status: 400 });
  }

  try {
    const r = await criarProfissional({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      nome: body.nome,
      categoria: body.categoria,
      telefone: body.telefone,
      whatsapp: body.whatsapp,
      email: body.email,
      cidade: body.cidade,
      uf: body.uf,
      bairro: body.bairro,
      cpf: body.cpf,
      cnpj: body.cnpj,
      especialidade: body.especialidade,
      anos_experiencia: body.anos_experiencia,
      comissao_pct: body.comissao_pct,
      comissao_fixa: body.comissao_fixa,
      observacoes: body.observacoes,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate key/i.test(msg)) {
      return NextResponse.json(
        { ok: false, motivo: "Profissional já cadastrado (CPF/CNPJ duplicado)" },
        { status: 409 },
      );
    }
    console.error("[profissionais POST] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao cadastrar" }, { status: 500 });
  }
}
