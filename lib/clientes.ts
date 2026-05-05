// Helpers da base de clientes da loja (multi-tenant).
// Toda funcao filtra por loja_id.

import pool from "@/lib/db";

export type ClienteLoja = {
  id: number;
  tipo_pessoa: "J" | "F";
  cnpj: string | null;
  cpf: string | null;
  nome_razao: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  cnae_principal: string | null;
  porte: string | null;
  rating_interno: string | null;
  origem: string;
  ultimo_compra_em: string | null;
  valor_total_comprado: number;
  qtd_compras: number;
  ativo: boolean;
  criado_em: string;
};

export type FiltroClientes = {
  loja_id: number;
  cidade?: string;
  rating?: string;            // 'verde' | 'amarelo' | 'vermelho'
  origem?: string;            // 'manual' | 'prospec' | 'importacao' | 'wizard'
  busca?: string;             // texto livre em nome_razao
  apenas_ativos?: boolean;
  limite?: number;
};

export async function listarClientesLoja(
  filtro: FiltroClientes,
): Promise<ClienteLoja[]> {
  const conds: string[] = [`loja_id = $1`];
  const params: unknown[] = [filtro.loja_id];

  if (filtro.apenas_ativos !== false) conds.push("ativo = true");

  if (filtro.cidade) {
    params.push(filtro.cidade);
    conds.push(`cidade ILIKE $${params.length}`);
  }
  if (filtro.rating) {
    params.push(filtro.rating);
    conds.push(`rating_interno = $${params.length}`);
  }
  if (filtro.origem) {
    params.push(filtro.origem);
    conds.push(`origem = $${params.length}`);
  }
  if (filtro.busca && filtro.busca.trim().length >= 2) {
    params.push(`%${filtro.busca.trim()}%`);
    conds.push(
      `(nome_razao ILIKE $${params.length} OR nome_fantasia ILIKE $${params.length})`,
    );
  }

  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 1000);
  const r = await pool.query(
    `SELECT id, tipo_pessoa, cnpj, cpf, nome_razao, nome_fantasia,
            email, telefone, whatsapp, cidade, uf, bairro,
            cnae_principal, porte, rating_interno, origem,
            ultimo_compra_em::text, valor_total_comprado, qtd_compras,
            ativo, criado_em::text
       FROM sevenconstruction.loja_clientes
      WHERE ${conds.join(" AND ")}
      ORDER BY valor_total_comprado DESC, criado_em DESC
      LIMIT ${limite}`,
    params,
  );
  return r.rows as ClienteLoja[];
}

export type CriarClienteInput = {
  loja_id: number;
  criado_por: number;
  tipo_pessoa: "J" | "F";
  cnpj?: string | null;
  cpf?: string | null;
  nome_razao: string;
  nome_fantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string;
  observacoes?: string | null;
};

function limparDoc(s: string | null | undefined): string | null {
  if (!s) return null;
  const limpo = s.replace(/\D/g, "");
  return limpo || null;
}

export async function criarClienteManual(
  input: CriarClienteInput,
): Promise<number> {
  const cnpj = input.tipo_pessoa === "J" ? limparDoc(input.cnpj) : null;
  const cpf = input.tipo_pessoa === "F" ? limparDoc(input.cpf) : null;
  if (input.tipo_pessoa === "J" && (!cnpj || cnpj.length !== 14)) {
    throw new Error("CNPJ invalido");
  }
  if (input.tipo_pessoa === "F" && (!cpf || cpf.length !== 11)) {
    throw new Error("CPF invalido");
  }

  const r = await pool.query(
    `INSERT INTO sevenconstruction.loja_clientes
       (loja_id, criado_por, tipo_pessoa, cnpj, cpf, nome_razao, nome_fantasia,
        email, telefone, whatsapp, cep, endereco, numero, bairro, cidade, uf,
        origem, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (loja_id, cnpj) DO UPDATE
       SET nome_razao    = COALESCE(NULLIF(EXCLUDED.nome_razao, ''), sevenconstruction.loja_clientes.nome_razao),
           nome_fantasia = COALESCE(EXCLUDED.nome_fantasia, sevenconstruction.loja_clientes.nome_fantasia),
           email         = COALESCE(EXCLUDED.email, sevenconstruction.loja_clientes.email),
           telefone      = COALESCE(EXCLUDED.telefone, sevenconstruction.loja_clientes.telefone)
     RETURNING id`,
    [
      input.loja_id,
      input.criado_por,
      input.tipo_pessoa,
      cnpj,
      cpf,
      input.nome_razao.trim().slice(0, 300),
      input.nome_fantasia ?? null,
      input.email ?? null,
      input.telefone ?? null,
      input.whatsapp ?? null,
      input.cep ?? null,
      input.endereco ?? null,
      input.numero ?? null,
      input.bairro ?? null,
      input.cidade ?? null,
      input.uf ?? null,
      input.origem ?? "manual",
      input.observacoes ?? null,
    ],
  );
  return r.rows[0].id as number;
}

/**
 * Importa clientes de uma prospec_lista pra base de clientes da loja.
 * Cada item da prospec vira um loja_cliente com origem='prospec'.
 */
export async function importarClientesDeProspec(
  loja_id: number,
  prospec_lista_id: number,
  criado_por: number,
): Promise<{ inseridos: number; ja_existiam: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Confirma posse da prospec_lista
    const verif = await client.query(
      `SELECT id FROM sevenconstruction.prospec_listas
        WHERE id = $1 AND loja_id = $2`,
      [prospec_lista_id, loja_id],
    );
    if (!verif.rows[0]) throw new Error("prospec_lista nao pertence a loja");

    const r = await client.query(
      `INSERT INTO sevenconstruction.loja_clientes
         (loja_id, criado_por, tipo_pessoa, cnpj, nome_razao, nome_fantasia,
          email, telefone, cidade, uf, bairro, cnae_principal, porte, origem)
       SELECT $1, $2, 'J',
              i.cnpj,
              COALESCE(NULLIF(i.razao_social, ''), i.nome_fantasia, '(sem nome)') AS nome_razao,
              NULLIF(i.nome_fantasia, ''),
              NULLIF(i.email, ''),
              NULLIF(i.telefone, ''),
              i.cidade,
              i.uf,
              i.bairro,
              i.cnae,
              i.porte,
              'prospec'
         FROM sevenconstruction.prospec_lista_itens i
        WHERE i.lista_id = $3 AND i.cnpj IS NOT NULL AND length(i.cnpj) = 14
       ON CONFLICT (loja_id, cnpj) DO NOTHING
       RETURNING id`,
      [loja_id, criado_por, prospec_lista_id],
    );

    // Total possivel na lista vs efetivamente inserido = quantos ja existiam
    const total_lista = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM sevenconstruction.prospec_lista_itens
        WHERE lista_id = $1 AND cnpj IS NOT NULL AND length(cnpj) = 14`,
      [prospec_lista_id],
    );

    const inseridos = r.rowCount ?? 0;
    const ja_existiam = (total_lista.rows[0]?.n ?? 0) - inseridos;

    await client.query("COMMIT");
    return { inseridos, ja_existiam };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export type ResumoClientes = {
  total: number;
  com_compra: number;
  ticket_medio: number;
  rating_verde: number;
};

export async function resumoClientesLoja(loja_id: number): Promise<ResumoClientes> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE qtd_compras > 0)::int AS com_compra,
            COALESCE(AVG(valor_total_comprado) FILTER (WHERE qtd_compras > 0), 0)::float AS ticket_medio,
            COUNT(*) FILTER (WHERE rating_interno = 'verde')::int AS rating_verde
       FROM sevenconstruction.loja_clientes
      WHERE loja_id = $1 AND ativo = true`,
    [loja_id],
  );
  const row = r.rows[0] || {};
  return {
    total: Number(row.total ?? 0),
    com_compra: Number(row.com_compra ?? 0),
    ticket_medio: Number(row.ticket_medio ?? 0),
    rating_verde: Number(row.rating_verde ?? 0),
  };
}

export async function listarProspecListasDaLoja(
  loja_id: number,
): Promise<{ id: number; nome: string; total_itens: number; criado_em: string }[]> {
  const r = await pool.query(
    `SELECT id, nome, total_itens, criado_em::text
       FROM sevenconstruction.prospec_listas
      WHERE loja_id = $1
      ORDER BY criado_em DESC
      LIMIT 50`,
    [loja_id],
  );
  return r.rows;
}
