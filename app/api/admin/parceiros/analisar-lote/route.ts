// Analisa em lote parceiros que estao na fase 'solicitacao' (ou outra).
// Concorrencia 3 (cada um faz varios fetches HTTPS — RFB e Anthropic).

import { NextRequest, NextResponse } from "next/server";
import { exigirSuper, type SessaoSc } from "@/lib/auth";
import { lerParceiro, mudarFase, salvarAnalise, autoCategorizarTipo } from "@/lib/parceiros";
import {
  preCheckAI, complianceAI, financeAI, operacionalAI, legalAI,
  trustScore, decisionAssist,
} from "@/lib/srm/agentes";
import pool from "@/lib/db";
import type { FaseHomolog } from "@/lib/parceiros-tipos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let sessao: SessaoSc;
  try { sessao = await exigirSuper(); }
  catch { return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 }); }

  let body: { fase?: FaseHomolog; limite?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const fase: FaseHomolog = (body.fase as FaseHomolog) ?? "solicitacao";
  const limite = Math.min(body.limite ?? 50, 200);

  const ids = await pool.query<{ id: number }>(
    `SELECT id FROM sevenconstruction.parceiros
      WHERE fase_homolog = $1
      ORDER BY id ASC LIMIT $2`,
    [fase, limite],
  );
  if (ids.rows.length === 0) {
    return NextResponse.json({ ok: true, processados: 0, resultados: [] });
  }

  const sa = await pool.query<{ nome: string }>(
    `SELECT nome FROM sevenconstruction.super_admins WHERE id = $1`, [sessao.id],
  );
  const nomeAtor = sa.rows[0]?.nome ?? `super#${sessao.id}`;

  const queue = ids.rows.map((r) => r.id);
  const resultados: { id: number; ok: boolean; score?: number; recomendacao?: string; motivo?: string }[] = [];

  async function processar(parceiro_id: number) {
    try {
      const p = await lerParceiro(parceiro_id);
      if (!p) { resultados.push({ id: parceiro_id, ok: false, motivo: "nao encontrado" }); return; }

      const ator = { id: sessao.id, tipo: "ia" as const, nome: `Pipeline IA (${nomeAtor})` };

      const pre = await preCheckAI(p);
      await autoCategorizarTipo(parceiro_id, pre.cnae_fiscal);
      await salvarAnalise(parceiro_id, { risco_inicial: pre.risco_inicial });
      await mudarFase(parceiro_id, "pre_check", ator, { motivo: pre.motivos.join("; ") || "ok", payload: { pre } });

      const [compliance, finance, operacional, legal] = await Promise.all([
        complianceAI(p), financeAI(p, pre), operacionalAI(p), legalAI(p, pre),
      ]);
      await salvarAnalise(parceiro_id, {
        parecer_compliance: compliance, parecer_finance: finance,
        parecer_operacional: operacional, parecer_legal: legal,
      });
      await mudarFase(parceiro_id, "analises", ator, {
        payload: { compliance, finance, operacional, legal },
      });

      const ts = trustScore({ compliance, finance, operacional, legal });
      await salvarAnalise(parceiro_id, { trust_score: ts.score });
      await mudarFase(parceiro_id, "consolidacao", ator, { trust_score: ts.score, payload: ts });

      const dec = await decisionAssist(p, { compliance, finance, operacional, legal }, ts.score);
      await salvarAnalise(parceiro_id, { recomendacao_ia: dec.recomendacao, recomendacao_motivo: dec.motivo });
      await mudarFase(parceiro_id, "decisao", ator, { trust_score: ts.score, motivo: dec.motivo, payload: dec });

      resultados.push({ id: parceiro_id, ok: true, score: ts.score, recomendacao: dec.recomendacao });
    } catch (e) {
      resultados.push({ id: parceiro_id, ok: false, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      if (id == null) break;
      await processar(id);
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const ok = resultados.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, processados: resultados.length, sucesso: ok, resultados });
}
