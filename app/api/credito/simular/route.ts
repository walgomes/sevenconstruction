// Simulador de crédito (FIDC mock). Calcula taxa estimada baseado em:
//   - tempo de mercado (data_abertura)
//   - capital social
//   - situação RFB (ativa = ok)
//   - presença em CADIN/PGFN (penalidade)
//   - valor solicitado
//   - prazo
// Salva proposta_credito com status='simulada' (ledger).
// IMPORTANTE: nao aprova nada. So estima. Aprovacao real exige adapter.

import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import pool from "@/lib/db";
import { buscarDadosEmpresa, lerCompliance } from "@/lib/consulta-cnpj";

export const runtime = "nodejs";
export const maxDuration = 30;

type SimulInput = {
  cnpj?: string;
  cliente_id?: number;
  valor_solicitado?: number;
  prazo_dias?: number;
};

type SimulOutput = {
  taxa_aa_estimada: number;
  taxa_mensal: number;
  parcela_estimada: number;
  total_a_pagar: number;
  rating: "verde" | "amarelo" | "vermelho";
  rating_motivo: string;
  proposta_id: number;
};

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  let body: SimulInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const valor = Number(body.valor_solicitado);
  const prazo = Number(body.prazo_dias) || 30;
  if (!Number.isFinite(valor) || valor < 100 || valor > 1_000_000) {
    return NextResponse.json(
      { ok: false, motivo: "valor_solicitado deve ser entre R$ 100 e R$ 1.000.000" },
      { status: 400 },
    );
  }
  if (prazo < 7 || prazo > 720) {
    return NextResponse.json(
      { ok: false, motivo: "prazo_dias deve ser entre 7 e 720" },
      { status: 400 },
    );
  }

  let cnpj = "";
  if (body.cliente_id) {
    const r = await pool.query(
      `SELECT cnpj FROM sevenconstruction.loja_clientes WHERE id = $1 AND loja_id = $2`,
      [body.cliente_id, sessao.loja_id],
    );
    if (!r.rows[0]?.cnpj) {
      return NextResponse.json(
        { ok: false, motivo: "Cliente sem CNPJ — informe CNPJ direto" },
        { status: 400 },
      );
    }
    cnpj = r.rows[0].cnpj;
  } else if (body.cnpj) {
    cnpj = body.cnpj.replace(/\D/g, "");
  } else {
    return NextResponse.json({ ok: false, motivo: "cnpj ou cliente_id obrigatório" }, { status: 400 });
  }

  if (cnpj.length !== 14) {
    return NextResponse.json({ ok: false, motivo: "CNPJ inválido" }, { status: 400 });
  }

  // Coleta dados RFB + compliance
  const [empresa, compliance] = await Promise.all([
    buscarDadosEmpresa(cnpj).catch(() => null),
    lerCompliance(cnpj).catch(() => null),
  ]);

  // Algoritmo de rating + taxa (heurística simples)
  let taxaAa = 30; // default 30% a.a. (alto risco)
  let rating: "verde" | "amarelo" | "vermelho" = "amarelo";
  const motivos: string[] = [];

  if (!empresa) {
    motivos.push("CNPJ não encontrado no RFB");
    taxaAa = 60;
    rating = "vermelho";
  } else {
    // Situação ativa
    if (empresa.situacao !== 2) {
      motivos.push(`Situação ${empresa.situacao_label}`);
      taxaAa += 30;
      rating = "vermelho";
    }
    // Tempo de mercado
    if (empresa.data_abertura) {
      const anosMercado = (Date.now() - new Date(empresa.data_abertura).getTime()) / (365 * 86400_000);
      if (anosMercado < 1) {
        motivos.push("Empresa < 1 ano de mercado");
        taxaAa += 15;
      } else if (anosMercado < 3) {
        motivos.push("Empresa entre 1-3 anos de mercado");
        taxaAa += 5;
      } else if (anosMercado >= 5) {
        motivos.push(`Empresa estabelecida (${Math.floor(anosMercado)} anos)`);
        taxaAa -= 5;
        if (rating !== "vermelho") rating = "verde";
      }
    }
    // Capital social
    if (empresa.capital_social && empresa.capital_social > 100_000) {
      motivos.push(`Capital social ${empresa.capital_social.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
      taxaAa -= 3;
    } else if (empresa.capital_social != null && empresa.capital_social < 10_000) {
      motivos.push("Capital social baixo");
      taxaAa += 5;
    }
  }

  if (compliance?.cadin.presente) {
    motivos.push(`CADIN: ${compliance.cadin.total} pendência(s)`);
    taxaAa += 10;
    rating = "vermelho";
  }
  if (compliance?.pgfn.presente) {
    motivos.push(
      `PGFN: ${compliance.pgfn.total} dívida(s)` +
      (compliance.pgfn.valor_devido
        ? ` — ${compliance.pgfn.valor_devido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : ""),
    );
    taxaAa += 15;
    rating = "vermelho";
  }

  // Clamp da taxa
  taxaAa = Math.max(8, Math.min(taxaAa, 90));

  // Cálculo da parcela (juros compostos simplificado)
  const taxaMensal = taxaAa / 12;
  const meses = prazo / 30;
  const fator = Math.pow(1 + taxaMensal / 100, meses);
  const totalPagar = valor * fator;
  const parcela = totalPagar / Math.max(meses, 1);

  // Salva proposta
  const ins = await pool.query(
    `INSERT INTO sevenconstruction.proposta_credito
       (loja_id, cliente_id, valor_solicitado, prazo_dias, taxa_aa_ofertada,
        status, observacoes, metadados)
     VALUES ($1, $2, $3, $4, $5, 'simulada', $6, $7)
     RETURNING id`,
    [
      sessao.loja_id,
      body.cliente_id ?? null,
      valor,
      prazo,
      taxaAa,
      `Rating ${rating}: ${motivos.join("; ")}`,
      JSON.stringify({ rating, motivos, cnpj_consultado: cnpj }),
    ],
  );

  const out: SimulOutput = {
    taxa_aa_estimada: parseFloat(taxaAa.toFixed(2)),
    taxa_mensal: parseFloat(taxaMensal.toFixed(2)),
    parcela_estimada: parseFloat(parcela.toFixed(2)),
    total_a_pagar: parseFloat(totalPagar.toFixed(2)),
    rating,
    rating_motivo: motivos.join("; "),
    proposta_id: ins.rows[0].id,
  };

  return NextResponse.json({ ok: true, ...out });
}
