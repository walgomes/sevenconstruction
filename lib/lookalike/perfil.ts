/**
 * lib/lookalike/perfil.ts
 *
 * Copia adaptada de seven-empresas/lib/lookalike/perfil.ts.
 * Extrai perfil medio de uma carteira de CNPJs e alimenta o ranking
 * (lib/lookalike/ranking.ts).
 *
 * Adaptacao SC: usa rfbQuery (read-only sevendb) — empresas vivem la,
 * nao em sevenconstruction_db.
 */

import { rfbQuery } from "@/lib/rfb-db";

export interface PerfilCarteira {
  total_encontrados: number;
  total_pedidos: number;
  total_ativos: number;
  total_inativos: number;
  nao_encontrados: string[];
  cnaes_top: { cnae: string; descricao: string | null; n: number; pct: number }[];
  ufs_top: { uf: string; n: number; pct: number }[];
  porte: { ME: number; EPP: number; demais: number; nao_informado: number };
  capital: { p25: number; mediano: number; p75: number; min: number; max: number };
  idade_anos: { p25: number; mediano: number; p75: number };
  tem_email_pct: number;
  tem_telefone_pct: number;
  cnaes_secundarios_top: { cnae: string; n: number }[];
  amostra: { cnpj: string; razao_social: string; cnae_fiscal: string; uf: string; porte: number }[];
}

export function normalizarCnpjs(entrada: string | string[]): string[] {
  const partes = Array.isArray(entrada) ? entrada : [entrada];
  const todoTexto = partes.join("\n");
  const limpo = todoTexto.replace(/[^\d\s,;]/g, " ").replace(/[,;\s]+/g, " ");
  const matches = limpo.match(/\b\d{14}\b/g) || [];
  return Array.from(new Set(matches));
}

export async function extrairPerfil(cnpjsRaw: string[]): Promise<PerfilCarteira> {
  const cnpjs = normalizarCnpjs(cnpjsRaw);
  if (cnpjs.length === 0) throw new Error("Nenhum CNPJ válido fornecido");
  if (cnpjs.length > 5000) throw new Error("Limite de 5000 CNPJs por análise");

  const rowsTodas = await rfbQuery<{
    cnpj: string;
    razao_social: string;
    cnae_fiscal: string;
    cnae_descricao: string | null;
    uf: string;
    situacao: number;
    porte: number;
    capital_social: number;
    data_abertura: Date | null;
    tem_email: boolean;
    tem_telefone: boolean;
  }>(
    `SELECT cnpj, razao_social, cnae_fiscal, cnae_descricao, uf, situacao,
            COALESCE(porte, 1) AS porte,
            COALESCE(capital_social, 0)::numeric AS capital_social,
            data_abertura,
            (email IS NOT NULL AND email <> '')                         AS tem_email,
            (ddd1 IS NOT NULL AND ddd1 <> '' AND telefone1 <> '')       AS tem_telefone
       FROM empresas
      WHERE cnpj = ANY($1::bpchar[])`,
    [cnpjs],
  );

  const encontrados = new Set(rowsTodas.map((r) => r.cnpj));
  const naoEncontrados = cnpjs.filter((c) => !encontrados.has(c));
  const inativos = rowsTodas.filter((r) => r.situacao !== 2);

  const rows = rowsTodas.filter((r) => r.situacao === 2).length > 0
    ? rowsTodas.filter((r) => r.situacao === 2)
    : rowsTodas;

  if (rowsTodas.length === 0) {
    throw new Error(
      `Nenhum dos ${cnpjs.length} CNPJ(s) foi encontrado na base local. ` +
      `Confira se os números estão corretos. ` +
      `Exemplos não achados: ${naoEncontrados.slice(0, 3).map((c) => c).join(", ")}`,
    );
  }
  if (rows.length === 0) {
    throw new Error(
      `Encontrados ${rowsTodas.length} de ${cnpjs.length} CNPJ(s), mas TODOS estão inativos.`,
    );
  }

  const cnaeCount = new Map<string, { n: number; descricao: string | null }>();
  for (const row of rows) {
    const e = cnaeCount.get(row.cnae_fiscal);
    if (e) e.n += 1;
    else cnaeCount.set(row.cnae_fiscal, { n: 1, descricao: row.cnae_descricao });
  }
  const cnaes_top = Array.from(cnaeCount.entries())
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 10)
    .map(([cnae, v]) => ({
      cnae,
      descricao: v.descricao,
      n: v.n,
      pct: Math.round((v.n / rows.length) * 1000) / 10,
    }));

  const ufCount = new Map<string, number>();
  for (const row of rows) ufCount.set(row.uf, (ufCount.get(row.uf) || 0) + 1);
  const ufs_top = Array.from(ufCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uf, n]) => ({ uf, n, pct: Math.round((n / rows.length) * 1000) / 10 }));

  const porteAcc = { ME: 0, EPP: 0, demais: 0, nao_informado: 0 };
  for (const row of rows) {
    if (row.porte === 2) porteAcc.ME += 1;
    else if (row.porte === 3) porteAcc.EPP += 1;
    else if (row.porte === 5) porteAcc.demais += 1;
    else porteAcc.nao_informado += 1;
  }

  const capitais = rows
    .map((r) => Number(r.capital_social) || 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const quantil = (arr: number[], q: number): number => {
    if (arr.length === 0) return 0;
    const idx = Math.floor(arr.length * q);
    return arr[Math.min(arr.length - 1, idx)];
  };
  const capital = {
    min: capitais[0] || 0,
    p25: quantil(capitais, 0.25),
    mediano: quantil(capitais, 0.5),
    p75: quantil(capitais, 0.75),
    max: capitais[capitais.length - 1] || 0,
  };

  const agora = Date.now();
  const idades = rows
    .map((r) => r.data_abertura ? Math.floor((agora - new Date(r.data_abertura).getTime()) / (365.25 * 86400 * 1000)) : null)
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);
  const idade_anos = {
    p25: quantil(idades, 0.25),
    mediano: quantil(idades, 0.5),
    p75: quantil(idades, 0.75),
  };

  const tem_email_pct = Math.round((rows.filter((r) => r.tem_email).length / rows.length) * 1000) / 10;
  const tem_telefone_pct = Math.round((rows.filter((r) => r.tem_telefone).length / rows.length) * 1000) / 10;

  const cnaes_secundarios_top: { cnae: string; n: number }[] = [];

  return {
    total_encontrados: rowsTodas.length,
    total_pedidos: cnpjs.length,
    total_ativos: rowsTodas.filter((r) => r.situacao === 2).length,
    total_inativos: inativos.length,
    nao_encontrados: naoEncontrados.slice(0, 50),
    cnaes_top,
    ufs_top,
    porte: porteAcc,
    capital,
    idade_anos,
    tem_email_pct,
    tem_telefone_pct,
    cnaes_secundarios_top,
    amostra: rows.slice(0, 5).map((r) => ({
      cnpj: r.cnpj,
      razao_social: r.razao_social,
      cnae_fiscal: r.cnae_fiscal,
      uf: r.uf,
      porte: r.porte,
    })),
  };
}
