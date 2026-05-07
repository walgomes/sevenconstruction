import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { extrairDetalhe } from "@/lib/scrapers/guia-ic";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, motivo: "JSON invalido" }, { status: 400 }); }

  const url = (body.url || "").trim();
  if (!/^https?:\/\/guiafornecedoresic\.com\.br\/_fornecedores\/[a-z0-9-]+\/?$/i.test(url)) {
    return NextResponse.json({ ok: false, motivo: "URL deve apontar pra um fornecedor do guiafornecedoresic.com.br" }, { status: 400 });
  }

  try {
    const detalhe = await extrairDetalhe(url);
    return NextResponse.json({ ok: true, detalhe });
  } catch (e) {
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
