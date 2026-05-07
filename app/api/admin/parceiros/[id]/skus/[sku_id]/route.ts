import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { removerSku } from "@/lib/skus";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sku_id: string }> },
) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id, sku_id } = await ctx.params;
  const n = Number(id);
  const s = Number(sku_id);
  if (!Number.isFinite(n) || !Number.isFinite(s)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await removerSku(s, n);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
