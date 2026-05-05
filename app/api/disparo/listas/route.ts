import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarListasMkt, criarListaMkt, importarDeProspec } from "@/lib/marketing";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  const listas = await listarListasMkt(sessao.loja_id);
  return NextResponse.json({ ok: true, listas });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  let body: { nome?: string; descricao?: string; prospec_lista_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  if (!body.nome || body.nome.trim().length < 2) {
    return NextResponse.json({ ok: false, motivo: "Nome obrigatório" }, { status: 400 });
  }

  try {
    const lista_id = await criarListaMkt({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      nome: body.nome,
      descricao: body.descricao,
      origem: body.prospec_lista_id ? "prospec" : "manual",
      prospec_lista_id: body.prospec_lista_id ?? null,
    });

    let importados = 0;
    if (body.prospec_lista_id) {
      importados = await importarDeProspec(sessao.loja_id, body.prospec_lista_id, lista_id);
    }
    return NextResponse.json({ ok: true, lista_id, importados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[disparo/listas POST] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao criar lista" }, { status: 500 });
  }
}
