import { NextRequest, NextResponse } from "next/server";
import { exigirSuper, type SessaoSc } from "@/lib/auth";
import { mudarFase } from "@/lib/parceiros";
import { FASES_HOMOLOG, type FaseHomolog } from "@/lib/parceiros-tipos";
import pool from "@/lib/db";

export const runtime = "nodejs";

const FASES_VALIDAS = new Set<FaseHomolog>(FASES_HOMOLOG.map((f) => f.valor));

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let sessao: SessaoSc;
  try {
    sessao = await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  let body: { fase?: string; motivo?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const fase = body.fase as FaseHomolog;
  if (!FASES_VALIDAS.has(fase)) {
    return NextResponse.json({ ok: false, motivo: "fase invalida" }, { status: 400 });
  }

  // Pega nome do super pra log
  const nomeRow = await pool.query<{ nome: string }>(
    `SELECT nome FROM sevenconstruction.super_admins WHERE id = $1`,
    [sessao.id],
  );
  const nome = nomeRow.rows[0]?.nome ?? `super#${sessao.id}`;

  const p = await mudarFase(n, fase, { id: sessao.id, tipo: "humano", nome }, { motivo: body.motivo });
  if (!p) return NextResponse.json({ ok: false, motivo: "nao encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, parceiro: p });
}
