// POST /api/credito/ofertas — comparativo: para 1 CNPJ + valor + prazo,
// retorna lista de ofertas (uma por parceiro ativo da loja). Salva 1 proposta
// por parceiro apto pra rastreio.

import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { simularOfertas, salvarProposta } from "@/lib/credito";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  let body: { cnpj?: string; cliente_id?: number; valor_solicitado?: number; prazo_dias?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, motivo: "JSON invalido" }, { status: 400 }); }

  const valor = Number(body.valor_solicitado);
  const prazo = Number(body.prazo_dias) || 30;
  if (!Number.isFinite(valor) || valor < 100 || valor > 1_000_000) {
    return NextResponse.json({ ok: false, motivo: "valor entre R$ 100 e R$ 1.000.000" }, { status: 400 });
  }
  if (prazo < 7 || prazo > 720) {
    return NextResponse.json({ ok: false, motivo: "prazo entre 7 e 720 dias" }, { status: 400 });
  }

  let cnpj = "";
  if (body.cliente_id) {
    const r = await pool.query(
      `SELECT cnpj FROM sevenconstruction.loja_clientes WHERE id = $1 AND loja_id = $2`,
      [body.cliente_id, sessao.loja_id],
    );
    if (!r.rows[0]?.cnpj) return NextResponse.json({ ok: false, motivo: "Cliente sem CNPJ" }, { status: 400 });
    cnpj = r.rows[0].cnpj;
  } else if (body.cnpj) {
    cnpj = body.cnpj.replace(/\D/g, "");
  } else {
    return NextResponse.json({ ok: false, motivo: "cnpj ou cliente_id obrigatorio" }, { status: 400 });
  }
  if (cnpj.length !== 14) return NextResponse.json({ ok: false, motivo: "CNPJ invalido" }, { status: 400 });

  const { avaliacao, ofertas } = await simularOfertas({
    loja_id: sessao.loja_id!,
    cnpj,
    valor_solicitado: valor,
    prazo_dias: prazo,
    cliente_id: body.cliente_id ?? null,
  });

  // Persiste 1 proposta por parceiro APTO (pra rastrear conversao por parceiro)
  const propostas: { parceiro_id: number; proposta_id: number }[] = [];
  for (const o of ofertas.filter((x) => x.apto)) {
    try {
      const r = await salvarProposta({
        loja_id: sessao.loja_id!,
        cliente_id: body.cliente_id ?? null,
        parceiro_id: o.parceiro.id,
        valor_solicitado: valor,
        prazo_dias: prazo,
        taxa_aa_ofertada: o.taxa_aa,
        rating: avaliacao.rating,
        motivos: avaliacao.motivos,
        cnpj_consultado: cnpj,
      });
      propostas.push({ parceiro_id: o.parceiro.id, proposta_id: r.id });
    } catch { /* nao bloqueia se persistencia falhar */ }
  }

  return NextResponse.json({
    ok: true,
    avaliacao,
    ofertas: ofertas.map((o, idx) => ({
      ...o,
      proposta_id: propostas[idx]?.proposta_id ?? null,
    })),
    cnpj_consultado: cnpj,
  });
}
