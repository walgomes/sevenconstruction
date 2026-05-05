// Ledger de comissoes da loja.

import pool from "@/lib/db";

export type EventoComissao = {
  id: number;
  cliente_id: number | null;
  cliente_nome: string | null;
  servico_id: number | null;
  servico_codigo: string | null;
  servico_nome: string | null;
  valor_venda: number;
  valor_custo: number;
  comissao_loja: number;
  status: string;
  descricao: string | null;
  criado_em: string;
};

export type ResumoComissoes = {
  total_mes: number;
  total_acumulado: number;
  qtd_eventos_mes: number;
  qtd_eventos_total: number;
  ticket_medio: number;
};

export async function lerResumoComissoes(loja_id: number): Promise<ResumoComissoes> {
  const r = await pool.query(
    `SELECT total_mes, total_acumulado, qtd_eventos_mes, qtd_eventos_total, ticket_medio
       FROM sevenconstruction.v_loja_comissoes_resumo
      WHERE loja_id = $1`,
    [loja_id],
  );
  const row = r.rows[0] || {};
  return {
    total_mes: Number(row.total_mes ?? 0),
    total_acumulado: Number(row.total_acumulado ?? 0),
    qtd_eventos_mes: Number(row.qtd_eventos_mes ?? 0),
    qtd_eventos_total: Number(row.qtd_eventos_total ?? 0),
    ticket_medio: Number(row.ticket_medio ?? 0),
  };
}

export async function listarEventosComissao(
  loja_id: number,
  limite = 50,
): Promise<EventoComissao[]> {
  const r = await pool.query(
    `SELECT e.id, e.cliente_id, c.nome_razao AS cliente_nome,
            e.servico_id, e.servico_codigo, e.servico_nome,
            e.valor_venda, e.valor_custo, e.comissao_loja,
            e.status, e.descricao, e.criado_em::text
       FROM sevenconstruction.comissao_evento e
       LEFT JOIN sevenconstruction.loja_clientes c ON c.id = e.cliente_id
      WHERE e.loja_id = $1
      ORDER BY e.criado_em DESC
      LIMIT $2`,
    [loja_id, Math.min(Math.max(limite, 1), 1000)],
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    cliente_id: row.cliente_id,
    cliente_nome: row.cliente_nome,
    servico_id: row.servico_id,
    servico_codigo: row.servico_codigo,
    servico_nome: row.servico_nome,
    valor_venda: Number(row.valor_venda),
    valor_custo: Number(row.valor_custo),
    comissao_loja: Number(row.comissao_loja),
    status: row.status,
    descricao: row.descricao,
    criado_em: row.criado_em,
  }));
}

export type RegistrarVendaInput = {
  loja_id: number;
  cliente_id?: number | null;
  servico_id: number;
  valor_venda?: number;             // se null, usa preco_venda_sugerido ou custom da loja
  descricao?: string;
  criado_por: number;
  metadados?: Record<string, unknown>;
};

/**
 * Registra venda de servico digital ao cliente. Calcula comissao automaticamente
 * com base no preco efetivo (custom da loja ou sugerido) e no comissao_loja_pct.
 */
export async function registrarVendaServico(
  input: RegistrarVendaInput,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Carrega dados do servico + ativacao da loja (preco custom)
    const r = await client.query(
      `SELECT c.id, c.codigo, c.nome, c.preco_custo,
              c.preco_venda_sugerido, c.comissao_loja_pct,
              a.preco_venda_custom
         FROM sevenconstruction.servicos_catalogo c
         LEFT JOIN sevenconstruction.servico_loja_ativacao a
           ON a.servico_id = c.id AND a.loja_id = $1
        WHERE c.id = $2`,
      [input.loja_id, input.servico_id],
    );
    const s = r.rows[0];
    if (!s) throw new Error("Servico nao encontrado");

    const preco_efetivo = Number(s.preco_venda_custom ?? s.preco_venda_sugerido);
    const valor_venda = input.valor_venda != null ? Number(input.valor_venda) : preco_efetivo;
    const valor_custo = Number(s.preco_custo);
    const margem_total = Math.max(valor_venda - valor_custo, 0);
    const comissao = margem_total * (Number(s.comissao_loja_pct) / 100);

    // Verifica que cliente_id pertence a loja, se informado
    if (input.cliente_id) {
      const v = await client.query(
        `SELECT id FROM sevenconstruction.loja_clientes WHERE id = $1 AND loja_id = $2`,
        [input.cliente_id, input.loja_id],
      );
      if (!v.rows[0]) throw new Error("Cliente nao pertence a loja");
    }

    const ins = await client.query(
      `INSERT INTO sevenconstruction.comissao_evento
         (loja_id, cliente_id, servico_id, servico_codigo, servico_nome,
          valor_venda, valor_custo, comissao_loja, descricao,
          metadados, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.loja_id,
        input.cliente_id ?? null,
        s.id,
        s.codigo,
        s.nome,
        valor_venda,
        valor_custo,
        comissao,
        input.descricao ?? null,
        JSON.stringify(input.metadados ?? {}),
        input.criado_por,
      ],
    );

    await client.query("COMMIT");
    return ins.rows[0].id as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
