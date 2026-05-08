import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const b = await req.json().catch(() => ({}));

  const sets: string[] = [];
  const args: unknown[] = [];
  const add = (col: string, v: unknown) => { args.push(v); sets.push(`${col} = $${args.length}`); };
  for (const k of [
    "nome","tipo","cnpj","taxa_minima_aa","taxa_maxima_aa","prazo_min_dias","prazo_max_dias",
    "ticket_min","ticket_max","comissao_loja_pct","status","adapter_codigo","observacoes",
  ]) {
    if (k in b) add(k, b[k]);
  }
  if (sets.length === 0) return NextResponse.json({ ok: false, motivo: "nada pra atualizar" }, { status: 400 });
  sets.push(`atualizado_em = NOW()`);
  args.push(n);
  const r = await pool.query(
    `UPDATE sevenconstruction.parceiros_financeiros SET ${sets.join(", ")} WHERE id = $${args.length}`,
    args,
  );
  return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  const r = await pool.query(`DELETE FROM sevenconstruction.parceiros_financeiros WHERE id = $1`, [n]);
  return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
}
