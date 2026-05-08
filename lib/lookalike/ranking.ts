/**
 * lib/lookalike/ranking.ts
 *
 * Copia adaptada de seven-empresas/lib/lookalike/ranking.ts.
 * Dado o perfil da carteira, busca empresas similares na sevendb e ranqueia.
 *
 * Score = soma ponderada:
 *   - Match CNAE principal: ate 35 pts (peso ~ % do CNAE no perfil)
 *   - Match UF:             ate 15 pts (peso ~ % da UF no perfil)
 *   - Match porte:          20 pts se porte presente
 *   - Capital P25-P75:      10 pts
 *   - Idade P25-P75:        10 pts
 *   - Tem email:             5 pts
 *   - Tem telefone:          5 pts
 *
 * Adaptacao SC: usa rfbQuery (read-only sevendb) em vez de pool.
 */

import { rfbQuery } from "@/lib/rfb-db";
import type { PerfilCarteira } from "./perfil";
import { normalizarCnpjs } from "./perfil";

export interface OpcoesBusca {
  excluir_cnpjs?: string[];
  ufs?: string[];
  exigir_email?: boolean;
  exigir_telefone?: boolean;
  capital_min?: number;
  capital_max?: number;
  limite?: number;
}

export interface EmpresaSimilar {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  uf: string;
  municipio: string;
  porte: number;
  capital_social: number;
  data_abertura: string | null;
  email: string | null;
  ddd1: string | null;
  telefone1: string | null;
  score: number;
  match: { cnae: number; uf: number; porte: number; capital: number; idade: number; contato: number };
}

export interface ResultadoBusca {
  total: number;
  empresas: EmpresaSimilar[];
  filtros_aplicados: {
    cnaes: string[];
    ufs: string[];
    portes: number[];
    capital_min: number;
    capital_max: number;
    idade_min_anos: number;
    idade_max_anos: number;
  };
}

const PORTE_LABEL: Record<number, "ME" | "EPP" | "demais" | "nao_informado"> = {
  2: "ME", 3: "EPP", 5: "demais",
};

export async function buscarSimilares(
  perfil: PerfilCarteira,
  opts: OpcoesBusca = {},
): Promise<ResultadoBusca> {
  const limite = Math.min(Math.max(opts.limite || 200, 10), 2000);
  const excluirRaw = opts.excluir_cnpjs || [];
  const excluirCnpjs = normalizarCnpjs(excluirRaw);

  const cnaesEscolhidos = perfil.cnaes_top
    .filter((c) => c.pct >= 5 || perfil.cnaes_top.indexOf(c) < 3)
    .slice(0, 8);
  if (cnaesEscolhidos.length === 0) cnaesEscolhidos.push(...perfil.cnaes_top.slice(0, 3));
  const cnaes = cnaesEscolhidos.map((c) => c.cnae);

  const ufs = (opts.ufs && opts.ufs.length > 0) ? opts.ufs : perfil.ufs_top.map((u) => u.uf);

  const portes: number[] = [];
  if (perfil.porte.ME > 0) portes.push(2);
  if (perfil.porte.EPP > 0) portes.push(3);
  if (perfil.porte.demais > 0) portes.push(5);

  const capital_min = Math.max(0, opts.capital_min ?? Math.floor(perfil.capital.p25 / 2));
  const capital_max = opts.capital_max ?? Math.ceil(perfil.capital.p75 * 3);
  const idade_min_anos = Math.max(0, perfil.idade_anos.p25 - 2);
  const idade_max_anos = perfil.idade_anos.p75 + 5;

  const conds: string[] = [
    "situacao = 2",
    `cnae_fiscal = ANY($1::bpchar[])`,
  ];
  const params: (string | number | string[] | number[])[] = [cnaes];
  let i = 2;

  if (ufs.length > 0) { conds.push(`uf = ANY($${i++}::bpchar[])`); params.push(ufs); }
  if (portes.length > 0) { conds.push(`COALESCE(porte, 1) = ANY($${i++}::int[])`); params.push(portes); }
  if (excluirCnpjs.length > 0) { conds.push(`cnpj <> ALL($${i++}::bpchar[])`); params.push(excluirCnpjs); }
  if (opts.exigir_email) conds.push(`email IS NOT NULL AND email <> ''`);
  if (opts.exigir_telefone) conds.push(`ddd1 IS NOT NULL AND ddd1 <> '' AND telefone1 <> ''`);
  if (capital_min > 0) { conds.push(`COALESCE(capital_social, 0) >= $${i++}`); params.push(capital_min); }
  if (capital_max > 0 && capital_max < 1e15) { conds.push(`COALESCE(capital_social, 0) <= $${i++}`); params.push(capital_max); }

  const hoje = new Date();
  const dataMaxAbertura = new Date(hoje.getFullYear() - idade_min_anos, hoje.getMonth(), hoje.getDate());
  const dataMinAbertura = new Date(hoje.getFullYear() - idade_max_anos, hoje.getMonth(), hoje.getDate());
  conds.push(`data_abertura BETWEEN $${i++} AND $${i++}`);
  params.push(dataMinAbertura.toISOString().slice(0, 10), dataMaxAbertura.toISOString().slice(0, 10));

  const cnaePctMap: Record<string, number> = {};
  for (const c of cnaesEscolhidos) cnaePctMap[c.cnae] = c.pct;
  const cnaeCases = cnaesEscolhidos
    .map((c) => `WHEN cnae_fiscal = '${c.cnae}' THEN ${Math.min(35, Math.round(c.pct * 0.7))}`)
    .join("\n            ");

  const ufPctMap: Record<string, number> = {};
  for (const u of perfil.ufs_top) ufPctMap[u.uf] = u.pct;
  const ufCases = perfil.ufs_top
    .map((u) => `WHEN uf = '${u.uf}' THEN ${Math.min(15, Math.round(u.pct * 0.3))}`)
    .join("\n            ");

  const portesCsv = portes.length ? portes.join(",") : "0";

  const sql = `
    SELECT cnpj, razao_social, nome_fantasia, cnae_fiscal, cnae_descricao,
           uf, municipio,
           COALESCE(porte, 1) AS porte,
           COALESCE(capital_social, 0)::numeric AS capital_social,
           data_abertura, email, ddd1, telefone1,
           (
             (CASE
                ${cnaeCases || "WHEN false THEN 0"}
                ELSE 0
              END)
             + (CASE
                  ${ufCases || "WHEN false THEN 0"}
                  ELSE 0
                END)
             + (CASE WHEN COALESCE(porte,1) IN (${portesCsv}) THEN 20 ELSE 0 END)
             + (CASE WHEN COALESCE(capital_social,0) BETWEEN ${perfil.capital.p25} AND ${perfil.capital.p75 || 1e12}
                     THEN 10 ELSE 0 END)
             + (CASE WHEN data_abertura BETWEEN $${i++} AND $${i++} THEN 10 ELSE 0 END)
             + (CASE WHEN email IS NOT NULL AND email <> '' THEN 5 ELSE 0 END)
             + (CASE WHEN ddd1 IS NOT NULL AND ddd1 <> '' AND telefone1 <> '' THEN 5 ELSE 0 END)
           )::int AS score
      FROM empresas
     WHERE ${conds.join(" AND ")}
     ORDER BY score DESC, capital_social DESC NULLS LAST
     LIMIT $${i++}
  `;

  const dataMaxScore = new Date(hoje.getFullYear() - perfil.idade_anos.p25, hoje.getMonth(), hoje.getDate());
  const dataMinScore = new Date(hoje.getFullYear() - perfil.idade_anos.p75, hoje.getMonth(), hoje.getDate());
  params.push(dataMinScore.toISOString().slice(0, 10));
  params.push(dataMaxScore.toISOString().slice(0, 10));
  params.push(limite);

  const rows = await rfbQuery<Record<string, unknown>>(sql, params);

  const empresas: EmpresaSimilar[] = rows.map((row) => {
    const cnae = row.cnae_fiscal as string;
    const uf = row.uf as string;
    const porte = Number(row.porte);
    const capital = Number(row.capital_social) || 0;
    const dt = row.data_abertura as string | null;
    const idadeAnos = dt ? (new Date().getFullYear() - new Date(dt).getFullYear()) : 0;
    const ptsCnae = Math.min(35, Math.round((cnaePctMap[cnae] || 0) * 0.7));
    const ptsUf = Math.min(15, Math.round((ufPctMap[uf] || 0) * 0.3));
    const ptsPorte = portes.includes(porte) ? 20 : 0;
    const ptsCap = (capital >= perfil.capital.p25 && capital <= perfil.capital.p75) ? 10 : 0;
    const ptsIdade = (idadeAnos >= perfil.idade_anos.p25 && idadeAnos <= perfil.idade_anos.p75) ? 10 : 0;
    const temEmail = !!(row.email && (row.email as string).length > 0);
    const temTel = !!(row.ddd1 && row.telefone1);
    const ptsContato = (temEmail ? 5 : 0) + (temTel ? 5 : 0);

    return {
      cnpj: row.cnpj as string,
      razao_social: row.razao_social as string,
      nome_fantasia: (row.nome_fantasia as string) || null,
      cnae_fiscal: cnae,
      cnae_descricao: (row.cnae_descricao as string) || null,
      uf,
      municipio: (row.municipio as string) || "",
      porte,
      capital_social: capital,
      data_abertura: dt ? new Date(dt).toISOString().slice(0, 10) : null,
      email: (row.email as string) || null,
      ddd1: (row.ddd1 as string) || null,
      telefone1: (row.telefone1 as string) || null,
      score: Number(row.score) || 0,
      match: { cnae: ptsCnae, uf: ptsUf, porte: ptsPorte, capital: ptsCap, idade: ptsIdade, contato: ptsContato },
    };
  });

  return {
    total: empresas.length,
    empresas,
    filtros_aplicados: { cnaes, ufs, portes, capital_min, capital_max, idade_min_anos, idade_max_anos },
  };
}

export function porteLabel(porte: number): string {
  return PORTE_LABEL[porte] || "—";
}
