import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { importarClientesDeProspec } from "@/lib/clientes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  let body: { prospec_lista_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const prospec_lista_id = Number(body.prospec_lista_id);
  if (!Number.isFinite(prospec_lista_id) || prospec_lista_id <= 0) {
    return NextResponse.json({ ok: false, motivo: "prospec_lista_id obrigatório" }, { status: 400 });
  }

  try {
    const r = await importarClientesDeProspec(
      sessao.loja_id,
      prospec_lista_id,
      sessao.id,
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[importar-prospec] erro:", msg);
    return NextResponse.json(
      { ok: false, motivo: "Falha ao importar" },
      { status: 500 },
    );
  }
}
