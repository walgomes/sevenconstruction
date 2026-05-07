// Dispara o pipeline de homologacao IA num parceiro:
// preCheck → (compliance + finance + operacional + legal em paralelo) → trustScore → decisionAssist
// Cada passo grava parecer no parceiro e log_decisoes.

import { NextRequest, NextResponse } from "next/server";
import { exigirSuper, type SessaoSc } from "@/lib/auth";
import { lerParceiro, mudarFase, salvarAnalise, autoCategorizarTipo } from "@/lib/parceiros";
import {
  preCheckAI, complianceAI, financeAI, operacionalAI, legalAI,
  trustScore, decisionAssist,
} from "@/lib/srm/agentes";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let sessao: SessaoSc;
  try { sessao = await exigirSuper(); }
  catch { return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 }); }

  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  const p = await lerParceiro(n);
  if (!p) return NextResponse.json({ ok: false, motivo: "nao encontrado" }, { status: 404 });

  // Resolve nome do super pra log
  const sa = await pool.query<{ nome: string }>(
    `SELECT nome FROM sevenconstruction.super_admins WHERE id = $1`, [sessao.id],
  );
  const ator = { id: sessao.id, tipo: "ia" as const, nome: `IA disparada por ${sa.rows[0]?.nome ?? `super#${sessao.id}`}` };

  try {
    // ===== Pre Check =====
    const pre = await preCheckAI(p);
    const tipoAuto = await autoCategorizarTipo(n, pre.cnae_fiscal);
    await salvarAnalise(n, { risco_inicial: pre.risco_inicial });
    await mudarFase(n, "pre_check", { ...ator, nome: "Pre Check AI" }, {
      motivo: `Risco inicial: ${pre.risco_inicial}. ${tipoAuto ? `Auto-tipo: ${tipoAuto}. ` : ""}${pre.motivos.join("; ")}`,
      payload: { agente: "pre_check", tipo_auto: tipoAuto, ...pre },
    });

    // ===== Analises paralelas =====
    const [compliance, finance, operacional, legal] = await Promise.all([
      complianceAI(p),
      financeAI(p, pre),
      operacionalAI(p),
      legalAI(p, pre),
    ]);
    await salvarAnalise(n, {
      parecer_compliance: compliance,
      parecer_finance: finance,
      parecer_operacional: operacional,
      parecer_legal: legal,
    });
    await mudarFase(n, "analises", { ...ator, nome: "Analises Paralelas" }, {
      motivo: `Compliance: ${compliance.flags.length} flags. Finance: ${finance.saude}.`,
      payload: { compliance, finance, operacional, legal },
    });

    // ===== Trust Score =====
    const ts = trustScore({ compliance, finance, operacional, legal });
    await salvarAnalise(n, { trust_score: ts.score });
    await mudarFase(n, "consolidacao", { ...ator, nome: "Trust Score AI" }, {
      motivo: `Score ${ts.score}/100 (${ts.bandeira}). Breakdown: comp=${ts.breakdown.compliance}, fin=${ts.breakdown.finance}, ope=${ts.breakdown.operacional}, leg=${ts.breakdown.legal}.`,
      trust_score: ts.score,
      payload: { agente: "trust_score", ...ts },
    });

    // ===== Decision Assist =====
    const dec = await decisionAssist(p, { compliance, finance, operacional, legal }, ts.score);
    await salvarAnalise(n, { recomendacao_ia: dec.recomendacao, recomendacao_motivo: dec.motivo });
    await mudarFase(n, "decisao", { ...ator, nome: "Decision Assist AI" }, {
      motivo: `${dec.recomendacao.toUpperCase()}: ${dec.motivo}`,
      trust_score: ts.score,
      payload: { agente: "decision_assist", ...dec },
    });

    const final = await lerParceiro(n);
    return NextResponse.json({
      ok: true,
      parceiro: final,
      pareceres: { pre, compliance, finance, operacional, legal, trust: ts, decisao: dec },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
