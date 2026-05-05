import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { listarEventosComissao } from "@/lib/comissoes";

export const runtime = "nodejs";

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  const eventos = await listarEventosComissao(sessao.loja_id, 1000);

  const headers = [
    "id",
    "data",
    "cliente",
    "servico_codigo",
    "servico_nome",
    "valor_venda",
    "valor_custo",
    "comissao_loja",
    "status",
    "descricao",
  ];
  const linhas = [headers.join(";")];
  for (const e of eventos) {
    linhas.push(
      [
        escapeCsv(e.id),
        escapeCsv(e.criado_em),
        escapeCsv(e.cliente_nome),
        escapeCsv(e.servico_codigo),
        escapeCsv(e.servico_nome),
        escapeCsv(e.valor_venda.toFixed(2).replace(".", ",")),
        escapeCsv(e.valor_custo.toFixed(2).replace(".", ",")),
        escapeCsv(e.comissao_loja.toFixed(2).replace(".", ",")),
        escapeCsv(e.status),
        escapeCsv(e.descricao),
      ].join(";"),
    );
  }
  const csv = "﻿" + linhas.join("\r\n") + "\r\n";
  const filename = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
