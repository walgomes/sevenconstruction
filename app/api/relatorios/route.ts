// Relatorio mensal consolidado: vendas + indicacoes + clientes + prospec.

import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import pool from "@/lib/db";

export const runtime = "nodejs";

type Resumo = {
  periodo: { inicio: string; fim: string; mes_referencia: string };
  vendas: {
    total_eventos: number;
    total_venda: number;
    total_comissao: number;
    ticket_medio: number;
    por_servico: { codigo: string; nome: string; qtd: number; comissao: number }[];
  };
  indicacoes: {
    total_eventos: number;
    total_comissao_a_pagar: number;
    profissionais_ativos: number;
    top_profissionais: { nome: string; qtd: number; total: number }[];
  };
  clientes: {
    total: number;
    novos_no_mes: number;
    com_compra: number;
  };
  prospec: {
    listas_criadas_mes: number;
    total_empresas_prospectadas: number;
  };
};

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;

  const url = new URL(req.url);
  const mesParam = url.searchParams.get("mes"); // formato YYYY-MM
  let inicio: Date;
  let fim: Date;
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [ano, mes] = mesParam.split("-").map(Number);
    inicio = new Date(Date.UTC(ano, mes - 1, 1));
    fim = new Date(Date.UTC(ano, mes, 1));
  } else {
    const hoje = new Date();
    inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  }
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();
  const mesRef = inicioISO.slice(0, 7);

  // Vendas
  const vendasTotais = await pool.query(
    `SELECT COUNT(*)::int AS total_eventos,
            COALESCE(SUM(valor_venda), 0)::float AS total_venda,
            COALESCE(SUM(comissao_loja), 0)::float AS total_comissao,
            COALESCE(AVG(comissao_loja), 0)::float AS ticket_medio
       FROM sevenconstruction.comissao_evento
      WHERE loja_id = $1 AND status = 'aprovada'
        AND criado_em >= $2 AND criado_em < $3`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  const porServico = await pool.query(
    `SELECT servico_codigo AS codigo,
            servico_nome AS nome,
            COUNT(*)::int AS qtd,
            COALESCE(SUM(comissao_loja), 0)::float AS comissao
       FROM sevenconstruction.comissao_evento
      WHERE loja_id = $1 AND status = 'aprovada'
        AND criado_em >= $2 AND criado_em < $3
        AND servico_codigo IS NOT NULL
      GROUP BY servico_codigo, servico_nome
      ORDER BY comissao DESC
      LIMIT 20`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  // Indicacoes
  const indicTotais = await pool.query(
    `SELECT COUNT(*)::int AS total_eventos,
            COALESCE(SUM(comissao_valor), 0)::float AS total_comissao_a_pagar
       FROM sevenconstruction.indicacao_evento
      WHERE loja_id = $1 AND status IN ('aprovada','paga')
        AND criado_em >= $2 AND criado_em < $3`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  const profAtivos = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sevenconstruction.profissionais
      WHERE loja_id = $1 AND ativo`,
    [sessao.loja_id],
  );

  const topProf = await pool.query(
    `SELECT profissional_nome AS nome,
            COUNT(*)::int AS qtd,
            COALESCE(SUM(comissao_valor), 0)::float AS total
       FROM sevenconstruction.indicacao_evento
      WHERE loja_id = $1 AND status IN ('aprovada','paga')
        AND criado_em >= $2 AND criado_em < $3
      GROUP BY profissional_nome
      ORDER BY total DESC
      LIMIT 10`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  // Clientes
  const clientes = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE criado_em >= $2 AND criado_em < $3)::int AS novos_no_mes,
            COUNT(*) FILTER (WHERE qtd_compras > 0)::int AS com_compra
       FROM sevenconstruction.loja_clientes
      WHERE loja_id = $1 AND ativo`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  // Prospec
  const prospec = await pool.query(
    `SELECT COUNT(*)::int AS listas,
            COALESCE(SUM(total_itens), 0)::int AS total_itens
       FROM sevenconstruction.prospec_listas
      WHERE loja_id = $1
        AND criado_em >= $2 AND criado_em < $3`,
    [sessao.loja_id, inicioISO, fimISO],
  );

  const resumo: Resumo = {
    periodo: { inicio: inicioISO, fim: fimISO, mes_referencia: mesRef },
    vendas: {
      total_eventos: vendasTotais.rows[0].total_eventos,
      total_venda: vendasTotais.rows[0].total_venda,
      total_comissao: vendasTotais.rows[0].total_comissao,
      ticket_medio: vendasTotais.rows[0].ticket_medio,
      por_servico: porServico.rows,
    },
    indicacoes: {
      total_eventos: indicTotais.rows[0].total_eventos,
      total_comissao_a_pagar: indicTotais.rows[0].total_comissao_a_pagar,
      profissionais_ativos: profAtivos.rows[0]?.n ?? 0,
      top_profissionais: topProf.rows,
    },
    clientes: {
      total: clientes.rows[0].total,
      novos_no_mes: clientes.rows[0].novos_no_mes,
      com_compra: clientes.rows[0].com_compra,
    },
    prospec: {
      listas_criadas_mes: prospec.rows[0].listas,
      total_empresas_prospectadas: prospec.rows[0].total_itens,
    },
  };

  // Suporta ?formato=csv
  if (url.searchParams.get("formato") === "csv") {
    const linhas: string[] = [];
    linhas.push(`Relatorio mensal — ${mesRef}`);
    linhas.push("");
    linhas.push("VENDAS DE SERVICOS");
    linhas.push(`Total eventos;${resumo.vendas.total_eventos}`);
    linhas.push(`Receita bruta;${fmt(resumo.vendas.total_venda)}`);
    linhas.push(`Comissao da loja;${fmt(resumo.vendas.total_comissao)}`);
    linhas.push(`Ticket medio;${fmt(resumo.vendas.ticket_medio)}`);
    linhas.push("");
    linhas.push("Por servico (top 20)");
    linhas.push("Codigo;Nome;Qtd;Comissao");
    for (const s of resumo.vendas.por_servico) {
      linhas.push(`${s.codigo};"${s.nome}";${s.qtd};${fmt(s.comissao)}`);
    }
    linhas.push("");
    linhas.push("INDICACOES");
    linhas.push(`Total eventos;${resumo.indicacoes.total_eventos}`);
    linhas.push(`Comissao a pagar profissionais;${fmt(resumo.indicacoes.total_comissao_a_pagar)}`);
    linhas.push(`Profissionais ativos;${resumo.indicacoes.profissionais_ativos}`);
    linhas.push("");
    linhas.push("Top profissionais (por comissao)");
    linhas.push("Nome;Qtd indicacoes;Total comissao");
    for (const p of resumo.indicacoes.top_profissionais) {
      linhas.push(`"${p.nome}";${p.qtd};${fmt(p.total)}`);
    }
    linhas.push("");
    linhas.push("CLIENTES");
    linhas.push(`Total;${resumo.clientes.total}`);
    linhas.push(`Novos no mes;${resumo.clientes.novos_no_mes}`);
    linhas.push(`Com compra;${resumo.clientes.com_compra}`);
    linhas.push("");
    linhas.push("PROSPECCAO");
    linhas.push(`Listas criadas;${resumo.prospec.listas_criadas_mes}`);
    linhas.push(`Total empresas prospectadas;${resumo.prospec.total_empresas_prospectadas}`);

    const csv = "﻿" + linhas.join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="relatorio-${mesRef}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, ...resumo });
}

function fmt(v: number): string {
  return v.toFixed(2).replace(".", ",");
}
