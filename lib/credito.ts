// FIDC / Credito no checkout — motor de simulacao + comparacao + dashboard.
// Cada parceiro_financeiro tem faixa propria de taxa (min-max), prazo
// (min-max), ticket (min-max). Rating do CNPJ (verde/amarelo/vermelho)
// definido por dados RFB+CADIN+PGFN. Taxa final interpola a faixa do
// parceiro com base no rating + ajustes (capital, idade).

import pool from "@/lib/db";
import { buscarDadosEmpresa, lerCompliance } from "@/lib/consulta-cnpj";

export interface ParceiroFinanceiro {
  id: number;
  nome: string;
  tipo: string;
  cnpj: string | null;
  taxa_minima_aa: number;
  taxa_maxima_aa: number;
  prazo_min_dias: number;
  prazo_max_dias: number;
  ticket_min: number;
  ticket_max: number;
  comissao_loja_pct: number;
  status: string;
  adapter_codigo: string | null;
  observacoes: string | null;
}

export type Rating = "verde" | "amarelo" | "vermelho";

export interface AvaliacaoCnpj {
  rating: Rating;
  motivos: string[];
  fator_taxa: number;     // 0-1: 0 = melhor (taxa mínima); 1 = pior (taxa máxima)
}

export interface OfertaCredito {
  parceiro: ParceiroFinanceiro;
  apto: boolean;
  motivo_inapto?: string;
  taxa_aa: number;
  taxa_mensal: number;
  parcela_estimada: number;
  total_a_pagar: number;
  custo_total_juros: number;
  comissao_loja_estimada: number;
}

export async function listarParceirosLoja(loja_id: number): Promise<ParceiroFinanceiro[]> {
  const r = await pool.query<ParceiroFinanceiro>(
    `SELECT pf.id, pf.nome, pf.tipo, pf.cnpj,
            pf.taxa_minima_aa::float AS taxa_minima_aa,
            pf.taxa_maxima_aa::float AS taxa_maxima_aa,
            pf.prazo_min_dias, pf.prazo_max_dias,
            pf.ticket_min::float AS ticket_min,
            pf.ticket_max::float AS ticket_max,
            pf.comissao_loja_pct::float AS comissao_loja_pct,
            pf.status, pf.adapter_codigo, pf.observacoes
       FROM sevenconstruction.parceiros_financeiros pf
       JOIN sevenconstruction.loja_parceiros lp ON lp.parceiro_id = pf.id
      WHERE lp.loja_id = $1 AND lp.ativo AND pf.status = 'ativo'
      ORDER BY lp.prioridade ASC, pf.taxa_minima_aa ASC`,
    [loja_id],
  );
  return r.rows;
}

export async function avaliarCnpj(cnpj: string): Promise<AvaliacaoCnpj> {
  const limpo = cnpj.replace(/\D+/g, "");
  if (limpo.length !== 14) {
    return { rating: "vermelho", motivos: ["CNPJ inválido"], fator_taxa: 1 };
  }

  const [empresa, compliance] = await Promise.all([
    buscarDadosEmpresa(limpo).catch(() => null),
    lerCompliance(limpo).catch(() => null),
  ]);

  const motivos: string[] = [];
  let rating: Rating = "verde";
  let pontos = 0; // quanto MENOR, melhor (0 = ótimo, 100 = péssimo)

  if (!empresa) {
    return { rating: "vermelho", motivos: ["CNPJ não encontrado no RFB"], fator_taxa: 1 };
  }

  if (empresa.situacao !== 2) {
    motivos.push(`Situação: ${empresa.situacao_label}`);
    rating = "vermelho";
    pontos += 60;
  }

  if (empresa.data_abertura) {
    const anos = (Date.now() - new Date(empresa.data_abertura).getTime()) / (365.25 * 86400_000);
    if (anos < 1) { motivos.push("Empresa < 1 ano de mercado"); pontos += 25; rating = pior(rating, "amarelo"); }
    else if (anos < 3) { motivos.push(`${anos.toFixed(1)} anos de mercado`); pontos += 10; }
    else if (anos >= 5) { motivos.push(`${Math.floor(anos)} anos de mercado (estabelecida)`); pontos -= 10; }
  } else {
    motivos.push("Sem data de abertura informada");
    pontos += 15;
  }

  if (empresa.capital_social == null) {
    motivos.push("Capital social desconhecido");
    pontos += 10;
  } else if (empresa.capital_social > 500_000) {
    motivos.push(`Capital social ${moeda(empresa.capital_social)}`);
    pontos -= 8;
  } else if (empresa.capital_social > 100_000) {
    pontos -= 3;
  } else if (empresa.capital_social < 10_000) {
    motivos.push("Capital social baixo (<R$10k)");
    pontos += 12;
    rating = pior(rating, "amarelo");
  }

  if (compliance?.cadin.presente) {
    motivos.push(`CADIN: ${compliance.cadin.total} pendência(s)`);
    pontos += 25;
    rating = "vermelho";
  }
  if (compliance?.pgfn.presente) {
    motivos.push(
      `PGFN: ${compliance.pgfn.total} dívida(s)` +
      (compliance.pgfn.valor_devido ? ` — ${moeda(compliance.pgfn.valor_devido)}` : ""),
    );
    pontos += 35;
    rating = "vermelho";
  }

  if (rating !== "vermelho") {
    if (pontos >= 30) rating = "amarelo";
    else if (pontos < 0) rating = "verde";
    else if (pontos < 20) rating = "verde";
    else rating = "amarelo";
  }

  const fator_taxa = Math.max(0, Math.min(1, pontos / 60));

  return { rating, motivos, fator_taxa };
}

function pior(a: Rating, b: Rating): Rating {
  const ordem: Record<Rating, number> = { verde: 0, amarelo: 1, vermelho: 2 };
  return ordem[a] >= ordem[b] ? a : b;
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===== Simulacao em multiplos parceiros =====

export async function simularOfertas(opts: {
  loja_id: number;
  cnpj: string;
  valor_solicitado: number;
  prazo_dias: number;
  cliente_id?: number | null;
}): Promise<{ avaliacao: AvaliacaoCnpj; ofertas: OfertaCredito[] }> {
  const [parceiros, avaliacao] = await Promise.all([
    listarParceirosLoja(opts.loja_id),
    avaliarCnpj(opts.cnpj),
  ]);

  const ofertas: OfertaCredito[] = parceiros.map((pf) => {
    let apto = true;
    let motivo: string | undefined;

    if (opts.valor_solicitado < pf.ticket_min || opts.valor_solicitado > pf.ticket_max) {
      apto = false;
      motivo = `Ticket fora da faixa (${moeda(pf.ticket_min)} - ${moeda(pf.ticket_max)})`;
    } else if (opts.prazo_dias < pf.prazo_min_dias || opts.prazo_dias > pf.prazo_max_dias) {
      apto = false;
      motivo = `Prazo fora da faixa (${pf.prazo_min_dias}-${pf.prazo_max_dias} dias)`;
    } else if (avaliacao.rating === "vermelho" && pf.tipo !== "factoring") {
      apto = false;
      motivo = "Rating vermelho — apenas factoring aceita";
    }

    const taxa_aa = pf.taxa_minima_aa + (pf.taxa_maxima_aa - pf.taxa_minima_aa) * avaliacao.fator_taxa;
    const taxa_mensal = taxa_aa / 12;
    const meses = Math.max(opts.prazo_dias / 30, 1);
    const fator = Math.pow(1 + taxa_mensal / 100, meses);
    const total = opts.valor_solicitado * fator;
    const parcela = total / meses;
    const custo = total - opts.valor_solicitado;
    const comissao = total * (pf.comissao_loja_pct / 100);

    return {
      parceiro: pf,
      apto,
      motivo_inapto: motivo,
      taxa_aa: round(taxa_aa, 2),
      taxa_mensal: round(taxa_mensal, 3),
      parcela_estimada: round(parcela, 2),
      total_a_pagar: round(total, 2),
      custo_total_juros: round(custo, 2),
      comissao_loja_estimada: round(comissao, 2),
    };
  });

  ofertas.sort((a, b) => {
    if (a.apto !== b.apto) return a.apto ? -1 : 1;
    return a.taxa_aa - b.taxa_aa;
  });

  return { avaliacao, ofertas };
}

export async function salvarProposta(opts: {
  loja_id: number;
  cliente_id?: number | null;
  parceiro_id: number;
  valor_solicitado: number;
  prazo_dias: number;
  taxa_aa_ofertada: number;
  rating: Rating;
  motivos: string[];
  cnpj_consultado: string;
}): Promise<{ id: number }> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sevenconstruction.proposta_credito
       (loja_id, cliente_id, parceiro_id, valor_solicitado, prazo_dias,
        taxa_aa_ofertada, status, observacoes, metadados)
     VALUES ($1,$2,$3,$4,$5,$6,'simulada',$7,$8::jsonb)
     RETURNING id`,
    [
      opts.loja_id,
      opts.cliente_id ?? null,
      opts.parceiro_id,
      opts.valor_solicitado,
      opts.prazo_dias,
      opts.taxa_aa_ofertada,
      `Rating ${opts.rating}: ${opts.motivos.join("; ")}`,
      JSON.stringify({ rating: opts.rating, motivos: opts.motivos, cnpj_consultado: opts.cnpj_consultado }),
    ],
  );
  return r.rows[0];
}

// ===== Listagem de propostas (historico + status) =====

export interface PropostaResumo {
  id: number;
  loja_id: number;
  cliente_id: number | null;
  parceiro_id: number | null;
  parceiro_nome: string | null;
  valor_solicitado: number;
  prazo_dias: number | null;
  taxa_aa_ofertada: number | null;
  status: string;
  numero_proposta: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export async function listarPropostas(loja_id: number, opts: { status?: string; limite?: number } = {}): Promise<PropostaResumo[]> {
  const conds: string[] = ["pc.loja_id = $1"];
  const args: unknown[] = [loja_id];
  let i = 2;
  if (opts.status) { conds.push(`pc.status = $${i++}`); args.push(opts.status); }
  const limite = Math.min(Math.max(opts.limite ?? 100, 1), 500);
  args.push(limite);

  const r = await pool.query<PropostaResumo>(
    `SELECT pc.id, pc.loja_id, pc.cliente_id, pc.parceiro_id,
            pf.nome AS parceiro_nome,
            pc.valor_solicitado::float AS valor_solicitado,
            pc.prazo_dias,
            pc.taxa_aa_ofertada::float AS taxa_aa_ofertada,
            pc.status, pc.numero_proposta, pc.observacoes,
            pc.criado_em::text AS criado_em,
            pc.atualizado_em::text AS atualizado_em
       FROM sevenconstruction.proposta_credito pc
       LEFT JOIN sevenconstruction.parceiros_financeiros pf ON pf.id = pc.parceiro_id
      WHERE ${conds.join(" AND ")}
      ORDER BY pc.criado_em DESC
      LIMIT $${i}`,
    args,
  );
  return r.rows;
}

export async function mudarStatusProposta(id: number, loja_id: number, novoStatus: string, numero_proposta?: string): Promise<boolean> {
  const validos = ["simulada","enviada","analise","aprovada","recusada","cancelada","efetivada"];
  if (!validos.includes(novoStatus)) throw new Error("Status invalido");
  const r = await pool.query(
    `UPDATE sevenconstruction.proposta_credito
        SET status = $1,
            numero_proposta = COALESCE($2, numero_proposta),
            atualizado_em = NOW()
      WHERE id = $3 AND loja_id = $4`,
    [novoStatus, numero_proposta ?? null, id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}

// ===== KPIs do dashboard =====

export interface KpisCredito {
  total_propostas: number;
  por_status: Record<string, number>;
  volume_total: number;
  volume_efetivado: number;
  comissao_estimada: number;
  taxa_aa_media: number | null;
  rating_dist: { verde: number; amarelo: number; vermelho: number };
  ultimas_30d: number;
}

export async function lerKpisCredito(loja_id: number): Promise<KpisCredito> {
  const r = await pool.query<{
    total: number; aprovada: number; efetivada: number; analise: number;
    simulada: number; enviada: number; recusada: number; cancelada: number;
    volume: number; volume_efet: number; taxa_media: number | null; ult_30d: number;
  }>(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'aprovada')::int AS aprovada,
       count(*) FILTER (WHERE status = 'efetivada')::int AS efetivada,
       count(*) FILTER (WHERE status = 'analise')::int AS analise,
       count(*) FILTER (WHERE status = 'simulada')::int AS simulada,
       count(*) FILTER (WHERE status = 'enviada')::int AS enviada,
       count(*) FILTER (WHERE status = 'recusada')::int AS recusada,
       count(*) FILTER (WHERE status = 'cancelada')::int AS cancelada,
       COALESCE(SUM(valor_solicitado), 0)::float AS volume,
       COALESCE(SUM(valor_solicitado) FILTER (WHERE status = 'efetivada'), 0)::float AS volume_efet,
       AVG(taxa_aa_ofertada)::float AS taxa_media,
       count(*) FILTER (WHERE criado_em > NOW() - INTERVAL '30 days')::int AS ult_30d
       FROM sevenconstruction.proposta_credito
      WHERE loja_id = $1`,
    [loja_id],
  );
  const row = r.rows[0];

  // Rating extraido do JSON metadados.rating
  const rd = await pool.query<{ rating: string; n: number }>(
    `SELECT (metadados->>'rating') AS rating, count(*)::int AS n
       FROM sevenconstruction.proposta_credito
      WHERE loja_id = $1 AND metadados ? 'rating'
      GROUP BY rating`,
    [loja_id],
  );
  const rating_dist = { verde: 0, amarelo: 0, vermelho: 0 };
  for (const x of rd.rows) {
    if (x.rating === "verde" || x.rating === "amarelo" || x.rating === "vermelho") {
      rating_dist[x.rating as Rating] = x.n;
    }
  }

  // Comissão estimada: 1.5% sobre volume efetivado (valor médio dos parceiros) — proxy
  const comissao_estimada = row.volume_efet * 0.015;

  return {
    total_propostas: row.total,
    por_status: {
      simulada: row.simulada,
      enviada: row.enviada,
      analise: row.analise,
      aprovada: row.aprovada,
      efetivada: row.efetivada,
      recusada: row.recusada,
      cancelada: row.cancelada,
    },
    volume_total: row.volume,
    volume_efetivado: row.volume_efet,
    comissao_estimada,
    taxa_aa_media: row.taxa_media,
    rating_dist,
    ultimas_30d: row.ult_30d,
  };
}

function round(n: number, casas: number): number {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}
