// Queries em sevendb (read-only via rfbQuery) pra listar empresas por secao
// CNAE/UF/porte. Usado pelas paginas /loja/empresas-brasileiras/*.
//
// Counts por secao sao caros em 27M linhas — cache em memoria por 1h.

import { rfbQuery } from "@/lib/rfb-db";
import { SECOES_CNAE, divisoesDaSecao, type CodigoSecao, type RankingTipo } from "@/lib/secoes-cnae";

export interface EmpresaCard {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  uf: string | null;
  municipio: string | null;
  porte: number | null;
  capital_social: number | null;
  data_abertura: string | null;
}

// ===== Counts por secao (cache 1h) =====

const TTL_MS = 60 * 60 * 1000;
let cache: { ts: number; counts: Record<CodigoSecao, number> } | null = null;

export async function contarPorSecao(): Promise<Record<CodigoSecao, number>> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.counts;

  // Faz uma query agregada usando a divisao do CNAE (substring(cnae_fiscal,1,2)).
  // Postgres aproveita index parcial em substring se houver — senao roda seq scan
  // (toleravel: 1x por hora, em background da request inicial).
  const rows = await rfbQuery<{ divisao: string; n: number }>(
    `SELECT substring(cnae_fiscal, 1, 2) AS divisao, count(*)::int AS n
       FROM empresas
      WHERE situacao = 2
        AND cnae_fiscal IS NOT NULL
      GROUP BY divisao`,
  ).catch(() => [] as { divisao: string; n: number }[]);

  const porDivisao = new Map<number, number>();
  for (const r of rows) porDivisao.set(parseInt(r.divisao, 10), r.n);

  const counts: Record<CodigoSecao, number> = {} as Record<CodigoSecao, number>;
  for (const s of SECOES_CNAE) {
    counts[s.codigo] = s.divisoes.reduce((sum, d) => sum + (porDivisao.get(d) ?? 0), 0);
  }
  cache = { ts: Date.now(), counts };
  return counts;
}

// ===== Listagem paginada por ranking =====

export interface ListaPaginada {
  empresas: EmpresaCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listarPorRanking(
  secao: CodigoSecao,
  ranking: RankingTipo,
  page = 1,
  pageSize = 50,
): Promise<ListaPaginada> {
  const divisoes = divisoesDaSecao(secao);
  if (divisoes.length === 0) return { empresas: [], total: 0, page: 1, pageSize, totalPages: 0 };

  const conds: string[] = [
    "situacao = 2",
    "cnae_fiscal IS NOT NULL",
    `substring(cnae_fiscal, 1, 2)::int = ANY($1::int[])`,
  ];
  const args: unknown[] = [divisoes];
  let i = 2;

  if (ranking.uf) {
    conds.push(`uf = $${i++}`);
    args.push(ranking.uf);
  }
  if (ranking.porte != null) {
    conds.push(`COALESCE(porte, 1) = $${i++}`);
    args.push(ranking.porte);
  }

  const orderBy = ranking.ordem === "abertura_desc"
    ? "data_abertura DESC NULLS LAST"
    : "COALESCE(capital_social, 0) DESC";

  const limite = Math.min(Math.max(pageSize, 1), 200);
  const offset = (Math.max(page, 1) - 1) * limite;

  // Count em paralelo com a pagina (evita 2 sequential queries lentas)
  const [empresasRes, totalRes] = await Promise.all([
    rfbQuery<EmpresaCard>(
      `SELECT cnpj, razao_social, nome_fantasia, cnae_fiscal, cnae_descricao,
              uf, municipio, COALESCE(porte, 1) AS porte,
              COALESCE(capital_social, 0)::float AS capital_social,
              data_abertura::text AS data_abertura
         FROM empresas
        WHERE ${conds.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT $${i++} OFFSET $${i++}`,
      [...args, limite, offset],
    ).catch(() => [] as EmpresaCard[]),
    rfbQuery<{ n: number }>(
      `SELECT count(*)::int AS n FROM empresas WHERE ${conds.join(" AND ")}`,
      args,
    ).catch(() => [{ n: 0 }]),
  ]);

  const total = totalRes[0]?.n ?? 0;
  return {
    empresas: empresasRes,
    total,
    page: Math.max(page, 1),
    pageSize: limite,
    totalPages: Math.max(Math.ceil(total / limite), 1),
  };
}

export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D+/g, "").padStart(14, "0");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

export function porteLabel(p: number | null): string {
  switch (p) {
    case 2: return "ME";
    case 3: return "EPP";
    case 5: return "Médio/Grande";
    default: return "—";
  }
}
