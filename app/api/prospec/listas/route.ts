import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarListasDaLoja, salvarLista, type EmpresaRfb } from "@/lib/prospec";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  const listas = await listarListasDaLoja(sessao.loja_id);
  return NextResponse.json({ ok: true, listas });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  let body: {
    nome?: string;
    cidade?: string;
    uf?: string;
    cnaes_alvo?: string[];
    apenas_ativas?: boolean;
    cep_centro?: string;
    raio_km?: number;
    itens?: EmpresaRfb[];
    filtros_extra?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const nome = (body.nome || "").trim().slice(0, 200);
  if (!nome) {
    return NextResponse.json({ ok: false, motivo: "Nome obrigatório" }, { status: 400 });
  }
  const itens = Array.isArray(body.itens) ? body.itens : [];
  if (itens.length === 0) {
    return NextResponse.json(
      { ok: false, motivo: "Lista vazia — selecione ao menos 1 empresa" },
      { status: 400 },
    );
  }
  if (itens.length > 1000) {
    return NextResponse.json(
      { ok: false, motivo: "Máximo 1000 itens por lista" },
      { status: 400 },
    );
  }

  try {
    const lista_id = await salvarLista({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      nome,
      cidade: body.cidade,
      uf: body.uf,
      cnaes_alvo: body.cnaes_alvo,
      apenas_ativas: body.apenas_ativas,
      cep_centro: body.cep_centro,
      raio_km: body.raio_km,
      filtros_extra: body.filtros_extra,
      itens,
    });
    return NextResponse.json({ ok: true, lista_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[prospec/listas POST] erro:", msg);
    return NextResponse.json(
      { ok: false, motivo: "Falha ao salvar lista" },
      { status: 500 },
    );
  }
}
