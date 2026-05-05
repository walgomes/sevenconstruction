// Lógica de prospecção geo: busca empresas no RFB (sevendb) e salva
// como lista no banco do SevenConstruction.

import { rfbQuery } from "@/lib/rfb-db";
import pool from "@/lib/db";

export type EmpresaRfb = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  municipio: string | null;
  uf: string | null;
  bairro: string | null;
  cep: string | null;
  ddd1: string | null;
  telefone1: string | null;
  email: string | null;
  porte: number | null;
  capital_social: number | null;
  data_abertura: string | null;
};

export type FiltroBusca = {
  uf?: string;
  municipio?: string;
  nome?: string;             // busca livre em razao_social ou nome_fantasia
  cnpj?: string;             // busca por CNPJ (com ou sem mascara)
  cnaes_alvo?: string[];     // prefixos: ['41','42','43','4321']
  apenas_ativas?: boolean;   // default true
  porte_min?: number;        // 1=NI, 2=ME, 3=EPP, 5=Demais
  porte_max?: number;
  limite?: number;           // default 200
};

const PORTE_LABEL: Record<number, string> = {
  1: "Não informado",
  2: "ME",
  3: "EPP",
  5: "Grande/Médio",
};

export function rotularPorte(p: number | null | undefined): string {
  if (p == null) return "Não informado";
  return PORTE_LABEL[p] || "Não informado";
}

export function rotularSituacao(s: number | null | undefined): string {
  switch (s) {
    case 2: return "ATIVA";
    case 3: return "SUSPENSA";
    case 4: return "INAPTA";
    case 8: return "BAIXADA";
    default: return "OUTRAS";
  }
}

export async function buscarEmpresasRfb(
  filtro: FiltroBusca,
): Promise<EmpresaRfb[]> {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (filtro.apenas_ativas !== false) {
    conds.push("situacao = 2");
  }
  if (filtro.uf) {
    params.push(filtro.uf.toUpperCase());
    conds.push(`uf = $${params.length}`);
  }
  if (filtro.municipio) {
    params.push(filtro.municipio);
    conds.push(`municipio ILIKE $${params.length}`);
  }
  if (filtro.cnaes_alvo && filtro.cnaes_alvo.length) {
    const ors = filtro.cnaes_alvo.map((prefixo) => {
      params.push(`${prefixo}%`);
      return `cnae_fiscal LIKE $${params.length}`;
    });
    conds.push(`(${ors.join(" OR ")})`);
  }
  if (filtro.cnpj) {
    const limpo = filtro.cnpj.replace(/\D/g, "");
    if (limpo.length === 14) {
      params.push(limpo);
      conds.push(`cnpj = $${params.length}`);
    } else if (limpo.length === 8) {
      // CNPJ basico: pega todas as filiais
      params.push(limpo);
      conds.push(`LEFT(cnpj, 8) = $${params.length}`);
    } else if (limpo.length >= 4) {
      params.push(limpo + "%");
      conds.push(`cnpj LIKE $${params.length}`);
    }
  }
  if (filtro.nome && filtro.nome.trim().length >= 2) {
    // Busca por nome usa o GIN trigram em razao_social (idx_empresas_razao_trgm)
    params.push(`%${filtro.nome.trim()}%`);
    const idx = params.length;
    conds.push(
      `(razao_social ILIKE $${idx} OR nome_fantasia ILIKE $${idx})`,
    );
  }
  if (filtro.porte_min != null) {
    params.push(filtro.porte_min);
    conds.push(`porte >= $${params.length}`);
  }
  if (filtro.porte_max != null) {
    params.push(filtro.porte_max);
    conds.push(`porte <= $${params.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 1000);

  const sql = `
    SELECT cnpj,
           razao_social,
           nome_fantasia,
           cnae_fiscal,
           cnae_descricao,
           municipio,
           uf,
           bairro,
           cep,
           ddd1,
           telefone1,
           email,
           porte,
           capital_social,
           data_abertura::text AS data_abertura
      FROM empresas
      ${where}
     ORDER BY data_abertura DESC NULLS LAST
     LIMIT ${limite}
  `;
  return rfbQuery<EmpresaRfb>(sql, params);
}

export type CriarListaInput = {
  loja_id: number;
  criado_por: number;
  nome: string;
  cep_centro?: string | null;
  raio_km?: number;
  cidade?: string | null;
  uf?: string | null;
  cnaes_alvo?: string[];
  apenas_ativas?: boolean;
  filtros_extra?: Record<string, unknown>;
  itens: EmpresaRfb[];
};

export type ListaResumo = {
  id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
  cnaes_alvo: string[] | null;
  total_itens: number;
  criado_em: string;
};

export async function salvarLista(input: CriarListaInput): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `INSERT INTO sevenconstruction.prospec_listas
         (loja_id, criado_por, nome, cep_centro, raio_km, cidade, uf,
          cnaes_alvo, apenas_ativas, total_itens, filtros_extra)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.loja_id,
        input.criado_por,
        input.nome,
        input.cep_centro ?? null,
        input.raio_km ?? 10,
        input.cidade ?? null,
        input.uf ?? null,
        input.cnaes_alvo ?? null,
        input.apenas_ativas !== false,
        input.itens.length,
        JSON.stringify(input.filtros_extra ?? {}),
      ],
    );
    const lista_id = r.rows[0].id as number;

    if (input.itens.length) {
      // batch insert via UNNEST
      const itens = input.itens;
      await client.query(
        `INSERT INTO sevenconstruction.prospec_lista_itens
           (lista_id, cnpj, razao_social, nome_fantasia, cnae, porte,
            cidade, uf, bairro, capital_social, data_abertura, telefone, email)
         SELECT $1,
                u.cnpj, u.razao_social, u.nome_fantasia, u.cnae, u.porte,
                u.cidade, u.uf, u.bairro, u.capital_social,
                u.data_abertura::date, u.telefone, u.email
           FROM UNNEST(
                  $2::text[],
                  $3::text[],
                  $4::text[],
                  $5::text[],
                  $6::text[],
                  $7::text[],
                  $8::text[],
                  $9::text[],
                  $10::numeric[],
                  $11::text[],
                  $12::text[],
                  $13::text[]
                ) AS u(cnpj, razao_social, nome_fantasia, cnae, porte,
                       cidade, uf, bairro, capital_social, data_abertura,
                       telefone, email)
         ON CONFLICT (lista_id, cnpj) DO NOTHING`,
        [
          lista_id,
          itens.map((i) => i.cnpj),
          itens.map((i) => i.razao_social ?? ""),
          itens.map((i) => i.nome_fantasia ?? ""),
          itens.map((i) => i.cnae_fiscal),
          itens.map((i) => rotularPorte(i.porte)),
          itens.map((i) => i.municipio ?? ""),
          itens.map((i) => i.uf ?? ""),
          itens.map((i) => i.bairro ?? ""),
          itens.map((i) => (i.capital_social == null ? null : i.capital_social)),
          itens.map((i) => i.data_abertura ?? null),
          itens.map((i) =>
            i.telefone1 ? `${i.ddd1 ?? ""} ${i.telefone1}`.trim() : "",
          ),
          itens.map((i) => i.email ?? ""),
        ],
      );
    }

    await client.query("COMMIT");
    return lista_id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listarListasDaLoja(loja_id: number): Promise<ListaResumo[]> {
  const r = await pool.query(
    `SELECT id, nome, cidade, uf, cnaes_alvo, total_itens, criado_em::text
       FROM sevenconstruction.prospec_listas
      WHERE loja_id = $1
      ORDER BY criado_em DESC
      LIMIT 100`,
    [loja_id],
  );
  return r.rows as ListaResumo[];
}

export async function lerListaComItens(lista_id: number, loja_id: number) {
  const lista = await pool.query(
    `SELECT id, nome, cep_centro, raio_km, cidade, uf, cnaes_alvo,
            apenas_ativas, total_itens, criado_em::text
       FROM sevenconstruction.prospec_listas
      WHERE id = $1 AND loja_id = $2
      LIMIT 1`,
    [lista_id, loja_id],
  );
  if (!lista.rows[0]) return null;

  const itens = await pool.query(
    `SELECT cnpj, razao_social, nome_fantasia, cnae, porte,
            cidade, uf, bairro, capital_social, data_abertura::text,
            telefone, email
       FROM sevenconstruction.prospec_lista_itens
      WHERE lista_id = $1
      ORDER BY razao_social NULLS LAST
      LIMIT 1000`,
    [lista_id],
  );

  return { lista: lista.rows[0], itens: itens.rows };
}
