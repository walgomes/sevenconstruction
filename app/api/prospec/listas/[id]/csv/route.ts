import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { lerListaComItens } from "@/lib/prospec";

export const runtime = "nodejs";

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatCnpj(cnpj: string) {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const lista_id = parseInt(id, 10);
  if (!Number.isFinite(lista_id)) {
    return NextResponse.json({ ok: false, motivo: "ID inválido" }, { status: 400 });
  }

  const dados = await lerListaComItens(lista_id, sessao.loja_id);
  if (!dados) {
    return NextResponse.json({ ok: false, motivo: "Lista não encontrada" }, { status: 404 });
  }

  const headers = [
    "cnpj_formatado",
    "cnpj",
    "razao_social",
    "nome_fantasia",
    "cnae",
    "porte",
    "cidade",
    "uf",
    "bairro",
    "capital_social",
    "data_abertura",
    "telefone",
    "email",
  ];

  const linhas = [headers.join(";")];
  for (const e of dados.itens) {
    const row = [
      escapeCsv(formatCnpj(e.cnpj)),
      escapeCsv(e.cnpj),
      escapeCsv(e.razao_social),
      escapeCsv(e.nome_fantasia),
      escapeCsv(e.cnae),
      escapeCsv(e.porte),
      escapeCsv(e.cidade),
      escapeCsv(e.uf),
      escapeCsv(e.bairro),
      escapeCsv(e.capital_social),
      escapeCsv(e.data_abertura),
      escapeCsv(e.telefone),
      escapeCsv(e.email),
    ];
    linhas.push(row.join(";"));
  }

  // BOM UTF-8 pra Excel abrir com acentos corretos
  const csv = "﻿" + linhas.join("\r\n") + "\r\n";
  const slug = dados.lista.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "lista";
  const filename = `prospec-${slug}-${lista_id}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
