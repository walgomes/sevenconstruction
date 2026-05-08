import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const r = await pool.query(
    `SELECT id, nome, tipo, cnpj, taxa_minima_aa::float AS taxa_minima_aa,
            taxa_maxima_aa::float AS taxa_maxima_aa,
            prazo_min_dias, prazo_max_dias,
            ticket_min::float AS ticket_min, ticket_max::float AS ticket_max,
            comissao_loja_pct::float AS comissao_loja_pct,
            status, adapter_codigo, observacoes, criado_em::text AS criado_em
       FROM sevenconstruction.parceiros_financeiros
      ORDER BY status DESC, nome ASC`,
  );
  return NextResponse.json({ ok: true, parceiros: r.rows });
}

export async function POST(req: NextRequest) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  const b = await req.json().catch(() => ({}));
  if (!b.nome || !b.tipo) return NextResponse.json({ ok: false, motivo: "nome e tipo obrigatorios" }, { status: 400 });

  const r = await pool.query(
    `INSERT INTO sevenconstruction.parceiros_financeiros
       (nome, tipo, cnpj, taxa_minima_aa, taxa_maxima_aa, prazo_min_dias, prazo_max_dias,
        ticket_min, ticket_max, comissao_loja_pct, status, adapter_codigo, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      String(b.nome).trim(),
      String(b.tipo).trim(),
      b.cnpj ? String(b.cnpj).replace(/\D+/g, "") : null,
      b.taxa_minima_aa ?? null,
      b.taxa_maxima_aa ?? null,
      b.prazo_min_dias ?? null,
      b.prazo_max_dias ?? null,
      b.ticket_min ?? null,
      b.ticket_max ?? null,
      b.comissao_loja_pct ?? null,
      String(b.status ?? "avaliacao"),
      b.adapter_codigo ?? null,
      b.observacoes ?? null,
    ],
  );
  return NextResponse.json({ ok: true, id: r.rows[0].id }, { status: 201 });
}
