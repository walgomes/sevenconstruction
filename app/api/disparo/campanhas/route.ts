import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarCampanhas, criarCampanha } from "@/lib/marketing";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  const campanhas = await listarCampanhas(sessao.loja_id);
  return NextResponse.json({ ok: true, campanhas });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  let body: {
    nome?: string;
    canal?: "email" | "whatsapp";
    lista_id?: number;
    template_id?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  if (!body.nome || !body.canal || !body.lista_id) {
    return NextResponse.json(
      { ok: false, motivo: "Nome, canal e lista_id obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const id = await criarCampanha({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      nome: body.nome,
      canal: body.canal,
      lista_id: body.lista_id,
      template_id: body.template_id,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[disparo/campanhas POST] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao criar campanha" }, { status: 500 });
  }
}
