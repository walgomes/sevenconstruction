// Helpers da aba Admin > Parceiros (fornecedores upstream).
// ADMIN ONLY: rotas que chamam isto devem passar antes por exigirSuper().
// SERVER ONLY: arrasta pg via @/lib/db. Pra constantes/types em client,
// usar @/lib/parceiros-tipos.

import pool from "@/lib/db";
import {
  TIPOS_PARCEIRO,
  type TipoParceiro,
  type Parceiro,
  type ParceirosKpis,
} from "@/lib/parceiros-tipos";

export { TIPOS_PARCEIRO };
export type { TipoParceiro, Parceiro, ParceirosKpis };

export async function lerKpis(): Promise<ParceirosKpis> {
  const r = await pool.query(`SELECT * FROM sevenconstruction.v_parceiros_kpis`);
  const row = r.rows[0] || {};
  return {
    total:        Number(row.total ?? 0),
    fabrica:      Number(row.fabrica ?? 0),
    importador:   Number(row.importador ?? 0),
    distribuidor: Number(row.distribuidor ?? 0),
    lojista:      Number(row.lojista ?? 0),
    outros:       Number(row.outros ?? 0),
    ativos:       Number(row.ativos ?? 0),
    estados:      Number(row.estados ?? 0),
  };
}

export type FiltroParceiros = {
  tipo?: TipoParceiro;
  uf?: string;
  busca?: string;
  cnae?: string;
  produto?: string;
  limite?: number;
  offset?: number;
};

export async function listarParceiros(f: FiltroParceiros = {}): Promise<Parceiro[]> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (f.tipo)    { args.push(f.tipo);   where.push(`p.tipo = $${args.length}`); }
  if (f.uf)      { args.push(f.uf.toUpperCase().slice(0, 2)); where.push(`p.uf = $${args.length}`); }
  if (f.cnae)    { args.push(f.cnae);   where.push(`p.cnae_principal = $${args.length}`); }
  if (f.busca)   {
    args.push(`%${f.busca.toLowerCase()}%`);
    where.push(`(LOWER(p.nome_fantasia) LIKE $${args.length} OR LOWER(COALESCE(p.razao_social,'')) LIKE $${args.length} OR REGEXP_REPLACE(COALESCE(p.cnpj,''), '[^0-9]', '', 'g') LIKE $${args.length})`);
  }
  if (f.produto) {
    args.push(normalizarProduto(f.produto));
    where.push(`EXISTS (SELECT 1 FROM sevenconstruction.parceiros_produtos pp WHERE pp.parceiro_id = p.id AND pp.produto = $${args.length})`);
  }

  const limite = Math.min(f.limite ?? 100, 500);
  const offset = Math.max(f.offset ?? 0, 0);
  args.push(limite, offset);

  const sql = `
    SELECT p.*,
      COALESCE(
        (SELECT array_agg(pp.produto_raw ORDER BY pp.produto_raw)
           FROM sevenconstruction.parceiros_produtos pp
          WHERE pp.parceiro_id = p.id),
        ARRAY[]::TEXT[]
      ) AS produtos
    FROM sevenconstruction.parceiros p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.codigo ASC
    LIMIT $${args.length - 1} OFFSET $${args.length}
  `;
  const r = await pool.query<Parceiro>(sql, args);
  return r.rows;
}

export async function lerParceiro(id: number): Promise<Parceiro | null> {
  const r = await pool.query<Parceiro>(
    `SELECT p.*,
       COALESCE(
         (SELECT array_agg(pp.produto_raw ORDER BY pp.produto_raw)
            FROM sevenconstruction.parceiros_produtos pp
           WHERE pp.parceiro_id = p.id),
         ARRAY[]::TEXT[]
       ) AS produtos
       FROM sevenconstruction.parceiros p
      WHERE p.id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export type NovoParceiro = {
  tipo: TipoParceiro;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  cnae_principal?: string | null;
  uf?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  cep?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  logo_url?: string | null;
  notas?: string | null;
  origem?: string | null;
  origem_url?: string | null;
  produtos?: string[];
};

export async function criarParceiro(p: NovoParceiro): Promise<Parceiro> {
  const cnpjLimpo = p.cnpj ? p.cnpj.replace(/\D+/g, "") : null;
  const cnaeLimpo = p.cnae_principal ? p.cnae_principal.replace(/\D+/g, "").slice(0, 7) : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Dedupe por CNPJ se fornecido
    if (cnpjLimpo) {
      const dup = await client.query<{ id: number }>(
        `SELECT id FROM sevenconstruction.parceiros WHERE cnpj = $1`,
        [cnpjLimpo],
      );
      if (dup.rows[0]) {
        await client.query("ROLLBACK");
        throw new Error(`CNPJ ja cadastrado (id=${dup.rows[0].id})`);
      }
    }

    const r = await client.query<Parceiro>(
      `INSERT INTO sevenconstruction.parceiros
         (tipo, nome_fantasia, razao_social, cnpj, cnae_principal, uf, cidade, endereco, cep,
          telefone, whatsapp, email, site, logo_url, notas, origem, origem_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        p.tipo,
        p.nome_fantasia.trim(),
        p.razao_social?.trim() || null,
        cnpjLimpo,
        cnaeLimpo,
        p.uf?.toUpperCase().slice(0, 2) || null,
        p.cidade?.trim() || null,
        p.endereco?.trim() || null,
        p.cep ? p.cep.replace(/\D+/g, "").slice(0, 8) : null,
        p.telefone?.trim() || null,
        p.whatsapp?.trim() || null,
        p.email?.trim().toLowerCase() || null,
        p.site?.trim() || null,
        p.logo_url?.trim() || null,
        p.notas?.trim() || null,
        p.origem?.trim() || "manual",
        p.origem_url?.trim() || null,
      ],
    );
    const parceiro = r.rows[0];

    if (p.produtos?.length) {
      await inserirProdutos(client, parceiro.id, p.produtos, p.origem ?? "manual");
    }

    await client.query("COMMIT");
    return parceiro;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export type AtualizacaoParceiro = Partial<Omit<NovoParceiro, "tipo">> & { tipo?: TipoParceiro; ativo?: boolean };

export async function atualizarParceiro(id: number, p: AtualizacaoParceiro): Promise<Parceiro | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  const add = (col: string, val: unknown) => { args.push(val); sets.push(`${col} = $${args.length}`); };

  if (p.tipo !== undefined)           add("tipo", p.tipo);
  if (p.nome_fantasia !== undefined)  add("nome_fantasia", p.nome_fantasia);
  if (p.razao_social !== undefined)   add("razao_social", p.razao_social);
  if (p.cnpj !== undefined)           add("cnpj", p.cnpj ? p.cnpj.replace(/\D+/g, "") : null);
  if (p.cnae_principal !== undefined) add("cnae_principal", p.cnae_principal ? p.cnae_principal.replace(/\D+/g, "").slice(0,7) : null);
  if (p.uf !== undefined)             add("uf", p.uf ? p.uf.toUpperCase().slice(0,2) : null);
  if (p.cidade !== undefined)         add("cidade", p.cidade);
  if (p.endereco !== undefined)       add("endereco", p.endereco);
  if (p.cep !== undefined)            add("cep", p.cep ? p.cep.replace(/\D+/g, "").slice(0,8) : null);
  if (p.telefone !== undefined)       add("telefone", p.telefone);
  if (p.whatsapp !== undefined)       add("whatsapp", p.whatsapp);
  if (p.email !== undefined)          add("email", p.email ? p.email.toLowerCase() : null);
  if (p.site !== undefined)           add("site", p.site);
  if (p.logo_url !== undefined)       add("logo_url", p.logo_url);
  if (p.notas !== undefined)          add("notas", p.notas);
  if (p.origem !== undefined)         add("origem", p.origem);
  if (p.origem_url !== undefined)     add("origem_url", p.origem_url);
  if (p.ativo !== undefined)          add("ativo", p.ativo);

  if (sets.length === 0) return lerParceiro(id);

  args.push(id);
  const r = await pool.query<Parceiro>(
    `UPDATE sevenconstruction.parceiros SET ${sets.join(", ")} WHERE id = $${args.length} RETURNING *`,
    args,
  );
  return r.rows[0] ?? null;
}

export async function deletarParceiro(id: number): Promise<boolean> {
  const r = await pool.query(`DELETE FROM sevenconstruction.parceiros WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

// Lista UFs distintas pra filtro do select.
export async function listarUfs(): Promise<string[]> {
  const r = await pool.query<{ uf: string }>(
    `SELECT DISTINCT uf FROM sevenconstruction.parceiros WHERE uf IS NOT NULL ORDER BY uf`,
  );
  return r.rows.map((x) => x.uf);
}

// ===== Produtos =====

export function normalizarProduto(p: string): string {
  return p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import type { PoolClient } from "pg";

async function inserirProdutos(
  client: PoolClient,
  parceiro_id: number,
  produtos: string[],
  origem: string,
): Promise<void> {
  for (const raw of produtos) {
    const norm = normalizarProduto(raw);
    if (!norm) continue;
    await client.query(
      `INSERT INTO sevenconstruction.parceiros_produtos (parceiro_id, produto, produto_raw, origem)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (parceiro_id, produto) DO NOTHING`,
      [parceiro_id, norm, raw.trim(), origem],
    );
  }
}

// Parceiros que trabalham com mesmo produto (regra do user: filtrar por produtos iguais).
export async function parceirosPorProduto(produto: string): Promise<Parceiro[]> {
  return listarParceiros({ produto });
}

// Top produtos cadastrados (pra UI mostrar lista de produtos com contagem).
export async function topProdutos(limite = 50): Promise<{ produto: string; n: number }[]> {
  const r = await pool.query<{ produto: string; n: number }>(
    `SELECT pp.produto_raw AS produto, COUNT(DISTINCT pp.parceiro_id)::int AS n
       FROM sevenconstruction.parceiros_produtos pp
      GROUP BY pp.produto_raw
      ORDER BY n DESC, pp.produto_raw ASC
      LIMIT $1`,
    [limite],
  );
  return r.rows;
}
