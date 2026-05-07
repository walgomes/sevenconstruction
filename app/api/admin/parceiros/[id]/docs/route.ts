import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  const r = await pool.query(
    `SELECT * FROM sevenconstruction.parceiros_docs WHERE parceiro_id = $1 ORDER BY criado_em DESC`,
    [n],
  );
  return NextResponse.json({ ok: true, docs: r.rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let sessao;
  try { sessao = await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  const body = await req.json().catch(() => ({}));
  const tipo_doc = String(body.tipo_doc || "outro").slice(0, 40);
  const nome = String(body.nome || "").trim();
  const url = String(body.url || "").trim();
  if (!nome || !url) return NextResponse.json({ ok: false, motivo: "nome e url obrigatorios" }, { status: 400 });

  const r = await pool.query(
    `INSERT INTO sevenconstruction.parceiros_docs (parceiro_id, tipo_doc, nome, url, uploaded_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [n, tipo_doc, nome, url, sessao.id],
  );
  return NextResponse.json({ ok: true, doc: r.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const { id } = await ctx.params;
  const n = Number(id);
  const sp = req.nextUrl.searchParams.get("doc_id");
  const docId = Number(sp);
  if (!Number.isFinite(docId)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await pool.query(
    `DELETE FROM sevenconstruction.parceiros_docs WHERE id = $1 AND parceiro_id = $2`,
    [docId, n],
  );
  return NextResponse.json({ ok: (r.rowCount ?? 0) > 0 });
}
