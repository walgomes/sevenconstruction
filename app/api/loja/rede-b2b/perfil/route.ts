import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarPerfilB2B, salvarPerfilB2B, type PerfilB2B } from "@/lib/rede-b2b/rede";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  const cnpj = req.nextUrl.searchParams.get("cnpj") || "";
  if (cnpj.replace(/\D/g, "").length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }
  const perfil = await buscarPerfilB2B(cnpj);
  return NextResponse.json({ perfil });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { cnpj?: string; dados?: Partial<PerfilB2B> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  if (!body.cnpj || (body.cnpj || "").replace(/\D/g, "").length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  try {
    const perfil = await salvarPerfilB2B(body.cnpj, body.dados ?? {});
    return NextResponse.json({ ok: true, perfil });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
