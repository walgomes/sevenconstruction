// Wrapper que combina autenticacao + rate limit baseline para APIs.
// Use ao inves de chamar lerSessao() solto em cada handler.

import { NextRequest, NextResponse } from "next/server";
import { lerSessao, type SessaoSc } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export type Sessao = SessaoSc & { loja_id: number };

/**
 * Garante que existe sessao loja_user com loja_id, e aplica rate limit
 * por loja_id (default 60 req/min). Retorna sessao ou NextResponse de erro.
 *
 * Uso:
 *   const sessao = await exigirLojaUser(req);
 *   if (sessao instanceof NextResponse) return sessao;
 *   // sessao.loja_id, sessao.id disponiveis
 */
export async function exigirLojaUser(
  req: NextRequest,
  opcoes: { rate_limite?: number; rate_janela_ms?: number; rate_chave?: string } = {},
): Promise<Sessao | NextResponse> {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json(
      { ok: false, motivo: "Não autenticado" },
      { status: 401 },
    );
  }

  // Rate limit baseline anti-flood: 60 req/min por loja_id
  const limite = opcoes.rate_limite ?? 60;
  const janela = opcoes.rate_janela_ms ?? 60_000;
  const chave =
    opcoes.rate_chave ??
    `sc:api:loja:${sessao.loja_id}:${req.nextUrl.pathname.split("?")[0]}`;
  const rl = rateLimit(chave, limite, janela);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, motivo: "Muitas requisições. Aguarde alguns segundos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetEmMs / 1000)),
          "X-RateLimit-Limit": String(limite),
          "X-RateLimit-Remaining": String(rl.restantes),
        },
      },
    );
  }

  return { ...sessao, loja_id: sessao.loja_id };
}
