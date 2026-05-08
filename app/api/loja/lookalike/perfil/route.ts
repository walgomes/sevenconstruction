import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { extrairPerfil } from "@/lib/lookalike/perfil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { cnpjs?: string | string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  if (!body.cnpjs) return NextResponse.json({ error: "Campo 'cnpjs' obrigatório" }, { status: 400 });

  try {
    const perfil = await extrairPerfil(typeof body.cnpjs === "string" ? [body.cnpjs] : body.cnpjs);
    return NextResponse.json({ ok: true, perfil });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
