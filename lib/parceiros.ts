// Helpers da aba Admin > Parceiros (fornecedores upstream).
// ADMIN ONLY: rotas que chamam isto devem passar antes por exigirSuper().
// SERVER ONLY: arrasta pg via @/lib/db. Pra constantes/types em client,
// usar @/lib/parceiros-tipos.

import pool from "@/lib/db";
import {
  TIPOS_PARCEIRO,
  FASES_HOMOLOG,
  type TipoParceiro,
  type Parceiro,
  type ParceirosKpis,
  type FaseHomolog,
} from "@/lib/parceiros-tipos";

export { TIPOS_PARCEIRO, FASES_HOMOLOG };
export type { TipoParceiro, Parceiro, ParceirosKpis, FaseHomolog };

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

// ===== SRM: mover fase + auditoria =====

export type AtorLog = {
  id: number | null;
  tipo: "humano" | "ia" | "sistema";
  nome: string;
};

export async function mudarFase(
  parceiro_id: number,
  fase: FaseHomolog,
  ator: AtorLog,
  opts: { motivo?: string; payload?: Record<string, unknown>; trust_score?: number | null } = {},
): Promise<Parceiro | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const atual = await client.query<{ fase_homolog: FaseHomolog; trust_score: number | null }>(
      `SELECT fase_homolog, trust_score FROM sevenconstruction.parceiros WHERE id = $1 FOR UPDATE`,
      [parceiro_id],
    );
    if (!atual.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const fase_de = atual.rows[0].fase_homolog;
    const score = opts.trust_score ?? atual.rows[0].trust_score;

    const upd = await client.query<Parceiro>(
      `UPDATE sevenconstruction.parceiros
          SET fase_homolog = $1,
              homologado_em = CASE WHEN $1 = 'homologado' THEN NOW() ELSE homologado_em END,
              homologado_por = CASE WHEN $1 = 'homologado' AND $2::int IS NOT NULL THEN $2::int ELSE homologado_por END,
              ativo = CASE WHEN $1 = 'reprovado' THEN FALSE WHEN $1 = 'homologado' THEN TRUE ELSE ativo END
        WHERE id = $3
        RETURNING *`,
      [fase, ator.tipo === "humano" ? ator.id : null, parceiro_id],
    );

    await client.query(
      `INSERT INTO sevenconstruction.parceiros_log_decisoes
         (parceiro_id, fase_de, fase_para, ator_id, ator_tipo, ator_nome, motivo, trust_score, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [parceiro_id, fase_de, fase, ator.id, ator.tipo, ator.nome, opts.motivo ?? null, score,
       opts.payload ? JSON.stringify(opts.payload) : null],
    );

    await client.query("COMMIT");
    return upd.rows[0] ?? null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listarLog(parceiro_id: number, limite = 50) {
  const r = await pool.query(
    `SELECT * FROM sevenconstruction.parceiros_log_decisoes
      WHERE parceiro_id = $1 ORDER BY criado_em DESC LIMIT $2`,
    [parceiro_id, limite],
  );
  return r.rows;
}

export async function lerDashboardSrm() {
  const r = await pool.query(`SELECT * FROM sevenconstruction.v_srm_dashboard`);
  const t = await pool.query(`SELECT * FROM sevenconstruction.v_srm_tempo_medio ORDER BY fase`);
  return { kpis: r.rows[0] ?? {}, tempos: t.rows };
}

// Atualiza pareceres + trust_score depois das analises das IAs.
export async function salvarAnalise(
  parceiro_id: number,
  patch: {
    parecer_compliance?: Record<string, unknown> | null;
    parecer_finance?: Record<string, unknown> | null;
    parecer_operacional?: Record<string, unknown> | null;
    parecer_legal?: Record<string, unknown> | null;
    trust_score?: number | null;
    risco_inicial?: "baixo" | "medio" | "alto" | null;
    recomendacao_ia?: "aprovar" | "revisar" | "reprovar" | null;
    recomendacao_motivo?: string | null;
  },
): Promise<Parceiro | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  const add = (col: string, v: unknown) => { args.push(v); sets.push(`${col} = $${args.length}`); };

  if (patch.parecer_compliance !== undefined)  add("parecer_compliance", patch.parecer_compliance ? JSON.stringify(patch.parecer_compliance) : null);
  if (patch.parecer_finance !== undefined)     add("parecer_finance", patch.parecer_finance ? JSON.stringify(patch.parecer_finance) : null);
  if (patch.parecer_operacional !== undefined) add("parecer_operacional", patch.parecer_operacional ? JSON.stringify(patch.parecer_operacional) : null);
  if (patch.parecer_legal !== undefined)       add("parecer_legal", patch.parecer_legal ? JSON.stringify(patch.parecer_legal) : null);
  if (patch.trust_score !== undefined)         add("trust_score", patch.trust_score);
  if (patch.risco_inicial !== undefined)       add("risco_inicial", patch.risco_inicial);
  if (patch.recomendacao_ia !== undefined)     add("recomendacao_ia", patch.recomendacao_ia);
  if (patch.recomendacao_motivo !== undefined) add("recomendacao_motivo", patch.recomendacao_motivo);
  sets.push(`ultima_analise_em = NOW()`);

  args.push(parceiro_id);
  const r = await pool.query<Parceiro>(
    `UPDATE sevenconstruction.parceiros SET ${sets.join(", ")} WHERE id = $${args.length} RETURNING *`,
    args,
  );
  return r.rows[0] ?? null;
}

// ===== DIFERENCIAIS SevenConstruction =====

// Auto-categoriza tipo de parceiro a partir do CNAE principal.
// Divisao 10-33 = industria; 46xx = atacado; 47xx = varejo; 4634-3 importacao.
export function categorizarPorCnae(cnae: string | null): TipoParceiro | null {
  if (!cnae) return null;
  const limpo = cnae.replace(/\D+/g, "");
  if (limpo.length < 4) return null;
  const div = parseInt(limpo.slice(0, 2), 10);
  const grupo4 = limpo.slice(0, 4);
  if (grupo4 === "4634") return "importador";       // Comercio atacadista de cimento
  if (grupo4 === "4679" || grupo4 === "4673") return "distribuidor"; // material constru atacado
  if (div >= 10 && div <= 33) return "fabrica";
  if (div === 46) return "distribuidor";
  if (div === 47) return "lojista";
  return "outros";
}

// Aplica categorizacao automatica baseada em CNAE (chamado no Pre Check).
export async function autoCategorizarTipo(parceiro_id: number, cnae: string | null): Promise<TipoParceiro | null> {
  const novo = categorizarPorCnae(cnae);
  if (!novo) return null;
  // Atualiza tipo somente se ainda esta em "outros" (nao sobrescreve manual)
  await pool.query(
    `UPDATE sevenconstruction.parceiros
        SET tipo = $1
      WHERE id = $2 AND tipo = 'outros'`,
    [novo, parceiro_id],
  );
  return novo;
}

// Lookalike: parceiros similares por tipo + UF + produtos compartilhados.
// Score = produtos compartilhados (peso 5) + mesma UF (peso 2) + mesmo tipo (peso 1).
export type ParceiroSimilar = {
  id: number;
  codigo: number;
  nome_fantasia: string;
  tipo: TipoParceiro;
  uf: string | null;
  cidade: string | null;
  trust_score: number | null;
  produtos_compartilhados: string[];
  score_lookalike: number;
};

export async function lookalike(parceiro_id: number, limite = 10): Promise<ParceiroSimilar[]> {
  const r = await pool.query<ParceiroSimilar>(
    `WITH base AS (
       SELECT p.tipo, p.uf
         FROM sevenconstruction.parceiros p
        WHERE p.id = $1
     ),
     produtos_base AS (
       SELECT pp.produto FROM sevenconstruction.parceiros_produtos pp WHERE pp.parceiro_id = $1
     ),
     candidatos AS (
       SELECT
         p.id, p.codigo, p.nome_fantasia, p.tipo, p.uf, p.cidade, p.trust_score,
         COALESCE(
           (SELECT array_agg(DISTINCT pp.produto_raw)
              FROM sevenconstruction.parceiros_produtos pp
             WHERE pp.parceiro_id = p.id
               AND pp.produto IN (SELECT produto FROM produtos_base)),
           ARRAY[]::TEXT[]
         ) AS produtos_compartilhados,
         (
           5 * COALESCE((
             SELECT COUNT(*) FROM sevenconstruction.parceiros_produtos pp
              WHERE pp.parceiro_id = p.id AND pp.produto IN (SELECT produto FROM produtos_base)
           ), 0)
           + (CASE WHEN p.uf = (SELECT uf FROM base) AND p.uf IS NOT NULL THEN 2 ELSE 0 END)
           + (CASE WHEN p.tipo = (SELECT tipo FROM base) THEN 1 ELSE 0 END)
         )::int AS score_lookalike
       FROM sevenconstruction.parceiros p
       WHERE p.id <> $1 AND p.ativo
     )
     SELECT * FROM candidatos
      WHERE score_lookalike > 0
      ORDER BY score_lookalike DESC, trust_score DESC NULLS LAST
      LIMIT $2`,
    [parceiro_id, limite],
  );
  return r.rows;
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
