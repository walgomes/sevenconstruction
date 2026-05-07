// Catalogo de SKUs por parceiro — diferencial #2 do SRM SC.
// Permite query cross: "qual parceiro entrega NCM 2523.29.10 em SP?"

import pool from "@/lib/db";

export type Sku = {
  id: number;
  parceiro_id: number;
  ncm: string | null;
  sku: string | null;
  descricao: string;
  marca: string | null;
  unidade: string | null;
  norma_abnt: string | null;
  preco_referencia: number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type SkuComParceiro = Sku & {
  parceiro_codigo: number;
  parceiro_nome: string;
  parceiro_tipo: string;
  parceiro_uf: string | null;
  parceiro_cidade: string | null;
  parceiro_fase: string;
  parceiro_trust: number | null;
};

export async function listarSkus(parceiro_id: number): Promise<Sku[]> {
  const r = await pool.query<Sku>(
    `SELECT * FROM sevenconstruction.parceiros_skus
      WHERE parceiro_id = $1 AND ativo
      ORDER BY ncm NULLS LAST, descricao ASC`,
    [parceiro_id],
  );
  return r.rows;
}

export type NovoSku = {
  parceiro_id: number;
  ncm?: string | null;
  sku?: string | null;
  descricao: string;
  marca?: string | null;
  unidade?: string | null;
  norma_abnt?: string | null;
  preco_referencia?: number | null;
};

export async function adicionarSku(s: NovoSku): Promise<Sku> {
  const ncmLimpo = s.ncm ? s.ncm.replace(/\D+/g, "").slice(0, 8) : null;
  const r = await pool.query<Sku>(
    `INSERT INTO sevenconstruction.parceiros_skus
       (parceiro_id, ncm, sku, descricao, marca, unidade, norma_abnt, preco_referencia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      s.parceiro_id,
      ncmLimpo || null,
      s.sku?.trim() || null,
      s.descricao.trim(),
      s.marca?.trim() || null,
      s.unidade?.trim() || null,
      s.norma_abnt?.trim() || null,
      s.preco_referencia ?? null,
    ],
  );
  return r.rows[0];
}

export async function removerSku(id: number, parceiro_id: number): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM sevenconstruction.parceiros_skus WHERE id = $1 AND parceiro_id = $2`,
    [id, parceiro_id],
  );
  return (r.rowCount ?? 0) > 0;
}

// Busca cross-parceiros por NCM (prefixo) ou descrição (ILIKE).
// Retorna SKUs com info do parceiro embutida — UI mostra "este SKU vem
// destes 3 parceiros" facilmente.
export type FiltroSkuCross = {
  ncm?: string;          // prefixo, ex "2523" pega todos os cimentos
  q?: string;            // termo livre na descricao/marca
  uf?: string;
  tipo_parceiro?: string;
  apenas_homologados?: boolean;
  limite?: number;
};

export async function buscarSkusCross(f: FiltroSkuCross = {}): Promise<SkuComParceiro[]> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (f.ncm) {
    args.push(f.ncm.replace(/\D+/g, "") + "%");
    where.push(`ncm LIKE $${args.length}`);
  }
  if (f.q) {
    args.push(`%${f.q.toLowerCase()}%`);
    where.push(`(LOWER(descricao) LIKE $${args.length} OR LOWER(COALESCE(marca,'')) LIKE $${args.length} OR LOWER(COALESCE(sku,'')) LIKE $${args.length})`);
  }
  if (f.uf) {
    args.push(f.uf.toUpperCase().slice(0, 2));
    where.push(`parceiro_uf = $${args.length}`);
  }
  if (f.tipo_parceiro) {
    args.push(f.tipo_parceiro);
    where.push(`parceiro_tipo = $${args.length}`);
  }
  if (f.apenas_homologados) {
    where.push(`parceiro_fase = 'homologado'`);
  }

  const limite = Math.min(f.limite ?? 100, 500);
  args.push(limite);

  const sql = `
    SELECT * FROM sevenconstruction.v_skus_com_parceiro
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY parceiro_trust DESC NULLS LAST, ncm NULLS LAST, descricao ASC
    LIMIT $${args.length}
  `;
  const r = await pool.query<SkuComParceiro>(sql, args);
  return r.rows;
}

// Total de parceiros distintos com SKUs cadastrados (KPI dashboard).
export async function totalParceirosComSkus(): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT COUNT(DISTINCT parceiro_id)::int AS n
       FROM sevenconstruction.parceiros_skus WHERE ativo`,
  );
  return r.rows[0]?.n ?? 0;
}

// Top NCMs pelo numero de parceiros — pra mostrar "produtos com mais
// fornecedores" no dashboard.
export async function topNcms(limite = 20): Promise<{ ncm: string; n_parceiros: number }[]> {
  const r = await pool.query<{ ncm: string; n_parceiros: number }>(
    `SELECT ncm, COUNT(DISTINCT parceiro_id)::int AS n_parceiros
       FROM sevenconstruction.parceiros_skus
      WHERE ativo AND ncm IS NOT NULL
      GROUP BY ncm
      ORDER BY n_parceiros DESC
      LIMIT $1`,
    [limite],
  );
  return r.rows;
}
