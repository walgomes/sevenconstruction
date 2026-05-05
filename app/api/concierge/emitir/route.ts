// Emite uma certidao (mock provider — em prod plugaria emissor real).
// Registra automaticamente:
//   - comissao_evento (margem da loja)
//   - opcionalmente indicacao_evento se houver codigo

import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { registrarVendaServico } from "@/lib/comissoes";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const SERVICOS_VALIDOS = [
  "CRT_FED", "CRT_EST", "CRT_TRB", "CRT_FAL", "CRT_DIG",
];

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 60 });
  if (sessao instanceof NextResponse) return sessao;

  let body: {
    cliente_id?: number;
    cnpj?: string;
    servico_codigo?: string;
    codigo_indicacao?: string;
    observacoes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const codigo = (body.servico_codigo || "").toUpperCase();
  if (!SERVICOS_VALIDOS.includes(codigo)) {
    return NextResponse.json(
      { ok: false, motivo: `Serviço inválido — use: ${SERVICOS_VALIDOS.join(", ")}` },
      { status: 400 },
    );
  }

  // Acha servico_id
  const r = await pool.query(
    `SELECT id, nome FROM sevenconstruction.servicos_catalogo WHERE codigo = $1 LIMIT 1`,
    [codigo],
  );
  const servico = r.rows[0];
  if (!servico) {
    return NextResponse.json({ ok: false, motivo: "Serviço não cadastrado no catálogo" }, { status: 404 });
  }

  // Mock provider: simula emissão (em produção: chama API certidoras reais)
  const mockProtocolo = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const mockUrl = `https://mock.certidoras.local/${codigo}/${mockProtocolo}.pdf`;

  // Registra venda no ledger
  try {
    const evento_id = await registrarVendaServico({
      loja_id: sessao.loja_id,
      cliente_id: body.cliente_id ?? null,
      servico_id: servico.id,
      descricao: `Concierge: ${servico.nome}${body.cnpj ? ` (CNPJ ${body.cnpj})` : ""}`,
      codigo_indicacao: body.codigo_indicacao,
      criado_por: sessao.id,
      metadados: {
        protocolo: mockProtocolo,
        provider: "mock",
        url_pdf: mockUrl,
        cnpj_consultado: body.cnpj,
        observacoes: body.observacoes,
      },
    });

    return NextResponse.json({
      ok: true,
      evento_id,
      protocolo: mockProtocolo,
      url_pdf: mockUrl,
      provider: "mock",
      mensagem: "Certidão emitida (mock). Em produção, plugar API da emissora real.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[concierge/emitir] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao registrar emissão" }, { status: 500 });
  }
}
