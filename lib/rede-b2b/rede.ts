/**
 * lib/rede-b2b/rede.ts — Motor da Rede B2B de Performance.
 *
 * COPIA INDEPENDENTE: alterar aqui NAO altera no projeto seven-empresas.
 * Tabelas em sevenconstruction.b2b_*. Empresas/transparencia/cnpj_eventos
 * vem da sevendb (CONSULTTUDO_DATABASE_URL) via rfbQuery (read-only).
 *
 * Cada empresa tem PERFIL declarado (o que vende, ICP, quem procura).
 * Motor cruza:
 *   1. Lookalike classico (perfil-base extraido da empresa)
 *   2. ICP declarado (filtros explicitos)
 *   3. Intent Signals (empresas em movimento — convertem 5-10x mais)
 *   4. Reciprocidade: empresa-alvo tambem declarou interesse no segmento
 *
 * Gera fit_score 0-100 e grava em b2b_matches pra reuso/historico.
 */

import pool from "@/lib/db";
import { rfbQuery } from "@/lib/rfb-db";
import { signalsBatch } from "./signals";

export interface PerfilB2B {
  id: number;
  cnpj: string;
  cliente_id: number | null;
  o_que_vende: string | null;
  diferencial: string | null;
  icp_cnaes: string[] | null;
  icp_ufs: string[] | null;
  icp_porte: string[] | null;
  icp_faturamento_min: number | null;
  icp_faturamento_max: number | null;
  icp_descricao: string | null;
  capacidade_atendimentos_mes: number | null;
  ticket_medio_centavos: number | null;
  modalidade: string[] | null;
  visivel: boolean;
  aberto_para_conversas: boolean;
  procurando_clientes: boolean;
  procurando_fornecedores: boolean;
  procurando_parcerias: boolean;
  verificado: boolean;
}

export interface MatchB2B {
  cnpj_alvo: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  uf: string;
  municipio: string | null;
  porte: number;
  capital_social: number;
  email: string | null;
  telefone: string | null;
  fit_score: number;
  fit_breakdown: {
    cnae: number;
    uf: number;
    porte: number;
    capital: number;
    signals: number;
    reciprocidade: number;
    perfil_declarado: number;
  };
  motivo: string;
  signals: {
    recentes_30d: number;
    recentes_90d: number;
    tipos: string[];
    resumo: string;
  } | null;
  perfil_declarado: boolean;
  aberto_para_conversas: boolean;
}

const PORTE_LABEL_TO_NUM: Record<string, number> = {
  ME: 2, EPP: 3, MEDIA: 5, GRANDE: 5, DEMAIS: 5,
};

export async function buscarPerfilB2B(cnpj: string): Promise<PerfilB2B | null> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return null;
  const r = await pool.query(
    `SELECT * FROM sevenconstruction.b2b_perfis WHERE cnpj = $1 LIMIT 1`,
    [limpo],
  );
  return (r.rows[0] as PerfilB2B) || null;
}

export async function salvarPerfilB2B(
  cnpj: string,
  dados: Partial<PerfilB2B>,
  clienteId?: number,
): Promise<PerfilB2B> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) throw new Error("CNPJ inválido");

  const r = await pool.query(
    `INSERT INTO sevenconstruction.b2b_perfis (cnpj, cliente_id, o_que_vende, diferencial,
       icp_cnaes, icp_ufs, icp_porte, icp_faturamento_min, icp_faturamento_max, icp_descricao,
       capacidade_atendimentos_mes, ticket_medio_centavos, modalidade,
       visivel, aberto_para_conversas, procurando_clientes, procurando_fornecedores, procurando_parcerias)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (cnpj) DO UPDATE SET
       cliente_id = COALESCE(EXCLUDED.cliente_id, sevenconstruction.b2b_perfis.cliente_id),
       o_que_vende = COALESCE(EXCLUDED.o_que_vende, sevenconstruction.b2b_perfis.o_que_vende),
       diferencial = COALESCE(EXCLUDED.diferencial, sevenconstruction.b2b_perfis.diferencial),
       icp_cnaes = COALESCE(EXCLUDED.icp_cnaes, sevenconstruction.b2b_perfis.icp_cnaes),
       icp_ufs = COALESCE(EXCLUDED.icp_ufs, sevenconstruction.b2b_perfis.icp_ufs),
       icp_porte = COALESCE(EXCLUDED.icp_porte, sevenconstruction.b2b_perfis.icp_porte),
       icp_faturamento_min = COALESCE(EXCLUDED.icp_faturamento_min, sevenconstruction.b2b_perfis.icp_faturamento_min),
       icp_faturamento_max = COALESCE(EXCLUDED.icp_faturamento_max, sevenconstruction.b2b_perfis.icp_faturamento_max),
       icp_descricao = COALESCE(EXCLUDED.icp_descricao, sevenconstruction.b2b_perfis.icp_descricao),
       capacidade_atendimentos_mes = COALESCE(EXCLUDED.capacidade_atendimentos_mes, sevenconstruction.b2b_perfis.capacidade_atendimentos_mes),
       ticket_medio_centavos = COALESCE(EXCLUDED.ticket_medio_centavos, sevenconstruction.b2b_perfis.ticket_medio_centavos),
       modalidade = COALESCE(EXCLUDED.modalidade, sevenconstruction.b2b_perfis.modalidade),
       visivel = EXCLUDED.visivel,
       aberto_para_conversas = EXCLUDED.aberto_para_conversas,
       procurando_clientes = EXCLUDED.procurando_clientes,
       procurando_fornecedores = EXCLUDED.procurando_fornecedores,
       procurando_parcerias = EXCLUDED.procurando_parcerias,
       atualizado_em = NOW()
     RETURNING *`,
    [
      limpo,
      clienteId ?? dados.cliente_id ?? null,
      dados.o_que_vende ?? null,
      dados.diferencial ?? null,
      dados.icp_cnaes ?? null,
      dados.icp_ufs ?? null,
      dados.icp_porte ?? null,
      dados.icp_faturamento_min ?? null,
      dados.icp_faturamento_max ?? null,
      dados.icp_descricao ?? null,
      dados.capacidade_atendimentos_mes ?? null,
      dados.ticket_medio_centavos ?? null,
      dados.modalidade ?? null,
      dados.visivel ?? true,
      dados.aberto_para_conversas ?? true,
      dados.procurando_clientes ?? true,
      dados.procurando_fornecedores ?? false,
      dados.procurando_parcerias ?? false,
    ],
  );
  return r.rows[0] as PerfilB2B;
}

/**
 * Gera matches para o CNPJ origem usando o ICP declarado + signals + reciprocidade.
 */
export async function gerarMatches(
  cnpjOrigem: string,
  opts: { limite?: number; salvar?: boolean } = {},
): Promise<MatchB2B[]> {
  const limpo = cnpjOrigem.replace(/\D/g, "");
  if (limpo.length !== 14) throw new Error("CNPJ origem inválido");

  const perfil = await buscarPerfilB2B(limpo);
  if (!perfil) throw new Error("Cadastre seu perfil B2B antes de buscar matches");

  const limite = Math.min(Math.max(opts.limite || 50, 10), 500);

  // Filtros ICP — query nas empresas RFB (sevendb) via rfbQuery
  const conds: string[] = ["situacao = 2", "cnpj <> $1"];
  const params: unknown[] = [limpo];
  let i = 2;

  if (perfil.icp_cnaes && perfil.icp_cnaes.length > 0) {
    conds.push(`cnae_fiscal = ANY($${i++}::bpchar[])`);
    params.push(perfil.icp_cnaes);
  }
  if (perfil.icp_ufs && perfil.icp_ufs.length > 0) {
    conds.push(`uf = ANY($${i++}::text[])`);
    params.push(perfil.icp_ufs);
  }
  if (perfil.icp_porte && perfil.icp_porte.length > 0) {
    const portesNum = perfil.icp_porte.map((p) => PORTE_LABEL_TO_NUM[p.toUpperCase()] || 0).filter(Boolean);
    if (portesNum.length > 0) {
      conds.push(`COALESCE(porte, 1) = ANY($${i++}::int[])`);
      params.push(portesNum);
    }
  }
  if (perfil.icp_faturamento_min) {
    conds.push(`COALESCE(capital_social, 0) >= $${i++}`);
    params.push(Math.floor(perfil.icp_faturamento_min / 10));
  }

  const sql = `
    SELECT cnpj, razao_social, nome_fantasia, cnae_fiscal, cnae_descricao,
           uf, municipio,
           COALESCE(porte, 1) AS porte,
           COALESCE(capital_social, 0)::numeric AS capital_social,
           email, ddd1, telefone1
      FROM empresas
     WHERE ${conds.join(" AND ")}
     ORDER BY COALESCE(capital_social, 0) DESC
     LIMIT $${i++}
  `;
  params.push(limite * 3);

  const candidatos = await rfbQuery<Record<string, unknown>>(sql, params);
  const cnpjsCandidatos = candidatos.map((c) => c.cnpj as string);

  // Intent Signals
  const signalsMap = await signalsBatch(cnpjsCandidatos);

  // Reciprocidade — busca alvos que tem perfil declarado VISIVEL (DB do SC)
  const perfisAlvoQ = await pool.query(
    `SELECT cnpj, aberto_para_conversas, procurando_fornecedores
       FROM sevenconstruction.b2b_perfis
      WHERE cnpj = ANY($1::varchar[]) AND visivel = TRUE`,
    [cnpjsCandidatos],
  );
  const perfisAlvoMap = new Map<string, { aberto: boolean; procurando_fornecedores: boolean }>();
  for (const p of perfisAlvoQ.rows) {
    perfisAlvoMap.set(p.cnpj, {
      aberto: !!p.aberto_para_conversas,
      procurando_fornecedores: !!p.procurando_fornecedores,
    });
  }

  // Calcula fit_score
  const matches: MatchB2B[] = candidatos.map((row) => {
    const cnpjAlvo = row.cnpj as string;
    const cnae = row.cnae_fiscal as string;
    const uf = row.uf as string;
    const porte = Number(row.porte);
    const capital = Number(row.capital_social) || 0;

    let ptsCnae = 0, ptsUf = 0, ptsPorte = 0, ptsCapital = 0, ptsRecip = 0, ptsPerfil = 0;
    const motivos: string[] = [];

    if (perfil.icp_cnaes && perfil.icp_cnaes.includes(cnae)) {
      ptsCnae = 25;
      motivos.push("CNAE no seu ICP");
    }
    if (perfil.icp_ufs && perfil.icp_ufs.includes(uf)) {
      ptsUf = 10;
      motivos.push(`UF ${uf}`);
    }
    if (perfil.icp_porte && perfil.icp_porte.length > 0) {
      const portesNum = perfil.icp_porte.map((p) => PORTE_LABEL_TO_NUM[p.toUpperCase()] || 0).filter(Boolean);
      if (portesNum.includes(porte)) ptsPorte = 10;
    }
    if (perfil.icp_faturamento_min || perfil.icp_faturamento_max) {
      const min = perfil.icp_faturamento_min ? perfil.icp_faturamento_min / 10 : 0;
      const max = perfil.icp_faturamento_max ? perfil.icp_faturamento_max / 10 : Infinity;
      if (capital >= min && capital <= max) {
        ptsCapital = 10;
        motivos.push("Faturamento estimado dentro do ICP");
      }
    }

    const perfilAlvo = perfisAlvoMap.get(cnpjAlvo);
    if (perfilAlvo) {
      ptsPerfil = 10;
      motivos.push("Empresa cadastrada na rede");
      if (perfilAlvo.procurando_fornecedores) {
        ptsRecip = 15;
        motivos.push("⚡ Está procurando fornecedores");
      } else if (perfilAlvo.aberto) {
        ptsRecip = 5;
      }
    }

    const s = signalsMap.get(cnpjAlvo);
    let ptsSignals = 0;
    if (s) {
      if (s.signals_30d > 0) {
        ptsSignals = 30;
        motivos.push(`🔥 ${s.signals_30d} sinal(is) recente(s)`);
      } else if (s.signals_90d > 0) {
        ptsSignals = 15;
        motivos.push(`📊 ${s.signals_90d} sinal(is) últimos 90d`);
      }
    }

    const fitScore = Math.min(100, ptsCnae + ptsUf + ptsPorte + ptsCapital + ptsSignals + ptsRecip + ptsPerfil);

    return {
      cnpj_alvo: cnpjAlvo,
      razao_social: (row.razao_social as string) || "",
      nome_fantasia: (row.nome_fantasia as string) || null,
      cnae_fiscal: cnae,
      cnae_descricao: (row.cnae_descricao as string) || null,
      uf,
      municipio: (row.municipio as string) || null,
      porte,
      capital_social: capital,
      email: (row.email as string) || null,
      telefone: row.telefone1 ? `${row.ddd1 || ""}${row.telefone1}` : null,
      fit_score: fitScore,
      fit_breakdown: {
        cnae: ptsCnae, uf: ptsUf, porte: ptsPorte, capital: ptsCapital,
        signals: ptsSignals, reciprocidade: ptsRecip, perfil_declarado: ptsPerfil,
      },
      motivo: motivos.join(" · ") || "Match básico",
      signals: s
        ? { recentes_30d: s.signals_30d, recentes_90d: s.signals_90d, tipos: s.tipos, resumo: s.resumo }
        : null,
      perfil_declarado: !!perfilAlvo,
      aberto_para_conversas: perfilAlvo?.aberto ?? false,
    };
  });

  matches.sort((a, b) => b.fit_score - a.fit_score);
  const topMatches = matches.slice(0, limite);

  if (opts.salvar) {
    for (const m of topMatches) {
      await pool.query(
        `INSERT INTO sevenconstruction.b2b_matches (cnpj_origem, cnpj_alvo, fit_score, fonte, motivo, status)
         VALUES ($1, $2, $3, 'rede_motor', $4, 'novo')
         ON CONFLICT (cnpj_origem, cnpj_alvo, fonte) DO UPDATE SET
           fit_score = EXCLUDED.fit_score,
           motivo = EXCLUDED.motivo,
           criado_em = NOW()`,
        [limpo, m.cnpj_alvo, m.fit_score, m.motivo],
      ).catch(() => {});
    }
  }

  return topMatches;
}

/**
 * Inicia conversa entre duas empresas (cria b2b_conversas + 1ª mensagem).
 */
export async function iniciarConversa(opts: {
  cnpj_origem: string;
  cnpj_alvo: string;
  match_id?: number;
  decisor_nome?: string;
  decisor_cargo?: string;
  decisor_email?: string;
  decisor_telefone?: string;
  primeira_mensagem: string;
  remetente_user_id?: number;
}): Promise<{ conversa_id: number; criada: boolean }> {
  const origem = opts.cnpj_origem.replace(/\D/g, "");
  const alvo = opts.cnpj_alvo.replace(/\D/g, "");
  if (origem.length !== 14 || alvo.length !== 14) throw new Error("CNPJs inválidos");

  const existeQ = await pool.query(
    `SELECT id FROM sevenconstruction.b2b_conversas WHERE cnpj_origem = $1 AND cnpj_alvo = $2 LIMIT 1`,
    [origem, alvo],
  );
  if (existeQ.rows.length > 0) {
    return { conversa_id: existeQ.rows[0].id, criada: false };
  }

  const conv = await pool.query(
    `INSERT INTO sevenconstruction.b2b_conversas
       (match_id, cnpj_origem, cnpj_alvo, decisor_nome, decisor_cargo, decisor_email, decisor_telefone)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [opts.match_id || null, origem, alvo, opts.decisor_nome || null, opts.decisor_cargo || null, opts.decisor_email || null, opts.decisor_telefone || null],
  );
  const conversaId = conv.rows[0].id as number;

  await pool.query(
    `INSERT INTO sevenconstruction.b2b_mensagens (conversa_id, remetente_cnpj, remetente_user_id, conteudo)
     VALUES ($1, $2, $3, $4)`,
    [conversaId, origem, opts.remetente_user_id || null, opts.primeira_mensagem],
  );

  if (opts.match_id) {
    await pool.query(
      `UPDATE sevenconstruction.b2b_matches SET status = 'conversando' WHERE id = $1`,
      [opts.match_id],
    ).catch(() => {});
  }

  return { conversa_id: conversaId, criada: true };
}
