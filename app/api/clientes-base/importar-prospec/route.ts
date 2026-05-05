import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { importarClientesDeProspec } from "@/lib/clientes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rate limit apertado: import pode ser caro (puxa milhares de rows)
  const sessao = await exigirLojaUser(req, { rate_limite: 5 });
  if (sessao instanceof NextResponse) return sessao;

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
