/**
 * lib/rede-b2b/signals.ts
 *
 * Intent Signals — copiado/adaptado de seven-empresas/lib/lookalike/signals.ts.
 * Detecta empresas que estao "se mexendo" agora cruzando com `cnpj_eventos`
 * da sevendb. CNPJ em movimento converte 5-10x mais que estatico.
 *
 * Adaptacao SC: usa rfbQuery (read-only sevendb) em vez de pool.query — a
 * tabela cnpj_eventos vive na sevendb, nao em sevenconstruction_db.
 */

import { rfbQuery } from "@/lib/rfb-db";

export interface SignalsEmpresa {
  cnpj: string;
  signals_30d: number;
  signals_90d: number;
  tipos: string[];
  ultimo_evento: { tipo: string; titulo: string; ocorreu_em: string | null } | null;
  boost: number;
  resumo: string;
}

const PESO_30D = 35;
const PESO_90D = 20;

function descricaoOrigem(o: string): string {
  if (o === "pncp") return "Contrato público";
  if (o === "cgu") return "Sanção/registro CGU";
  if (o === "watchtower") return "Sinal de mudança";
  if (o === "rfb_evento") return "Atualização cadastral RFB";
  if (o === "inpi") return "Marca/patente registrada";
  return o;
}

export async function signalsBatch(cnpjs: string[]): Promise<Map<string, SignalsEmpresa>> {
  const map = new Map<string, SignalsEmpresa>();
  if (cnpjs.length === 0) return map;

  const lista = cnpjs.slice(0, 2000);

  const sql = `
    WITH base AS (
      SELECT
        cnpj,
        origem,
        tipo,
        titulo,
        COALESCE(ocorreu_em, capturado_em::date) AS data,
        ROW_NUMBER() OVER (PARTITION BY cnpj ORDER BY COALESCE(ocorreu_em, capturado_em::date) DESC) AS rn
      FROM cnpj_eventos
      WHERE cnpj = ANY($1::bpchar[])
    ),
    agg AS (
      SELECT
        cnpj,
        count(*) FILTER (WHERE data > now() - interval '30 days')::int AS s30,
        count(*) FILTER (WHERE data > now() - interval '90 days')::int AS s90,
        array_agg(DISTINCT origem) AS tipos
      FROM base
      GROUP BY cnpj
    )
    SELECT a.cnpj, a.s30, a.s90, a.tipos,
           b.tipo AS ult_tipo, b.titulo AS ult_titulo, b.data AS ult_data
      FROM agg a
      LEFT JOIN base b ON b.cnpj = a.cnpj AND b.rn = 1
  `;

  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = await rfbQuery(sql, [lista]);
  } catch {
    return map;
  }

  for (const row of rows) {
    const cnpj = row.cnpj as string;
    const s30 = Number(row.s30) || 0;
    const s90 = Number(row.s90) || 0;
    const tipos = ((row.tipos as string[]) || []).filter(Boolean);
    const boost = s30 > 0 ? PESO_30D : s90 > 0 ? PESO_90D : 0;

    const ultUlt = row.ult_titulo
      ? {
          tipo: (row.ult_tipo as string) || "evento",
          titulo: (row.ult_titulo as string).slice(0, 140),
          ocorreu_em: row.ult_data ? String(row.ult_data) : null,
        }
      : null;

    let resumo = "";
    if (s30 > 0) resumo = `🔥 ${s30} sinal(is) nos últimos 30 dias`;
    else if (s90 > 0) resumo = `📊 ${s90} sinal(is) nos últimos 90 dias`;
    if (tipos.length > 0) {
      const cats = tipos.map(descricaoOrigem).slice(0, 3).join(" · ");
      resumo += resumo ? ` · ${cats}` : cats;
    }

    map.set(cnpj, {
      cnpj,
      signals_30d: s30,
      signals_90d: s90,
      tipos,
      ultimo_evento: ultUlt,
      boost,
      resumo: resumo || "",
    });
  }

  return map;
}

export async function eventosDetalhe(cnpj: string): Promise<{
  eventos: Array<{ tipo: string; origem: string; titulo: string; descricao: string | null; ocorreu_em: string | null; capturado_em: string | null }>;
}> {
  try {
    const rows = await rfbQuery<{ tipo: string; origem: string; titulo: string; descricao: string | null; ocorreu_em: string | null; capturado_em: string | null }>(
      `SELECT tipo, origem, titulo, descricao, ocorreu_em, capturado_em
         FROM cnpj_eventos
        WHERE cnpj = $1
        ORDER BY COALESCE(ocorreu_em, capturado_em::date) DESC
        LIMIT 50`,
      [cnpj],
    );
    return { eventos: rows };
  } catch {
    return { eventos: [] };
  }
}
