import { NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { listarSitemap, FONTE_GUIA } from "@/lib/scrapers/guia-ic";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  try {
    const itens = await listarSitemap();

    // Marca quais ja foram importados antes
    const r = await pool.query<{ url: string }>(
      `SELECT url FROM sevenconstruction.parceiros_fontes WHERE fonte = $1`,
      [FONTE_GUIA],
    );
    const ja = new Set(r.rows.map((x) => x.url));

    return NextResponse.json({
      ok: true,
      total: itens.length,
      ja_importados: ja.size,
      itens: itens.map((i) => ({ ...i, ja_importado: ja.has(i.url) })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
