import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { alternarAtivoUsuario } from "@/lib/convites";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  // So dono pode mexer
  const dono = await pool.query<{ papel: string }>(
    `SELECT papel FROM sevenconstruction.loja_users WHERE id = $1 AND loja_id = $2`,
    [sessao.id, sessao.loja_id],
  );
  if (dono.rows[0]?.papel !== "dono") {
    return NextResponse.json({ ok: false, motivo: "Apenas dono pode gerenciar usuarios" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const ok = await alternarAtivoUsuario(n, sessao.loja_id!);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
