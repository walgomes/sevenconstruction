// Helpers do Sistema Loja: produtos, fornecedores, notas entrada,
// contas a pagar, contas a receber. Multi-tenant via loja_id.

import pool from "@/lib/db";

export type KpisSistema = {
  total_produtos: number;
  produtos_estoque_baixo: number;
  valor_estoque_custo: number;
  total_fornecedores: number;
  notas_entrada_30d: number;
  contas_pagar_abertas: number;
  valor_contas_pagar: number;
  contas_pagar_atrasadas: number;
  contas_receber_abertas: number;
  valor_contas_receber: number;
  contas_receber_atrasadas: number;
  total_clientes: number;
};

export async function lerKpisSistema(loja_id: number): Promise<KpisSistema> {
  const r = await pool.query(
    `SELECT * FROM sevenconstruction.v_loja_sistema_kpis WHERE loja_id = $1`,
    [loja_id],
  );
  const row = r.rows[0] || {};
  return {
    total_produtos: Number(row.total_produtos ?? 0),
    produtos_estoque_baixo: Number(row.produtos_estoque_baixo ?? 0),
    valor_estoque_custo: Number(row.valor_estoque_custo ?? 0),
    total_fornecedores: Number(row.total_fornecedores ?? 0),
    notas_entrada_30d: Number(row.notas_entrada_30d ?? 0),
    contas_pagar_abertas: Number(row.contas_pagar_abertas ?? 0),
    valor_contas_pagar: Number(row.valor_contas_pagar ?? 0),
    contas_pagar_atrasadas: Number(row.contas_pagar_atrasadas ?? 0),
    contas_receber_abertas: Number(row.contas_receber_abertas ?? 0),
    valor_contas_receber: Number(row.valor_contas_receber ?? 0),
    contas_receber_atrasadas: Number(row.contas_receber_atrasadas ?? 0),
    total_clientes: Number(row.total_clientes ?? 0),
  };
}

// ============ PRODUTOS ============
export type Produto = {
  id: number;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  marca: string | null;
  ncm: string | null;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: string;
};

export async function listarProdutos(
  loja_id: number,
  filtro?: { busca?: string; categoria?: string; estoque_baixo?: boolean },
): Promise<Produto[]> {
  const conds: string[] = [`loja_id = $1`, `ativo = TRUE`];
  const params: unknown[] = [loja_id];
  if (filtro?.busca && filtro.busca.trim().length >= 2) {
    params.push(`%${filtro.busca.trim()}%`);
    conds.push(`(nome ILIKE $${params.length} OR codigo ILIKE $${params.length} OR marca ILIKE $${params.length})`);
  }
  if (filtro?.categoria) {
    params.push(filtro.categoria);
    conds.push(`categoria = $${params.length}`);
  }
  if (filtro?.estoque_baixo) {
    conds.push(`estoque_atual <= estoque_minimo`);
  }
  const r = await pool.query(
    `SELECT id, codigo, nome, categoria, marca, ncm, unidade,
            preco_custo::float, preco_venda::float,
            estoque_atual::float, estoque_minimo::float, ativo, criado_em::text
       FROM sevenconstruction.produtos
      WHERE ${conds.join(" AND ")}
      ORDER BY nome
      LIMIT 500`,
    params,
  );
  return r.rows;
}

export async function criarProduto(input: {
  loja_id: number; criado_por: number;
  codigo?: string; nome: string; categoria?: string; marca?: string;
  ncm?: string; unidade?: string;
  preco_custo?: number; preco_venda?: number;
  estoque_atual?: number; estoque_minimo?: number;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.produtos
       (loja_id, criado_por, codigo, nome, categoria, marca, ncm, unidade,
        preco_custo, preco_venda, estoque_atual, estoque_minimo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      input.loja_id, input.criado_por,
      input.codigo ?? null, input.nome, input.categoria ?? null, input.marca ?? null,
      input.ncm ?? null, input.unidade ?? "un",
      input.preco_custo ?? 0, input.preco_venda ?? 0,
      input.estoque_atual ?? 0, input.estoque_minimo ?? 0,
    ],
  );
  return r.rows[0].id;
}

// ============ FORNECEDORES ============
export type Fornecedor = {
  id: number;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  prazo_pagamento_dias: number;
  condicao_pagamento: string | null;
  ativo: boolean;
};

export async function listarFornecedores(
  loja_id: number,
  busca?: string,
): Promise<Fornecedor[]> {
  const conds: string[] = [`loja_id = $1`, `ativo = TRUE`];
  const params: unknown[] = [loja_id];
  if (busca && busca.trim().length >= 2) {
    params.push(`%${busca.trim()}%`);
    conds.push(`(razao_social ILIKE $${params.length} OR nome_fantasia ILIKE $${params.length} OR cnpj ILIKE $${params.length})`);
  }
  const r = await pool.query(
    `SELECT id, cnpj, razao_social, nome_fantasia, email, telefone,
            cidade, uf, prazo_pagamento_dias, condicao_pagamento, ativo
       FROM sevenconstruction.fornecedores
      WHERE ${conds.join(" AND ")}
      ORDER BY razao_social
      LIMIT 200`,
    params,
  );
  return r.rows;
}

export async function criarFornecedor(input: {
  loja_id: number; criado_por: number;
  cnpj?: string; razao_social: string; nome_fantasia?: string;
  email?: string; telefone?: string; whatsapp?: string;
  cidade?: string; uf?: string;
  prazo_pagamento_dias?: number; condicao_pagamento?: string;
  pix_chave?: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.fornecedores
       (loja_id, criado_por, cnpj, razao_social, nome_fantasia,
        email, telefone, whatsapp, cidade, uf,
        prazo_pagamento_dias, condicao_pagamento, pix_chave)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      input.loja_id, input.criado_por,
      input.cnpj ? input.cnpj.replace(/\D/g, "") : null,
      input.razao_social, input.nome_fantasia ?? null,
      input.email ?? null, input.telefone ?? null, input.whatsapp ?? null,
      input.cidade ?? null, input.uf ?? null,
      input.prazo_pagamento_dias ?? 0, input.condicao_pagamento ?? null,
      input.pix_chave ?? null,
    ],
  );
  return r.rows[0].id;
}

// ============ CONTAS A PAGAR ============
export type ContaPagar = {
  id: number;
  fornecedor_nome: string | null;
  descricao: string;
  categoria_despesa: string | null;
  valor: number;
  vencimento: string;
  status: string;
  forma_pagamento: string | null;
  pago_em: string | null;
  valor_pago: number | null;
  dias_vencido: number | null;
};

export async function listarContasPagar(
  loja_id: number,
  status?: string,
): Promise<ContaPagar[]> {
  const conds: string[] = [`c.loja_id = $1`];
  const params: unknown[] = [loja_id];
  if (status) {
    params.push(status);
    conds.push(`c.status = $${params.length}`);
  }
  const r = await pool.query(
    `SELECT c.id, f.razao_social AS fornecedor_nome,
            c.descricao, c.categoria_despesa, c.valor::float,
            c.vencimento::text, c.status, c.forma_pagamento,
            c.pago_em::text, c.valor_pago::float,
            CASE WHEN c.status IN ('aberta','parcial') AND c.vencimento < CURRENT_DATE
                 THEN (CURRENT_DATE - c.vencimento)
                 ELSE NULL END AS dias_vencido
       FROM sevenconstruction.conta_pagar c
       LEFT JOIN sevenconstruction.fornecedores f ON f.id = c.fornecedor_id
      WHERE ${conds.join(" AND ")}
      ORDER BY c.vencimento ASC, c.id DESC
      LIMIT 500`,
    params,
  );
  return r.rows;
}

export async function criarContaPagar(input: {
  loja_id: number; criado_por: number;
  fornecedor_id?: number;
  descricao: string;
  categoria_despesa?: string;
  valor: number;
  vencimento: string;
  forma_pagamento?: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.conta_pagar
       (loja_id, criado_por, fornecedor_id, descricao, categoria_despesa,
        valor, vencimento, forma_pagamento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      input.loja_id, input.criado_por, input.fornecedor_id ?? null,
      input.descricao, input.categoria_despesa ?? null,
      input.valor, input.vencimento,
      input.forma_pagamento ?? null,
    ],
  );
  return r.rows[0].id;
}

export async function pagarConta(loja_id: number, conta_id: number, valor_pago?: number): Promise<void> {
  await pool.query(
    `UPDATE sevenconstruction.conta_pagar
        SET status = 'paga', pago_em = NOW(), valor_pago = COALESCE($1, valor)
      WHERE id = $2 AND loja_id = $3`,
    [valor_pago ?? null, conta_id, loja_id],
  );
}

// ============ CONTAS A RECEBER ============
export type ContaReceber = {
  id: number;
  cliente_nome: string | null;
  descricao: string;
  origem: string | null;
  valor: number;
  vencimento: string;
  status: string;
  recebido_em: string | null;
  valor_recebido: number | null;
  dias_vencido: number | null;
};

export async function listarContasReceber(
  loja_id: number,
  status?: string,
): Promise<ContaReceber[]> {
  const conds: string[] = [`c.loja_id = $1`];
  const params: unknown[] = [loja_id];
  if (status) {
    params.push(status);
    conds.push(`c.status = $${params.length}`);
  }
  const r = await pool.query(
    `SELECT c.id, cl.nome_razao AS cliente_nome,
            c.descricao, c.origem, c.valor::float,
            c.vencimento::text, c.status,
            c.recebido_em::text, c.valor_recebido::float,
            CASE WHEN c.status IN ('aberta','parcial') AND c.vencimento < CURRENT_DATE
                 THEN (CURRENT_DATE - c.vencimento)
                 ELSE NULL END AS dias_vencido
       FROM sevenconstruction.conta_receber c
       LEFT JOIN sevenconstruction.loja_clientes cl ON cl.id = c.cliente_id
      WHERE ${conds.join(" AND ")}
      ORDER BY c.vencimento ASC, c.id DESC
      LIMIT 500`,
    params,
  );
  return r.rows;
}

export async function criarContaReceber(input: {
  loja_id: number; criado_por: number;
  cliente_id?: number;
  descricao: string;
  origem?: string;
  valor: number;
  vencimento: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO sevenconstruction.conta_receber
       (loja_id, criado_por, cliente_id, descricao, origem, valor, vencimento)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      input.loja_id, input.criado_por, input.cliente_id ?? null,
      input.descricao, input.origem ?? null,
      input.valor, input.vencimento,
    ],
  );
  return r.rows[0].id;
}

export async function receberConta(loja_id: number, conta_id: number, valor_recebido?: number): Promise<void> {
  await pool.query(
    `UPDATE sevenconstruction.conta_receber
        SET status = 'recebida', recebido_em = NOW(), valor_recebido = COALESCE($1, valor)
      WHERE id = $2 AND loja_id = $3`,
    [valor_recebido ?? null, conta_id, loja_id],
  );
}

// ============ NOTA ENTRADA ============
export type NotaEntrada = {
  id: number;
  fornecedor_nome: string | null;
  numero: string;
  serie: string | null;
  data_emissao: string | null;
  data_entrada: string;
  valor_total: number;
  status: string;
  qtd_itens: number;
};

export async function listarNotasEntrada(loja_id: number): Promise<NotaEntrada[]> {
  const r = await pool.query(
    `SELECT n.id,
            COALESCE(f.razao_social, n.fornecedor_nome) AS fornecedor_nome,
            n.numero, n.serie, n.data_emissao::text, n.data_entrada::text,
            n.valor_total::float, n.status,
            (SELECT COUNT(*)::int FROM sevenconstruction.nota_entrada_item i WHERE i.nota_id = n.id) AS qtd_itens
       FROM sevenconstruction.nota_entrada n
       LEFT JOIN sevenconstruction.fornecedores f ON f.id = n.fornecedor_id
      WHERE n.loja_id = $1
      ORDER BY n.data_entrada DESC, n.id DESC
      LIMIT 200`,
    [loja_id],
  );
  return r.rows;
}

export async function criarNotaEntrada(input: {
  loja_id: number; criado_por: number;
  fornecedor_id?: number; fornecedor_nome?: string; fornecedor_cnpj?: string;
  numero: string; serie?: string;
  data_emissao?: string; data_entrada?: string;
  valor_produtos: number; valor_frete?: number; valor_desconto?: number;
}): Promise<number> {
  const valor_total =
    Number(input.valor_produtos) +
    Number(input.valor_frete ?? 0) -
    Number(input.valor_desconto ?? 0);

  const r = await pool.query(
    `INSERT INTO sevenconstruction.nota_entrada
       (loja_id, criado_por, fornecedor_id, fornecedor_nome, fornecedor_cnpj,
        numero, serie, data_emissao, data_entrada,
        valor_produtos, valor_frete, valor_desconto, valor_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,COALESCE($9::date, CURRENT_DATE),
             $10,$11,$12,$13)
     RETURNING id`,
    [
      input.loja_id, input.criado_por,
      input.fornecedor_id ?? null, input.fornecedor_nome ?? null, input.fornecedor_cnpj ?? null,
      input.numero, input.serie ?? null,
      input.data_emissao ?? null, input.data_entrada ?? null,
      input.valor_produtos, input.valor_frete ?? 0, input.valor_desconto ?? 0, valor_total,
    ],
  );
  return r.rows[0].id;
}
