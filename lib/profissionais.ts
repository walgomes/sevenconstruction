// Diretorio de profissionais por loja + ledger de indicacoes.

import pool from "@/lib/db";

export type Profissional = {
  id: number;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  categoria: string;
  especialidade: string | null;
  anos_experiencia: number | null;
  avaliacao_media: number | null;
  observacoes: string | null;
  codigo_indicacao: string;
  comissao_pct: number;
  comissao_fixa: number | null;
  ativo: boolean;
  destaque: boolean;
  criado_em: string;
};

export type ProfissionalRanking = Profissional & {
  qtd_indicacoes: number;
  total_comissao: number;
  comissao_mes: number;
  ultima_indicacao: string | null;
};

export const CATEGORIAS_PROFISSIONAIS = [
  { v: "arquiteto", label: "Arquiteto" },
  { v: "engenheiro", label: "Engenheiro" },
  { v: "mestre_obras", label: "Mestre de obras" },
  { v: "pedreiro", label: "Pedreiro" },
  { v: "ajudante", label: "Ajudante" },
  { v: "carpinteiro", label: "Carpinteiro" },
  { v: "eletricista", label: "Eletricista" },
  { v: "encanador", label: "Encanador" },
  { v: "pintor", label: "Pintor" },
  { v: "serralheiro", label: "Serralheiro" },
  { v: "corretor_imovel", label: "Corretor de imóvel" },
  { v: "designer", label: "Designer de interiores" },
  { v: "paisagista", label: "Paisagista" },
  { v: "outros", label: "Outros" },
] as const;

function gerarCodigoIndicacao(nome: string, loja_id: number): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6) || "PRO";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${loja_id}-${rand}`;
}

export type FiltroProfissionais = {
  loja_id: number;
  categoria?: string;
  cidade?: string;
  busca?: string;
  apenas_ativos?: boolean;
};

export async function listarProfissionais(
  f: FiltroProfissionais,
): Promise<ProfissionalRanking[]> {
  const conds: string[] = [`p.loja_id = $1`];
  const params: unknown[] = [f.loja_id];

  if (f.apenas_ativos !== false) conds.push("p.ativo = TRUE");

  if (f.categoria) {
    params.push(f.categoria);
    conds.push(`p.categoria = $${params.length}`);
  }
  if (f.cidade) {
    params.push(f.cidade);
    conds.push(`p.cidade ILIKE $${params.length}`);
  }
  if (f.busca && f.busca.trim().length >= 2) {
    params.push(`%${f.busca.trim()}%`);
    conds.push(
      `(p.nome ILIKE $${params.length} OR p.especialidade ILIKE $${params.length})`,
    );
  }

  const r = await pool.query(
    `SELECT p.id, p.nome, p.cpf, p.cnpj, p.telefone, p.whatsapp, p.email,
            p.cidade, p.uf, p.bairro, p.categoria, p.especialidade,
            p.anos_experiencia, p.avaliacao_media, p.observacoes,
            p.codigo_indicacao, p.comissao_pct, p.comissao_fixa,
            p.ativo, p.destaque, p.criado_em::text,
            COALESCE(v.qtd_indicacoes, 0) AS qtd_indicacoes,
            COALESCE(v.total_comissao, 0) AS total_comissao,
            COALESCE(v.comissao_mes, 0) AS comissao_mes,
            v.ultima_indicacao::text
       FROM sevenconstruction.profissionais p
       LEFT JOIN sevenconstruction.v_profissionais_ranking v ON v.id = p.id
      WHERE ${conds.join(" AND ")}
      ORDER BY p.destaque DESC, COALESCE(v.qtd_indicacoes, 0) DESC, p.criado_em DESC
      LIMIT 200`,
    params,
  );

  return r.rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    cnpj: row.cnpj,
    telefone: row.telefone,
    whatsapp: row.whatsapp,
    email: row.email,
    cidade: row.cidade,
    uf: row.uf,
    bairro: row.bairro,
    categoria: row.categoria,
    especialidade: row.especialidade,
    anos_experiencia: row.anos_experiencia,
    avaliacao_media: row.avaliacao_media != null ? Number(row.avaliacao_media) : null,
    observacoes: row.observacoes,
    codigo_indicacao: row.codigo_indicacao,
    comissao_pct: Number(row.comissao_pct),
    comissao_fixa: row.comissao_fixa != null ? Number(row.comissao_fixa) : null,
    ativo: row.ativo,
    destaque: row.destaque,
    criado_em: row.criado_em,
    qtd_indicacoes: Number(row.qtd_indicacoes ?? 0),
    total_comissao: Number(row.total_comissao ?? 0),
    comissao_mes: Number(row.comissao_mes ?? 0),
    ultima_indicacao: row.ultima_indicacao,
  }));
}

export type CriarProfissionalInput = {
  loja_id: number;
  criado_por: number;
  nome: string;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bairro?: string | null;
  categoria: string;
  especialidade?: string | null;
  anos_experiencia?: number | null;
  observacoes?: string | null;
  comissao_pct?: number;
  comissao_fixa?: number | null;
};

export async function criarProfissional(
  input: CriarProfissionalInput,
): Promise<{ id: number; codigo_indicacao: string }> {
  const codigo = gerarCodigoIndicacao(input.nome, input.loja_id);
  const r = await pool.query(
    `INSERT INTO sevenconstruction.profissionais
       (loja_id, criado_por, nome, cpf, cnpj, telefone, whatsapp, email,
        cidade, uf, bairro, categoria, especialidade, anos_experiencia,
        observacoes, codigo_indicacao, comissao_pct, comissao_fixa)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id, codigo_indicacao`,
    [
      input.loja_id,
      input.criado_por,
      input.nome.trim(),
      input.cpf ? input.cpf.replace(/\D/g, "") : null,
      input.cnpj ? input.cnpj.replace(/\D/g, "") : null,
      input.telefone ?? null,
      input.whatsapp ?? input.telefone ?? null,
      input.email ?? null,
      input.cidade ?? null,
      input.uf ?? null,
      input.bairro ?? null,
      input.categoria,
      input.especialidade ?? null,
      input.anos_experiencia ?? null,
      input.observacoes ?? null,
      codigo,
      input.comissao_pct ?? 5.0,
      input.comissao_fixa ?? null,
    ],
  );
  return { id: r.rows[0].id, codigo_indicacao: r.rows[0].codigo_indicacao };
}

export type RegistrarIndicacaoInput = {
  loja_id: number;
  profissional_id: number;
  cliente_id?: number | null;
  valor_venda: number;
  descricao?: string | null;
  criado_por: number;
};

export async function registrarIndicacao(
  input: RegistrarIndicacaoInput,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const p = await client.query(
      `SELECT id, nome, comissao_pct, comissao_fixa
         FROM sevenconstruction.profissionais
        WHERE id = $1 AND loja_id = $2`,
      [input.profissional_id, input.loja_id],
    );
    if (!p.rows[0]) throw new Error("Profissional nao encontrado nesta loja");
    const prof = p.rows[0];

    let cliente_nome: string | null = null;
    if (input.cliente_id) {
      const c = await client.query(
        `SELECT nome_razao FROM sevenconstruction.loja_clientes
          WHERE id = $1 AND loja_id = $2`,
        [input.cliente_id, input.loja_id],
      );
      if (!c.rows[0]) throw new Error("Cliente nao pertence a loja");
      cliente_nome = c.rows[0].nome_razao;
    }

    const comissao =
      prof.comissao_fixa != null
        ? Number(prof.comissao_fixa)
        : (Number(input.valor_venda) * Number(prof.comissao_pct)) / 100;

    const r = await client.query(
      `INSERT INTO sevenconstruction.indicacao_evento
         (loja_id, profissional_id, cliente_id, profissional_nome, cliente_nome,
          valor_venda, comissao_valor, descricao, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        input.loja_id,
        input.profissional_id,
        input.cliente_id ?? null,
        prof.nome,
        cliente_nome,
        input.valor_venda,
        comissao,
        input.descricao ?? null,
        input.criado_por,
      ],
    );

    await client.query("COMMIT");
    return r.rows[0].id as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function resumoProfissionais(loja_id: number): Promise<{
  total: number;
  ativos: number;
  com_indicacao: number;
  comissao_mes_pendente: number;
}> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ativo)::int AS ativos,
            COUNT(*) FILTER (
              WHERE id IN (
                SELECT profissional_id FROM sevenconstruction.indicacao_evento
                 WHERE loja_id = $1
              )
            )::int AS com_indicacao
       FROM sevenconstruction.profissionais
      WHERE loja_id = $1`,
    [loja_id],
  );
  const r2 = await pool.query(
    `SELECT COALESCE(SUM(comissao_valor), 0)::float AS pendente
       FROM sevenconstruction.indicacao_evento
      WHERE loja_id = $1
        AND status = 'aprovada'
        AND criado_em >= DATE_TRUNC('month', NOW())`,
    [loja_id],
  );
  return {
    total: Number(r.rows[0]?.total ?? 0),
    ativos: Number(r.rows[0]?.ativos ?? 0),
    com_indicacao: Number(r.rows[0]?.com_indicacao ?? 0),
    comissao_mes_pendente: Number(r2.rows[0]?.pendente ?? 0),
  };
}
