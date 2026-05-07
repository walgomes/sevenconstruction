import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { geocodificarCep } from "@/lib/geocoding";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }

  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  const r = await pool.query<{ cep: string | null }>(
    `SELECT cep FROM sevenconstruction.parceiros WHERE id = $1`, [n],
  );
  if (!r.rows[0]) return NextResponse.json({ ok: false, motivo: "nao encontrado" }, { status: 404 });

  const cep = r.rows[0].cep;
  if (!cep) return NextResponse.json({ ok: false, motivo: "sem CEP cadastrado" }, { status: 400 });

  const coords = await geocodificarCep(cep);
  if (!coords) return NextResponse.json({ ok: false, motivo: "CEP nao geocodificavel" }, { status: 422 });

  await pool.query(
    `UPDATE sevenconstruction.parceiros SET lat = $1, lng = $2, geocoded_em = NOW() WHERE id = $3`,
    [coords.lat, coords.lng, n],
  );
  return NextResponse.json({ ok: true, coords });
}
