import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { listarSkus, adicionarSku } from "@/lib/skus";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const skus = await listarSkus(n);
  return NextResponse.json({ ok: true, skus });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const descricao = String(body.descricao ?? "").trim();
  if (!descricao) return NextResponse.json({ ok: false, motivo: "descricao obrigatoria" }, { status: 400 });

  const preco = body.preco_referencia != null ? Number(body.preco_referencia) : null;
  try {
    const sku = await adicionarSku({
      parceiro_id: n,
      ncm: typeof body.ncm === "string" ? body.ncm : null,
      sku: typeof body.sku === "string" ? body.sku : null,
      descricao,
      marca: typeof body.marca === "string" ? body.marca : null,
      unidade: typeof body.unidade === "string" ? body.unidade : null,
      norma_abnt: typeof body.norma_abnt === "string" ? body.norma_abnt : null,
      preco_referencia: preco != null && Number.isFinite(preco) ? preco : null,
    });
    return NextResponse.json({ ok: true, sku }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
