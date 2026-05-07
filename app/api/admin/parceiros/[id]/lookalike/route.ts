import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { lookalike } from "@/lib/parceiros";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const similares = await lookalike(n, 10);
  return NextResponse.json({ ok: true, similares });
}
