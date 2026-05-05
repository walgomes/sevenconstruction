import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarEmpresasRfb, type FiltroBusca } from "@/lib/prospec";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  // 30 buscas/min por loja é mais que suficiente; protege RFB de abuso
  const rl = rateLimit(`sc:prospec:loja:${sessao.loja_id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, motivo: "Muitas buscas. Aguarde 1 minuto." },
      { status: 429 },
    );
  }

  let body: Partial<FiltroBusca>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  // Sanitização: aceita só campos conhecidos
  const filtro: FiltroBusca = {
    uf: typeof body.uf === "string" ? body.uf.slice(0, 2).toUpperCase() : undefined,
    municipio: typeof body.municipio === "string" ? body.municipio.slice(0, 100) : undefined,
    nome: typeof body.nome === "string" ? body.nome.slice(0, 200) : undefined,
    cnpj: typeof body.cnpj === "string" ? body.cnpj.slice(0, 20) : undefined,
    cnaes_alvo: Array.isArray(body.cnaes_alvo)
      ? body.cnaes_alvo
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.replace(/[^0-9]/g, "").slice(0, 7))
          .filter(Boolean)
      : undefined,
    apenas_ativas: body.apenas_ativas !== false,
    porte_min: typeof body.porte_min === "number" ? body.porte_min : undefined,
    porte_max: typeof body.porte_max === "number" ? body.porte_max : undefined,
    limite: typeof body.limite === "number" ? body.limite : 200,
  };

  // Exige ao menos um filtro pra evitar full table scan em 70M linhas
  if (!filtro.uf && !filtro.municipio && !filtro.nome && !filtro.cnpj && !filtro.cnaes_alvo?.length) {
    return NextResponse.json(
      { ok: false, motivo: "Informe ao menos um filtro (UF, município, nome, CNPJ ou CNAE)" },
      { status: 400 },
    );
  }

  try {
    const empresas = await buscarEmpresasRfb(filtro);
    return NextResponse.json({ ok: true, total: empresas.length, empresas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[prospec/buscar] erro:", msg);
    if (/canceling statement|statement timeout/i.test(msg)) {
      return NextResponse.json(
        {
          ok: false,
          motivo:
            "Banco RFB lento agora (sync RFB rodando ao fundo). Tente novamente em ~5 segundos com filtros mais específicos.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, motivo: "Falha na busca RFB" },
      { status: 500 },
    );
  }
}
