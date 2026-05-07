// Geocodifica todos os parceiros que tem CEP mas ainda nao tem lat/lng.
// Concorrencia 1 quando cair no Nominatim (rate-limit 1/s) e ate 4 com BrasilAPI.

import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { geocodificarCep } from "@/lib/geocoding";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }

  const body = await req.json().catch(() => ({}));
  const limite = Math.min(Number(body.limite) || 50, 200);

  const r = await pool.query<{ id: number; cep: string }>(
    `SELECT id, cep FROM sevenconstruction.parceiros
      WHERE cep IS NOT NULL AND lat IS NULL
      ORDER BY id ASC LIMIT $1`,
    [limite],
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ ok: true, processados: 0, motivo: "nada pra geocodificar" });
  }

  const resultados: { id: number; ok: boolean; motivo?: string }[] = [];
  let ok = 0;

  for (const row of r.rows) {
    try {
      const coords = await geocodificarCep(row.cep);
      if (!coords) {
        resultados.push({ id: row.id, ok: false, motivo: "nao_geocodificavel" });
        continue;
      }
      await pool.query(
        `UPDATE sevenconstruction.parceiros SET lat = $1, lng = $2, geocoded_em = NOW() WHERE id = $3`,
        [coords.lat, coords.lng, row.id],
      );
      ok++;
      resultados.push({ id: row.id, ok: true });
    } catch (e) {
      resultados.push({ id: row.id, ok: false, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    processados: r.rows.length,
    sucesso: ok,
    falhas: r.rows.length - ok,
    resultados: resultados.slice(0, 50),
  });
}
