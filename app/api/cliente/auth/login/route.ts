import { NextRequest, NextResponse } from "next/server";
import { consumirTokenAcesso, gerarTokenSessao, setCookieCliente } from "@/lib/cliente-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const rl = rateLimit(`sc:cliente-login:ip:${ip ?? "unknown"}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, motivo: "Muitas tentativas" }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("t") || "";
  if (!token || token.length < 10) {
    return NextResponse.redirect(new URL("/cliente?erro=token_invalido", req.url));
  }

  const r = await consumirTokenAcesso(token);
  if (!r) {
    return NextResponse.redirect(new URL("/cliente?erro=token_expirado", req.url));
  }

  const sessao = gerarTokenSessao(r.cliente_id, r.loja_id);
  await setCookieCliente(sessao);
  return NextResponse.redirect(new URL("/cliente/painel", req.url));
}
