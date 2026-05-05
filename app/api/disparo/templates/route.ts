import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarTemplates, criarTemplate } from "@/lib/marketing";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const canal = url.searchParams.get("canal") || undefined;
  const templates = await listarTemplates(sessao.loja_id, canal);
  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }
  let body: { nome?: string; canal?: "email" | "whatsapp"; assunto?: string; corpo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }
  if (!body.nome || !body.canal || !body.corpo) {
    return NextResponse.json({ ok: false, motivo: "Nome, canal e corpo obrigatórios" }, { status: 400 });
  }
  if (!["email", "whatsapp"].includes(body.canal)) {
    return NextResponse.json({ ok: false, motivo: "Canal inválido" }, { status: 400 });
  }

  try {
    const id = await criarTemplate({
      loja_id: sessao.loja_id,
      criado_por: sessao.id,
      nome: body.nome,
      canal: body.canal,
      assunto: body.assunto,
      corpo: body.corpo,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[disparo/templates POST] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao criar template" }, { status: 500 });
  }
}
