// Fidelizacao do cliente final — clube de pontos + indicacoes.
// Ledger imutavel em cliente_pontos_movimento; saldo em cliente_pontos
// atualizado via trigger SQL (idempotente).
//
// Regras:
//   compra:    valor R$ * fator (default 1 ponto/R$ 1 = 1%)
//   resgate:   1 ponto = R$ 0,01 (centavo) — define cliente.saldo - pontos
//   indicacao: 50 pontos pra origem + 50 pra destino quando 1a compra >= R$ 50

import pool from "@/lib/db";

export const FATOR_COMPRA = 1;             // 1 ponto por R$ 1
export const PONTO_VALOR_REAIS = 0.01;     // 1 ponto = R$ 0,01
export const BONUS_INDICACAO = 50;         // 50 pts cada
export const MIN_COMPRA_INDICACAO = 50;    // R$ 50 minimo p/ liberar indicacao

export interface SaldoCliente {
  cliente_id: number;
  saldo: number;
  total_ganho: number;
  total_resgatado: number;
  total_expirado: number;
  ultima_compra_em: string | null;
}

export interface MovimentoLedger {
  id: number;
  cliente_id: number;
  loja_id: number;
  tipo: string;
  pontos: number;
  valor_referencia: number | null;
  descricao: string | null;
  origem: string | null;
  criado_em: string;
}

export async function lerSaldo(cliente_id: number): Promise<SaldoCliente> {
  const r = await pool.query<SaldoCliente>(
    `SELECT cliente_id, saldo, total_ganho, total_resgatado, total_expirado,
            ultima_compra_em::text AS ultima_compra_em
       FROM sevenconstruction.cliente_pontos
      WHERE cliente_id = $1`,
    [cliente_id],
  );
  return r.rows[0] ?? {
    cliente_id, saldo: 0, total_ganho: 0, total_resgatado: 0, total_expirado: 0, ultima_compra_em: null,
  };
}

export async function listarMovimento(cliente_id: number, limite = 50): Promise<MovimentoLedger[]> {
  const r = await pool.query<MovimentoLedger>(
    `SELECT id, cliente_id, loja_id, tipo,
            pontos,
            valor_referencia::float AS valor_referencia,
            descricao, origem, criado_em::text AS criado_em
       FROM sevenconstruction.cliente_pontos_movimento
      WHERE cliente_id = $1
      ORDER BY criado_em DESC
      LIMIT $2`,
    [cliente_id, Math.min(Math.max(limite, 1), 500)],
  );
  return r.rows;
}

export async function registrarCompra(opts: {
  cliente_id: number;
  loja_id: number;
  valor_brl: number;
  descricao?: string;
}): Promise<MovimentoLedger> {
  if (opts.valor_brl <= 0) throw new Error("valor_brl deve ser > 0");
  const pontos = Math.floor(opts.valor_brl * FATOR_COMPRA);
  if (pontos === 0) throw new Error("valor muito baixo: 0 pontos gerados");

  const r = await pool.query<MovimentoLedger>(
    `INSERT INTO sevenconstruction.cliente_pontos_movimento
       (cliente_id, loja_id, tipo, pontos, valor_referencia, descricao, origem)
     VALUES ($1, $2, 'compra', $3, $4, $5, 'compra_manual')
     RETURNING id, cliente_id, loja_id, tipo, pontos,
               valor_referencia::float AS valor_referencia,
               descricao, origem, criado_em::text AS criado_em`,
    [opts.cliente_id, opts.loja_id, pontos, opts.valor_brl, opts.descricao ?? null],
  );

  // Verifica indicacoes pendentes deste cliente (como destino) e libera bonus
  if (opts.valor_brl >= MIN_COMPRA_INDICACAO) {
    await liberarIndicacoesPendentes(opts.cliente_id, opts.loja_id);
  }
  return r.rows[0];
}

export async function resgatar(opts: {
  cliente_id: number;
  loja_id: number;
  pontos: number;
  descricao?: string;
}): Promise<MovimentoLedger> {
  if (opts.pontos <= 0) throw new Error("pontos > 0");
  const saldo = await lerSaldo(opts.cliente_id);
  if (saldo.saldo < opts.pontos) {
    throw new Error(`Saldo insuficiente: ${saldo.saldo} < ${opts.pontos}`);
  }
  const r = await pool.query<MovimentoLedger>(
    `INSERT INTO sevenconstruction.cliente_pontos_movimento
       (cliente_id, loja_id, tipo, pontos, descricao, origem)
     VALUES ($1, $2, 'resgate', $3, $4, 'resgate_manual')
     RETURNING id, cliente_id, loja_id, tipo, pontos, valor_referencia::float, descricao, origem, criado_em::text`,
    [opts.cliente_id, opts.loja_id, -Math.abs(opts.pontos), opts.descricao ?? "Resgate de cashback"],
  );
  return r.rows[0];
}

export async function ajusteManual(opts: {
  cliente_id: number;
  loja_id: number;
  pontos: number;     // pode ser negativo
  descricao: string;
}): Promise<MovimentoLedger> {
  if (opts.pontos === 0) throw new Error("pontos != 0");
  if (opts.pontos < 0) {
    const saldo = await lerSaldo(opts.cliente_id);
    if (saldo.saldo + opts.pontos < 0) throw new Error("Saldo nao pode ficar negativo");
  }
  const r = await pool.query<MovimentoLedger>(
    `INSERT INTO sevenconstruction.cliente_pontos_movimento
       (cliente_id, loja_id, tipo, pontos, descricao, origem)
     VALUES ($1, $2, 'ajuste', $3, $4, 'admin')
     RETURNING id, cliente_id, loja_id, tipo, pontos, valor_referencia::float, descricao, origem, criado_em::text`,
    [opts.cliente_id, opts.loja_id, opts.pontos, opts.descricao],
  );
  return r.rows[0];
}

// ===== Indicacoes =====

export interface Indicacao {
  id: number;
  loja_id: number;
  cliente_origem: number;
  cliente_destino: number | null;
  nome_indicado: string;
  contato_indicado: string;
  status: string;
  recompensa_pontos: number;
  criado_em: string;
  cadastrado_em: string | null;
  comprou_em: string | null;
  pago_em: string | null;
}

export async function criarIndicacao(opts: {
  loja_id: number;
  cliente_origem: number;
  nome_indicado: string;
  contato_indicado: string;
  recompensa_pontos?: number;
}): Promise<Indicacao> {
  const r = await pool.query<Indicacao>(
    `INSERT INTO sevenconstruction.cliente_indicacoes
       (loja_id, cliente_origem, nome_indicado, contato_indicado, recompensa_pontos)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, loja_id, cliente_origem, cliente_destino, nome_indicado, contato_indicado,
              status, recompensa_pontos,
              criado_em::text AS criado_em, cadastrado_em::text, comprou_em::text, pago_em::text`,
    [
      opts.loja_id,
      opts.cliente_origem,
      opts.nome_indicado.trim(),
      opts.contato_indicado.trim(),
      opts.recompensa_pontos ?? BONUS_INDICACAO,
    ],
  );
  return r.rows[0];
}

export async function listarIndicacoes(cliente_origem: number): Promise<Indicacao[]> {
  const r = await pool.query<Indicacao>(
    `SELECT id, loja_id, cliente_origem, cliente_destino, nome_indicado, contato_indicado,
            status, recompensa_pontos,
            criado_em::text AS criado_em,
            cadastrado_em::text AS cadastrado_em,
            comprou_em::text AS comprou_em,
            pago_em::text AS pago_em
       FROM sevenconstruction.cliente_indicacoes
      WHERE cliente_origem = $1
      ORDER BY criado_em DESC`,
    [cliente_origem],
  );
  return r.rows;
}

// Quando o indicado faz 1a compra >= MIN, paga bonus pra origem + destino
async function liberarIndicacoesPendentes(cliente_destino: number, loja_id: number): Promise<void> {
  // Acha indicacoes pendentes onde este cliente foi vinculado (cadastrado)
  const pendentes = await pool.query<Indicacao>(
    `SELECT id, cliente_origem, cliente_destino, recompensa_pontos
       FROM sevenconstruction.cliente_indicacoes
      WHERE cliente_destino = $1 AND status IN ('pendente','cadastrado','comprou')`,
    [cliente_destino],
  );
  for (const ind of pendentes.rows) {
    await pool.query(
      `INSERT INTO sevenconstruction.cliente_pontos_movimento
         (cliente_id, loja_id, tipo, pontos, descricao, origem)
       VALUES ($1, $2, 'indicacao_origem', $3, $4, $5)`,
      [ind.cliente_origem, loja_id, ind.recompensa_pontos, `Bônus indicação #${ind.id}`, `indicacao_${ind.id}`],
    );
    await pool.query(
      `INSERT INTO sevenconstruction.cliente_pontos_movimento
         (cliente_id, loja_id, tipo, pontos, descricao, origem)
       VALUES ($1, $2, 'indicacao_destino', $3, $4, $5)`,
      [cliente_destino, loja_id, ind.recompensa_pontos, `Bônus boas-vindas #${ind.id}`, `indicacao_${ind.id}`],
    );
    await pool.query(
      `UPDATE sevenconstruction.cliente_indicacoes
          SET status = 'pago', comprou_em = COALESCE(comprou_em, NOW()), pago_em = NOW()
        WHERE id = $1`,
      [ind.id],
    );
  }
}

// Vincula um cliente novo a uma indicacao pendente pelo contato (email ou tel)
export async function vincularIndicacao(cliente_id: number, contato: string): Promise<number> {
  const r = await pool.query(
    `UPDATE sevenconstruction.cliente_indicacoes
        SET cliente_destino = $1, status = 'cadastrado', cadastrado_em = NOW()
      WHERE contato_indicado = $2 AND status = 'pendente'`,
    [cliente_id, contato],
  );
  return r.rowCount ?? 0;
}

// ===== KPIs e ranking =====

export interface KpisFidelizacao {
  clientes_no_clube: number;
  pontos_em_circulacao: number;
  pontos_distribuidos: number;
  pontos_resgatados: number;
  indicacoes_efetivas: number;
  indicacoes_pendentes: number;
  passivo_brl: number; // valor em R$ que pode ser resgatado
}

export async function lerKpis(loja_id: number): Promise<KpisFidelizacao> {
  const r = await pool.query<{
    clientes_no_clube: number; pontos_em_circulacao: number; pontos_distribuidos: number;
    pontos_resgatados: number; indicacoes_efetivas: number; indicacoes_pendentes: number;
  }>(`SELECT * FROM sevenconstruction.v_fidelizacao_kpis WHERE loja_id = $1`, [loja_id]);
  const row = r.rows[0] ?? {
    clientes_no_clube: 0, pontos_em_circulacao: 0, pontos_distribuidos: 0,
    pontos_resgatados: 0, indicacoes_efetivas: 0, indicacoes_pendentes: 0,
  };
  return { ...row, passivo_brl: row.pontos_em_circulacao * PONTO_VALOR_REAIS };
}

export interface RankingCliente {
  cliente_id: number;
  nome_razao: string;
  cnpj: string | null;
  cpf: string | null;
  saldo: number;
  total_ganho: number;
  ultima_compra_em: string | null;
}

export async function topClientes(loja_id: number, limite = 10): Promise<RankingCliente[]> {
  const r = await pool.query<RankingCliente>(
    `SELECT c.id AS cliente_id, c.nome_razao, c.cnpj, c.cpf,
            COALESCE(p.saldo, 0) AS saldo,
            COALESCE(p.total_ganho, 0) AS total_ganho,
            p.ultima_compra_em::text AS ultima_compra_em
       FROM sevenconstruction.loja_clientes c
       LEFT JOIN sevenconstruction.cliente_pontos p ON p.cliente_id = c.id
      WHERE c.loja_id = $1
      ORDER BY COALESCE(p.saldo, 0) DESC, COALESCE(p.total_ganho, 0) DESC
      LIMIT $2`,
    [loja_id, limite],
  );
  return r.rows;
}
