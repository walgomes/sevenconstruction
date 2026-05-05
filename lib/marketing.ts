// Helpers de marketing outbound multi-tenant.
// Toda funcao filtra por loja_id (tenant isolation no app layer).

import pool from "@/lib/db";

export type KpiMarketing = {
  total_listas: number;
  total_campanhas: number;
  campanhas_ativas: number;
  total_templates: number;
  total_supressoes: number;
  enviados_30d: number;
};

export async function lerKpisMarketing(loja_id: number): Promise<KpiMarketing> {
  const r = await pool.query(
    `SELECT total_listas, total_campanhas, campanhas_ativas,
            total_templates, total_supressoes, enviados_30d
       FROM sevenconstruction.v_loja_marketing_kpis
      WHERE loja_id = $1`,
    [loja_id],
  );
  const row = r.rows[0] || {};
  return {
    total_listas: Number(row.total_listas ?? 0),
    total_campanhas: Number(row.total_campanhas ?? 0),
    campanhas_ativas: Number(row.campanhas_ativas ?? 0),
    total_templates: Number(row.total_templates ?? 0),
    total_supressoes: Number(row.total_supressoes ?? 0),
    enviados_30d: Number(row.enviados_30d ?? 0),
  };
}

// === LISTAS =====================================================
export type Lista = {
  id: number;
  nome: string;
  descricao: string | null;
  origem: string;
  total_contatos: number;
  ativo: boolean;
  criado_em: string;
};

export async function listarListasMkt(loja_id: number): Promise<Lista[]> {
  const r = await pool.query(
    `SELECT id, nome, descricao, origem, total_contatos, ativo, criado_em::text
       FROM sevenconstruction.mkt_listas
      WHERE loja_id = $1
      ORDER BY criado_em DESC
      LIMIT 100`,
    [loja_id],
  );
  return r.rows as Lista[];
}

export async function criarListaMkt(input: {
  loja_id: number;
  criado_por: number;
  nome: string;
  descricao?: string;
  origem?: string;
  prospec_lista_id?: number | null;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.mkt_listas
       (loja_id, criado_por, nome, descricao, origem, prospec_lista_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.loja_id,
      input.criado_por,
      input.nome,
      input.descricao ?? null,
      input.origem ?? "manual",
      input.prospec_lista_id ?? null,
    ],
  );
  return r.rows[0].id as number;
}

/**
 * Importa contatos de uma lista de prospec pra mkt_listas. Pulando supressões.
 */
export async function importarDeProspec(
  loja_id: number,
  prospec_lista_id: number,
  mkt_lista_id: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Confirma que a prospec_lista pertence à loja
    const verif = await client.query(
      `SELECT id FROM sevenconstruction.prospec_listas
        WHERE id = $1 AND loja_id = $2`,
      [prospec_lista_id, loja_id],
    );
    if (!verif.rows[0]) throw new Error("prospec_lista nao pertence a loja");

    const ins = await client.query(
      `INSERT INTO sevenconstruction.mkt_lista_contatos
         (lista_id, cnpj, nome, empresa, email, telefone, whatsapp, cidade, uf, metadados)
       SELECT $1,
              i.cnpj,
              COALESCE(NULLIF(i.razao_social, ''), i.nome_fantasia, '') AS nome,
              COALESCE(NULLIF(i.nome_fantasia, ''), i.razao_social, '') AS empresa,
              NULLIF(i.email, ''),
              NULLIF(i.telefone, ''),
              NULLIF(i.telefone, ''),
              i.cidade,
              i.uf,
              jsonb_build_object('origem','prospec','prospec_lista_id',$2,'cnae',i.cnae,'porte',i.porte)
         FROM sevenconstruction.prospec_lista_itens i
        WHERE i.lista_id = $2
       ON CONFLICT (lista_id, cnpj) DO NOTHING`,
      [mkt_lista_id, prospec_lista_id],
    );

    const n = ins.rowCount ?? 0;
    await client.query(
      `UPDATE sevenconstruction.mkt_listas SET total_contatos = total_contatos + $1 WHERE id = $2`,
      [n, mkt_lista_id],
    );

    await client.query("COMMIT");
    return n;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// === TEMPLATES ===================================================
export type Template = {
  id: number;
  nome: string;
  canal: string;
  assunto: string | null;
  corpo: string;
  ativo: boolean;
  criado_em: string;
};

export async function listarTemplates(loja_id: number, canal?: string): Promise<Template[]> {
  const params: unknown[] = [loja_id];
  let where = "loja_id = $1";
  if (canal) {
    params.push(canal);
    where += ` AND canal = $${params.length}`;
  }
  const r = await pool.query(
    `SELECT id, nome, canal, assunto, corpo, ativo, criado_em::text
       FROM sevenconstruction.mkt_templates
      WHERE ${where}
      ORDER BY criado_em DESC
      LIMIT 200`,
    params,
  );
  return r.rows as Template[];
}

export async function criarTemplate(input: {
  loja_id: number;
  criado_por: number;
  nome: string;
  canal: "email" | "whatsapp";
  assunto?: string | null;
  corpo: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.mkt_templates
       (loja_id, criado_por, nome, canal, assunto, corpo)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      input.loja_id,
      input.criado_por,
      input.nome,
      input.canal,
      input.canal === "email" ? (input.assunto ?? null) : null,
      input.corpo,
    ],
  );
  return r.rows[0].id as number;
}

// === SUPRESSOES ==================================================
export type Supressao = {
  id: number;
  destino: string;
  canal: string;
  motivo: string | null;
  origem: string | null;
  criado_em: string;
};

export async function listarSupressoes(loja_id: number): Promise<Supressao[]> {
  const r = await pool.query(
    `SELECT id, destino, canal, motivo, origem, criado_em::text
       FROM sevenconstruction.mkt_supressoes
      WHERE loja_id = $1
      ORDER BY criado_em DESC
      LIMIT 500`,
    [loja_id],
  );
  return r.rows as Supressao[];
}

export async function adicionarSupressao(input: {
  loja_id: number;
  destino: string;
  canal: "email" | "whatsapp";
  motivo?: string;
  origem?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO sevenconstruction.mkt_supressoes
       (loja_id, destino, canal, motivo, origem)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (loja_id, destino, canal) DO NOTHING`,
    [input.loja_id, input.destino.trim().toLowerCase(), input.canal, input.motivo ?? "manual", input.origem ?? "manual"],
  );
}

// === CAMPANHAS ===================================================
export type Campanha = {
  id: number;
  nome: string;
  canal: string;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  agendada_para: string | null;
  criado_em: string;
};

export async function listarCampanhas(loja_id: number): Promise<Campanha[]> {
  const r = await pool.query(
    `SELECT id, nome, canal, status, total_destinatarios, total_enviados,
            total_falhas, agendada_para::text, criado_em::text
       FROM sevenconstruction.mkt_campanhas
      WHERE loja_id = $1
      ORDER BY criado_em DESC
      LIMIT 100`,
    [loja_id],
  );
  return r.rows as Campanha[];
}

export async function criarCampanha(input: {
  loja_id: number;
  criado_por: number;
  nome: string;
  canal: "email" | "whatsapp";
  lista_id: number;
  template_id?: number | null;
  agendada_para?: string | null;
}): Promise<number> {
  // Conta destinatarios na lista
  const c = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM sevenconstruction.mkt_lista_contatos
      WHERE lista_id = $1`,
    [input.lista_id],
  );
  const total = c.rows[0]?.total ?? 0;

  const r = await pool.query(
    `INSERT INTO sevenconstruction.mkt_campanhas
       (loja_id, criado_por, nome, canal, lista_id, template_id,
        agendada_para, total_destinatarios)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      input.loja_id,
      input.criado_por,
      input.nome,
      input.canal,
      input.lista_id,
      input.template_id ?? null,
      input.agendada_para ?? null,
      total,
    ],
  );
  return r.rows[0].id as number;
}
