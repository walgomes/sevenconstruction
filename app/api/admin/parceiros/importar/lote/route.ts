import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { importarLote } from "@/lib/scrapers/guia-ic";
import { TIPOS_PARCEIRO, type TipoParceiro } from "@/lib/parceiros";

export const runtime = "nodejs";
export const maxDuration = 300; // ate 5min em Vercel Pro

const TIPOS_VALIDOS = new Set<TipoParceiro>(TIPOS_PARCEIRO.map((t) => t.valor));

export async function POST(req: NextRequest) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  let body: { urls?: unknown; tipo?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, motivo: "JSON invalido" }, { status: 400 }); }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ ok: false, motivo: "urls vazio" }, { status: 400 });
  }
  const urls = body.urls
    .filter((x): x is string => typeof x === "string")
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\/guiafornecedoresic\.com\.br\/_fornecedores\/[a-z0-9-]+\/?$/i.test(u));
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, motivo: "nenhuma URL valida" }, { status: 400 });
  }
  if (urls.length > 100) {
    return NextResponse.json({ ok: false, motivo: "max 100 URLs por lote" }, { status: 400 });
  }

  const tipo = body.tipo as TipoParceiro;
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json({ ok: false, motivo: "tipo invalido" }, { status: 400 });
  }

  const resultados = await importarLote(urls, tipo);
  const sucesso = resultados.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    total: resultados.length,
    sucesso,
    falhas: resultados.length - sucesso,
    resultados,
  });
}
