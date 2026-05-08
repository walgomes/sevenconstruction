/**
 * GET /api/loja/rede-b2b/trending
 *
 * Empresas em movimento na janela informada (?dias=7).
 * Cruza eventos da sevendb (cnpj_eventos) → dados RFB (empresas) →
 * marca quem ja tem perfil declarado na rede SC.
 */

import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { rfbQuery } from "@/lib/rfb-db";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const dias = Math.min(Math.max(Number(sp.get("dias")) || 7, 1), 90);
  const limite = Math.min(Math.max(Number(sp.get("limite")) || 100, 10), 500);
  const ufs = (sp.get("uf") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  // 1) Pega CNPJs com mais eventos no periodo (na sevendb)
  const condUf = ufs.length ? `AND e.uf = ANY($3::text[])` : "";
  const params: unknown[] = [`${dias} days`, limite];
  if (ufs.length) params.push(ufs);

  let agg: Array<Record<string, unknown>> = [];
  try {
    agg = await rfbQuery(
      `WITH base AS (
         SELECT cnpj_eventos.cnpj,
                count(*)::int AS total,
                count(*) FILTER (WHERE COALESCE(ocorreu_em, capturado_em::date) > now() - interval '24 hours')::int AS ult_24h,
                count(*) FILTER (WHERE COALESCE(ocorreu_em, capturado_em::date) > now() - interval '7 days')::int AS ult_7d,
                array_agg(DISTINCT origem) AS origens,
                MAX(COALESCE(ocorreu_em, capturado_em::date)) AS ultimo_em
           FROM cnpj_eventos
          WHERE COALESCE(ocorreu_em, capturado_em::date) > now() - interval $1::text
          GROUP BY cnpj_eventos.cnpj
       )
       SELECT b.cnpj, b.total, b.ult_24h, b.ult_7d, b.origens, b.ultimo_em,
              e.razao_social, e.cnae_descricao, e.uf, e.municipio,
              COALESCE(e.porte, 1) AS porte,
              COALESCE(e.capital_social, 0)::numeric AS capital_social,
              e.email, e.ddd1, e.telefone1,
              ev.tipo AS ult_tipo, ev.titulo AS ult_titulo
         FROM base b
         JOIN empresas e ON e.cnpj = b.cnpj
         LEFT JOIN LATERAL (
           SELECT tipo, titulo
             FROM cnpj_eventos
            WHERE cnpj = b.cnpj
            ORDER BY COALESCE(ocorreu_em, capturado_em::date) DESC
            LIMIT 1
         ) ev ON true
        WHERE e.situacao = 2 ${condUf}
        ORDER BY b.total DESC
        LIMIT $2`,
      params,
    );
  } catch {
    return NextResponse.json({ empresas: [], aviso: "cnpj_eventos indisponivel" });
  }

  if (agg.length === 0) return NextResponse.json({ empresas: [] });

  // 2) Quais desses ja tem perfil B2B declarado (em SC)?
  const cnpjs = agg.map((r) => r.cnpj as string);
  const perfis = await pool.query<{ cnpj: string }>(
    `SELECT cnpj FROM sevenconstruction.b2b_perfis WHERE cnpj = ANY($1::varchar[]) AND visivel = TRUE`,
    [cnpjs],
  );
  const declarados = new Set(perfis.rows.map((r) => r.cnpj));

  const empresas = agg.map((r) => ({
    cnpj: r.cnpj,
    razao_social: r.razao_social,
    cnae_descricao: r.cnae_descricao ?? null,
    uf: r.uf,
    municipio: r.municipio ?? null,
    porte: Number(r.porte),
    capital_social: Number(r.capital_social),
    email: r.email ?? null,
    telefone: r.telefone1 ? `${r.ddd1 ?? ""}${r.telefone1}` : null,
    signals: {
      total: Number(r.total),
      ultimas_24h: Number(r.ult_24h),
      ultimos_7d: Number(r.ult_7d),
      origens: r.origens ?? [],
      ultimo_evento_em: r.ultimo_em ? String(r.ultimo_em) : null,
      ultimo_titulo: r.ult_titulo ?? "",
      ultimo_tipo: r.ult_tipo ?? null,
    },
    perfil_declarado: declarados.has(r.cnpj as string),
  }));

  return NextResponse.json({ empresas });
}
