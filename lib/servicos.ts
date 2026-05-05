// Catalogo master de servicos digitais + ativacao por loja.

import pool from "@/lib/db";

export type ServicoCatalogo = {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  modo: string | null;             // 'automatica' | 'concierge' | 'paga'
  emissor: string | null;
  link_emissor: string | null;
  prerequisito: string | null;
  preco_custo: number;
  preco_venda_sugerido: number;
  comissao_loja_pct: number;
  descricao: string | null;
  pitch_curto: string | null;
  para_quem: string | null;
  casos_uso: string[] | null;
  prazo_entrega: string | null;
  como_vender: string | null;
  ativo_default: boolean;
  ordem: number;
};

export type ServicoComAtivacao = ServicoCatalogo & {
  ativo_na_loja: boolean;
  preco_venda_custom: number | null;
  preco_efetivo: number;
  margem_loja: number;
};

export async function listarServicosComAtivacao(
  loja_id: number,
): Promise<ServicoComAtivacao[]> {
  const r = await pool.query(
    `SELECT c.id, c.codigo, c.nome, c.categoria, c.modo, c.emissor,
            c.link_emissor, c.prerequisito,
            c.preco_custo, c.preco_venda_sugerido, c.comissao_loja_pct, c.descricao,
            c.pitch_curto, c.para_quem, c.casos_uso, c.prazo_entrega, c.como_vender,
            c.ativo_default, c.ordem,
            COALESCE(a.ativo, c.ativo_default) AS ativo_na_loja,
            a.preco_venda_custom
       FROM sevenconstruction.servicos_catalogo c
       LEFT JOIN sevenconstruction.servico_loja_ativacao a
         ON a.servico_id = c.id AND a.loja_id = $1
      ORDER BY c.ordem, c.id`,
    [loja_id],
  );
  return r.rows.map((row) => {
    const preco_efetivo = Number(row.preco_venda_custom ?? row.preco_venda_sugerido);
    const custo = Number(row.preco_custo);
    const margem_total = preco_efetivo - custo;
    const margem_loja = margem_total * (Number(row.comissao_loja_pct) / 100);
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      categoria: row.categoria,
      modo: row.modo,
      emissor: row.emissor,
      link_emissor: row.link_emissor,
      prerequisito: row.prerequisito,
      preco_custo: custo,
      preco_venda_sugerido: Number(row.preco_venda_sugerido),
      comissao_loja_pct: Number(row.comissao_loja_pct),
      descricao: row.descricao,
      pitch_curto: row.pitch_curto,
      para_quem: row.para_quem,
      casos_uso: row.casos_uso,
      prazo_entrega: row.prazo_entrega,
      como_vender: row.como_vender,
      ativo_default: row.ativo_default,
      ordem: row.ordem,
      ativo_na_loja: row.ativo_na_loja,
      preco_venda_custom: row.preco_venda_custom != null ? Number(row.preco_venda_custom) : null,
      preco_efetivo,
      margem_loja,
    };
  });
}

export async function ativarServicoNaLoja(
  loja_id: number,
  servico_id: number,
  ativo: boolean,
  preco_venda_custom?: number | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO sevenconstruction.servico_loja_ativacao
       (loja_id, servico_id, ativo, preco_venda_custom)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (loja_id, servico_id) DO UPDATE
       SET ativo = EXCLUDED.ativo,
           preco_venda_custom = EXCLUDED.preco_venda_custom,
           atualizado_em = NOW()`,
    [loja_id, servico_id, ativo, preco_venda_custom ?? null],
  );
}

export async function listarServicosAtivosLoja(loja_id: number): Promise<ServicoCatalogo[]> {
  const r = await pool.query(
    `SELECT c.id, c.codigo, c.nome, c.categoria,
            COALESCE(a.preco_venda_custom, c.preco_venda_sugerido) AS preco_venda_sugerido,
            c.preco_custo, c.comissao_loja_pct, c.descricao, c.ativo_default, c.ordem
       FROM sevenconstruction.servicos_catalogo c
       JOIN sevenconstruction.servico_loja_ativacao a
         ON a.servico_id = c.id AND a.loja_id = $1
      WHERE a.ativo = TRUE
      ORDER BY c.ordem, c.id`,
    [loja_id],
  );
  return r.rows as ServicoCatalogo[];
}
