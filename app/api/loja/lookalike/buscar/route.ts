/**
 * POST /api/loja/lookalike/buscar
 *
 * Extrai perfil da carteira (cnpjs do body) e retorna lista ranqueada
 * de empresas similares na sevendb que NAO estao na carteira.
 * Enriquece com Intent Signals (cnpj_eventos).
 */

import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { extrairPerfil, normalizarCnpjs } from "@/lib/lookalike/perfil";
import { buscarSimilares } from "@/lib/lookalike/ranking";
import { signalsBatch } from "@/lib/rede-b2b/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FiltrosIn {
  ufs?: string[];
  exigir_email?: boolean;
  exigir_telefone?: boolean;
  capital_min?: number;
  capital_max?: number;
  limite?: number;
  apenas_com_sinais?: boolean;
  ordenar_por_sinais?: boolean;
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { cnpjs?: string | string[]; filtros?: FiltrosIn };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  if (!body.cnpjs) return NextResponse.json({ error: "Campo 'cnpjs' obrigatório" }, { status: 400 });

  const cnpjsNormalizados = normalizarCnpjs(typeof body.cnpjs === "string" ? [body.cnpjs] : body.cnpjs);
  if (cnpjsNormalizados.length === 0) {
    return NextResponse.json({ error: "Nenhum CNPJ válido" }, { status: 400 });
  }

  try {
    const perfil = await extrairPerfil(cnpjsNormalizados);
    const filtros = body.filtros || {};
    const resultado = await buscarSimilares(perfil, {
      excluir_cnpjs: cnpjsNormalizados,
      ufs: filtros.ufs,
      exigir_email: filtros.exigir_email,
      exigir_telefone: filtros.exigir_telefone,
      capital_min: filtros.capital_min,
      capital_max: filtros.capital_max,
      limite: filtros.apenas_com_sinais ? Math.min(2000, (filtros.limite || 200) * 3) : filtros.limite,
    });

    const cnpjsCandidatos = resultado.empresas.map((e) => e.cnpj);
    const signalsMap = await signalsBatch(cnpjsCandidatos);

    let empresasEnriquecidas = resultado.empresas.map((e) => {
      const s = signalsMap.get(e.cnpj);
      const signalsBoost = s?.boost || 0;
      return {
        ...e,
        score: e.score + signalsBoost,
        signals: s
          ? {
              recentes_30d: s.signals_30d,
              recentes_90d: s.signals_90d,
              tipos: s.tipos,
              ultimo_evento: s.ultimo_evento,
              resumo: s.resumo,
              boost: s.boost,
            }
          : null,
      };
    });

    if (filtros.apenas_com_sinais) {
      empresasEnriquecidas = empresasEnriquecidas.filter((e) => e.signals && e.signals.recentes_90d > 0);
    }
    if (filtros.ordenar_por_sinais) {
      empresasEnriquecidas.sort((a, b) => {
        const aTier = a.signals?.recentes_30d ? 2 : a.signals?.recentes_90d ? 1 : 0;
        const bTier = b.signals?.recentes_30d ? 2 : b.signals?.recentes_90d ? 1 : 0;
        if (aTier !== bTier) return bTier - aTier;
        return b.score - a.score;
      });
    }

    const limiteFinal = Math.min(filtros.limite || 200, 2000);
    empresasEnriquecidas = empresasEnriquecidas.slice(0, limiteFinal);

    return NextResponse.json({
      ok: true,
      perfil,
      filtros_aplicados: resultado.filtros_aplicados,
      total: empresasEnriquecidas.length,
      empresas: empresasEnriquecidas,
      signals_resumo: {
        com_sinais_30d: empresasEnriquecidas.filter((e) => (e.signals?.recentes_30d || 0) > 0).length,
        com_sinais_90d: empresasEnriquecidas.filter((e) => (e.signals?.recentes_90d || 0) > 0).length,
        total_sem_sinais: empresasEnriquecidas.filter((e) => !e.signals || e.signals.recentes_90d === 0).length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
