// Marketplace cross-fulfillment SC: lojas parceiras compram/vendem entre si
// quando uma nao tem o produto que o cliente final quer.
//
// Fluxo:
//   1. Loja_A publica OFERTA (o que vende atacado: produto, preco, raio)
//   2. Loja_B cria DEMANDA (o que precisa) ou usa o match-engine
//      pra descobrir Loja_A
//   3. Loja_B inicia TRANSACAO selecionando uma oferta
//   4. Loja_A recebe e aceita/recusa
//   5. Aceita → em_transito → entregue (com tracking de status)
//   6. Comissao SC = 1.5% sobre valor_total (registrado no metadados)
//
// Match engine: dada uma demanda, retorna ofertas de OUTRAS lojas que:
//   - mesma categoria OU produto contem palavra
//   - preco_atacado <= preco_max (se demanda especifica)
//   - prazo_entrega <= prazo_max (se demanda especifica)
//   - distancia loja_origem ↔ loja_oferta <= raio_entrega da oferta
//     (usa lat/lng se ambas geocodificadas; senao mesma UF)

import pool from "@/lib/db";
import { distanciaKm } from "@/lib/geocoding";

export const COMISSAO_PLATAFORMA_PCT = 1.5;

// ===== Ofertas =====

export interface Oferta {
  id: number;
  loja_id: number;
  produto: string;
  categoria: string | null;
  unidade: string;
  preco_atacado: number | null;
  estoque_min: number | null;
  prazo_entrega_dias: number;
  raio_entrega_km: number;
  ativo: boolean;
  observacoes: string | null;
  criado_em: string;
}

export async function listarOfertasLoja(loja_id: number): Promise<Oferta[]> {
  const r = await pool.query<Oferta>(
    `SELECT id, loja_id, produto, categoria, unidade,
            preco_atacado::float AS preco_atacado,
            estoque_min, prazo_entrega_dias, raio_entrega_km,
            ativo, observacoes, criado_em::text AS criado_em
       FROM sevenconstruction.b2b_oferta
      WHERE loja_id = $1
      ORDER BY ativo DESC, criado_em DESC`,
    [loja_id],
  );
  return r.rows;
}

export async function criarOferta(opts: {
  loja_id: number;
  produto: string;
  categoria?: string;
  unidade?: string;
  preco_atacado?: number;
  estoque_min?: number;
  prazo_entrega_dias?: number;
  raio_entrega_km?: number;
  observacoes?: string;
}): Promise<Oferta> {
  const r = await pool.query<Oferta>(
    `INSERT INTO sevenconstruction.b2b_oferta
       (loja_id, produto, categoria, unidade, preco_atacado, estoque_min,
        prazo_entrega_dias, raio_entrega_km, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, loja_id, produto, categoria, unidade,
              preco_atacado::float AS preco_atacado,
              estoque_min, prazo_entrega_dias, raio_entrega_km,
              ativo, observacoes, criado_em::text AS criado_em`,
    [
      opts.loja_id,
      opts.produto.trim(),
      opts.categoria ?? null,
      opts.unidade ?? "un",
      opts.preco_atacado ?? null,
      opts.estoque_min ?? null,
      opts.prazo_entrega_dias ?? 1,
      opts.raio_entrega_km ?? 30,
      opts.observacoes ?? null,
    ],
  );
  return r.rows[0];
}

export async function alternarAtivoOferta(id: number, loja_id: number): Promise<boolean> {
  const r = await pool.query(
    `UPDATE sevenconstruction.b2b_oferta
        SET ativo = NOT ativo, atualizado_em = NOW()
      WHERE id = $1 AND loja_id = $2`,
    [id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function removerOferta(id: number, loja_id: number): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM sevenconstruction.b2b_oferta WHERE id = $1 AND loja_id = $2`,
    [id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}

// ===== Demandas =====

export interface Demanda {
  id: number;
  loja_id: number;
  cliente_id: number | null;
  produto: string;
  categoria: string | null;
  quantidade: number | null;
  unidade: string | null;
  prazo_max_dias: number | null;
  preco_max_un: number | null;
  status: string;
  observacoes: string | null;
  criado_em: string;
}

export async function listarDemandasLoja(loja_id: number, status?: string): Promise<Demanda[]> {
  const conds = ["loja_id = $1"];
  const args: unknown[] = [loja_id];
  if (status) { args.push(status); conds.push(`status = $${args.length}`); }
  const r = await pool.query<Demanda>(
    `SELECT id, loja_id, cliente_id, produto, categoria,
            quantidade::float AS quantidade, unidade,
            prazo_max_dias, preco_max_un::float AS preco_max_un,
            status, observacoes, criado_em::text AS criado_em
       FROM sevenconstruction.b2b_demanda
      WHERE ${conds.join(" AND ")}
      ORDER BY (status = 'aberta') DESC, criado_em DESC`,
    args,
  );
  return r.rows;
}

export async function criarDemanda(opts: {
  loja_id: number;
  cliente_id?: number;
  produto: string;
  categoria?: string;
  quantidade?: number;
  unidade?: string;
  prazo_max_dias?: number;
  preco_max_un?: number;
  observacoes?: string;
}): Promise<Demanda> {
  const r = await pool.query<Demanda>(
    `INSERT INTO sevenconstruction.b2b_demanda
       (loja_id, cliente_id, produto, categoria, quantidade, unidade,
        prazo_max_dias, preco_max_un, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, loja_id, cliente_id, produto, categoria,
              quantidade::float AS quantidade, unidade,
              prazo_max_dias, preco_max_un::float AS preco_max_un,
              status, observacoes, criado_em::text AS criado_em`,
    [
      opts.loja_id,
      opts.cliente_id ?? null,
      opts.produto.trim(),
      opts.categoria ?? null,
      opts.quantidade ?? null,
      opts.unidade ?? null,
      opts.prazo_max_dias ?? null,
      opts.preco_max_un ?? null,
      opts.observacoes ?? null,
    ],
  );
  return r.rows[0];
}

// ===== Match engine =====

export interface OfertaMatch extends Oferta {
  loja_nome: string;
  loja_uf: string | null;
  loja_cidade: string | null;
  distancia_km: number | null;
  score: number;
  motivo: string;
}

export async function buscarMatches(opts: {
  loja_origem: number;
  produto?: string;
  categoria?: string;
  preco_max?: number;
  prazo_max_dias?: number;
  limite?: number;
}): Promise<OfertaMatch[]> {
  const limite = Math.min(Math.max(opts.limite ?? 50, 1), 200);

  // Geo da loja origem (pra calcular distancias)
  const origem = await pool.query<{ lat: number | null; lng: number | null; uf: string | null }>(
    `SELECT lat::float AS lat, lng::float AS lng, uf FROM sevenconstruction.lojas WHERE id = $1`,
    [opts.loja_origem],
  );
  const origemRow = origem.rows[0];

  const conds: string[] = ["o.ativo = TRUE", "o.loja_id <> $1"];
  const args: unknown[] = [opts.loja_origem];
  let i = 2;

  if (opts.categoria) {
    args.push(opts.categoria);
    conds.push(`o.categoria = $${i++}`);
  }
  if (opts.produto) {
    const termo = opts.produto.trim().toLowerCase();
    if (termo) {
      args.push(`%${termo}%`);
      conds.push(`LOWER(o.produto) LIKE $${i++}`);
    }
  }
  if (opts.preco_max != null) {
    args.push(opts.preco_max);
    conds.push(`(o.preco_atacado IS NULL OR o.preco_atacado <= $${i++})`);
  }
  if (opts.prazo_max_dias != null) {
    args.push(opts.prazo_max_dias);
    conds.push(`o.prazo_entrega_dias <= $${i++}`);
  }
  args.push(limite * 2);

  const r = await pool.query<{
    id: number; loja_id: number; produto: string; categoria: string | null; unidade: string;
    preco_atacado: number | null; estoque_min: number | null; prazo_entrega_dias: number;
    raio_entrega_km: number; ativo: boolean; observacoes: string | null; criado_em: string;
    loja_nome: string; loja_uf: string | null; loja_cidade: string | null;
    loja_lat: number | null; loja_lng: number | null;
  }>(
    `SELECT o.id, o.loja_id, o.produto, o.categoria, o.unidade,
            o.preco_atacado::float AS preco_atacado, o.estoque_min,
            o.prazo_entrega_dias, o.raio_entrega_km, o.ativo, o.observacoes,
            o.criado_em::text AS criado_em,
            l.nome_fantasia AS loja_nome, l.uf AS loja_uf, l.cidade AS loja_cidade,
            l.lat::float AS loja_lat, l.lng::float AS loja_lng
       FROM sevenconstruction.b2b_oferta o
       JOIN sevenconstruction.lojas l ON l.id = o.loja_id
      WHERE ${conds.join(" AND ")}
      ORDER BY o.preco_atacado ASC NULLS LAST, o.prazo_entrega_dias ASC
      LIMIT $${i}`,
    args,
  );

  const ofertas: OfertaMatch[] = r.rows.map((row) => {
    let distancia_km: number | null = null;
    let dentroRaio = true;
    if (origemRow?.lat != null && origemRow?.lng != null && row.loja_lat != null && row.loja_lng != null) {
      distancia_km = Math.round(
        distanciaKm(
          { lat: Number(origemRow.lat), lng: Number(origemRow.lng) },
          { lat: Number(row.loja_lat), lng: Number(row.loja_lng) },
        ) * 10,
      ) / 10;
      dentroRaio = distancia_km <= row.raio_entrega_km;
    }

    let score = 50; // base
    const motivos: string[] = [];

    if (opts.categoria && row.categoria === opts.categoria) {
      score += 20; motivos.push(`Categoria ${opts.categoria}`);
    }
    if (opts.preco_max != null && row.preco_atacado != null && row.preco_atacado <= opts.preco_max * 0.9) {
      score += 15; motivos.push("Preço ≤90% do máximo");
    }
    if (distancia_km != null) {
      if (distancia_km <= 30) { score += 20; motivos.push(`${distancia_km}km`); }
      else if (distancia_km <= 100) { score += 10; motivos.push(`${distancia_km}km`); }
      else { score -= 10; motivos.push(`${distancia_km}km (longe)`); }
    } else if (origemRow?.uf && row.loja_uf === origemRow.uf) {
      score += 10; motivos.push(`Mesma UF (${row.loja_uf})`);
    }
    if (row.prazo_entrega_dias <= 1) { score += 5; motivos.push("Entrega em 1 dia"); }
    if (!dentroRaio) { score -= 30; motivos.push("Fora do raio da oferta"); }

    return {
      id: row.id,
      loja_id: row.loja_id,
      produto: row.produto,
      categoria: row.categoria,
      unidade: row.unidade,
      preco_atacado: row.preco_atacado,
      estoque_min: row.estoque_min,
      prazo_entrega_dias: row.prazo_entrega_dias,
      raio_entrega_km: row.raio_entrega_km,
      ativo: row.ativo,
      observacoes: row.observacoes,
      criado_em: row.criado_em,
      loja_nome: row.loja_nome,
      loja_uf: row.loja_uf,
      loja_cidade: row.loja_cidade,
      distancia_km,
      score,
      motivo: motivos.join(" · ") || "Match básico",
    };
  });

  ofertas.sort((a, b) => b.score - a.score);
  return ofertas.slice(0, limite);
}

// ===== Transacoes =====

export interface Transacao {
  id: number;
  loja_compradora: number;
  loja_fornecedora: number;
  oferta_id: number | null;
  demanda_id: number | null;
  produto_snapshot: string | null;
  quantidade: number;
  preco_unit: number;
  valor_total: number;
  margem_pct: number | null;
  comissao_plataforma: number; // calculada
  status: string;
  observacoes: string | null;
  criado_em: string;
  loja_compradora_nome: string;
  loja_fornecedora_nome: string;
}

export async function criarTransacao(opts: {
  loja_compradora: number;
  oferta_id: number;
  quantidade: number;
  preco_unit?: number;            // default = preco_atacado da oferta
  margem_pct?: number;
  observacoes?: string;
  demanda_id?: number;
}): Promise<Transacao> {
  if (opts.quantidade <= 0) throw new Error("quantidade > 0");

  const ofq = await pool.query<{
    id: number; loja_id: number; produto: string; preco_atacado: number | null;
  }>(
    `SELECT id, loja_id, produto, preco_atacado::float AS preco_atacado
       FROM sevenconstruction.b2b_oferta WHERE id = $1 AND ativo`,
    [opts.oferta_id],
  );
  const oferta = ofq.rows[0];
  if (!oferta) throw new Error("Oferta não encontrada ou inativa");
  if (oferta.loja_id === opts.loja_compradora) throw new Error("Não pode comprar da própria loja");

  const preco = opts.preco_unit ?? oferta.preco_atacado ?? 0;
  if (preco <= 0) throw new Error("Preço unitário precisa ser > 0");

  const valor = preco * opts.quantidade;
  const comissao = valor * (COMISSAO_PLATAFORMA_PCT / 100);

  const r = await pool.query<{ id: number; criado_em: string }>(
    `INSERT INTO sevenconstruction.b2b_transacao
       (loja_compradora, loja_fornecedora, oferta_id, demanda_id, produto_snapshot,
        quantidade, preco_unit, valor_total, margem_pct, status, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente', $10)
     RETURNING id, criado_em::text AS criado_em`,
    [
      opts.loja_compradora,
      oferta.loja_id,
      oferta.id,
      opts.demanda_id ?? null,
      oferta.produto,
      opts.quantidade,
      preco,
      valor,
      opts.margem_pct ?? null,
      opts.observacoes ?? null,
    ],
  );

  // Marca demanda como matched
  if (opts.demanda_id) {
    await pool.query(
      `UPDATE sevenconstruction.b2b_demanda SET status = 'matched', atualizado_em = NOW() WHERE id = $1`,
      [opts.demanda_id],
    ).catch(() => {});
  }

  return {
    id: r.rows[0].id,
    loja_compradora: opts.loja_compradora,
    loja_fornecedora: oferta.loja_id,
    oferta_id: oferta.id,
    demanda_id: opts.demanda_id ?? null,
    produto_snapshot: oferta.produto,
    quantidade: opts.quantidade,
    preco_unit: preco,
    valor_total: valor,
    margem_pct: opts.margem_pct ?? null,
    comissao_plataforma: comissao,
    status: "pendente",
    observacoes: opts.observacoes ?? null,
    criado_em: r.rows[0].criado_em,
    loja_compradora_nome: "",
    loja_fornecedora_nome: "",
  };
}

const STATUS_VALIDOS = ["pendente", "aceita", "em_transito", "entregue", "cancelada"];

export async function mudarStatusTransacao(id: number, novo: string, loja_id_ator: number): Promise<boolean> {
  if (!STATUS_VALIDOS.includes(novo)) throw new Error("status invalido");
  // Permite mudanca apenas se o ator eh compradora ou fornecedora
  const r = await pool.query(
    `UPDATE sevenconstruction.b2b_transacao
        SET status = $1
      WHERE id = $2 AND (loja_compradora = $3 OR loja_fornecedora = $3)`,
    [novo, id, loja_id_ator],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listarTransacoesLoja(loja_id: number, papel?: "compradora" | "fornecedora", limite = 100): Promise<Transacao[]> {
  let cond = "(t.loja_compradora = $1 OR t.loja_fornecedora = $1)";
  if (papel === "compradora") cond = "t.loja_compradora = $1";
  else if (papel === "fornecedora") cond = "t.loja_fornecedora = $1";

  const r = await pool.query<Transacao>(
    `SELECT t.id, t.loja_compradora, t.loja_fornecedora, t.oferta_id, t.demanda_id,
            t.produto_snapshot,
            t.quantidade::float AS quantidade,
            t.preco_unit::float AS preco_unit,
            t.valor_total::float AS valor_total,
            t.margem_pct::float AS margem_pct,
            (t.valor_total * ${COMISSAO_PLATAFORMA_PCT / 100})::float AS comissao_plataforma,
            t.status, t.observacoes, t.criado_em::text AS criado_em,
            lc.nome_fantasia AS loja_compradora_nome,
            lf.nome_fantasia AS loja_fornecedora_nome
       FROM sevenconstruction.b2b_transacao t
       JOIN sevenconstruction.lojas lc ON lc.id = t.loja_compradora
       JOIN sevenconstruction.lojas lf ON lf.id = t.loja_fornecedora
      WHERE ${cond}
      ORDER BY t.criado_em DESC
      LIMIT $2`,
    [loja_id, Math.min(Math.max(limite, 1), 500)],
  );
  return r.rows;
}

// ===== KPIs =====

export interface KpisMarketplace {
  total_lojas: number;
  ofertas_ativas_loja: number;
  demandas_abertas_loja: number;
  ofertas_rede_total: number;
  transacoes_30d_loja: number;
  volume_30d_compras: number;
  volume_30d_vendas: number;
  comissao_plataforma_30d: number;
}

export async function lerKpisMarketplace(loja_id: number): Promise<KpisMarketplace> {
  const r = await pool.query<KpisMarketplace>(
    `SELECT
       (SELECT COUNT(*)::int FROM sevenconstruction.lojas WHERE ativo) AS total_lojas,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_oferta WHERE ativo AND loja_id = $1) AS ofertas_ativas_loja,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_demanda WHERE status = 'aberta' AND loja_id = $1) AS demandas_abertas_loja,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_oferta WHERE ativo AND loja_id <> $1) AS ofertas_rede_total,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_transacao
         WHERE (loja_compradora = $1 OR loja_fornecedora = $1)
           AND criado_em >= NOW() - INTERVAL '30 days') AS transacoes_30d_loja,
       COALESCE((SELECT SUM(valor_total) FROM sevenconstruction.b2b_transacao
         WHERE loja_compradora = $1 AND criado_em >= NOW() - INTERVAL '30 days'), 0)::float AS volume_30d_compras,
       COALESCE((SELECT SUM(valor_total) FROM sevenconstruction.b2b_transacao
         WHERE loja_fornecedora = $1 AND criado_em >= NOW() - INTERVAL '30 days'), 0)::float AS volume_30d_vendas,
       COALESCE((SELECT SUM(valor_total * ${COMISSAO_PLATAFORMA_PCT / 100}) FROM sevenconstruction.b2b_transacao
         WHERE (loja_compradora = $1 OR loja_fornecedora = $1)
           AND criado_em >= NOW() - INTERVAL '30 days'), 0)::float AS comissao_plataforma_30d`,
    [loja_id],
  );
  return r.rows[0];
}

export const CATEGORIAS_PADRAO = [
  "cimento", "areia", "brita", "blocos", "ferragens", "madeira",
  "tintas", "ceramica", "louça", "metais", "eletrica", "hidraulica", "outros",
];
