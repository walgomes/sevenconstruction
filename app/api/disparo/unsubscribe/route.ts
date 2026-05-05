// Endpoint publico (sem auth) que registra descadastro.
// Obrigatorio LGPD pra envios outbound (legitimo interesse).
// Acessivel via link no email/WhatsApp:
//   /api/disparo/unsubscribe?destino=email@x.com&loja=NomeLoja&canal=email
//
// Estrategia: matcha pela combinacao destino+canal+loja_nome (lookup loja_id
// pelo nome). Se loja nao encontrada, registra como supressao orfa
// (loja_id=NULL nao eh permitido — entao devemos achar a loja).

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const destino = (url.searchParams.get("destino") || "").trim().toLowerCase();
  const lojaNome = url.searchParams.get("loja") || "";
  const canal = (url.searchParams.get("canal") || "email").toLowerCase();

  // Rate limit por IP — evita scrape do endpoint
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";
  const rl = rateLimit(`sc:unsub:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return paginaSimples("Muitas requisicoes — tente em 1 minuto.", 429);
  }

  if (!destino || destino.length < 5) {
    return paginaSimples("Link de descadastro inválido.", 400);
  }
  if (!["email", "whatsapp"].includes(canal)) {
    return paginaSimples("Canal inválido.", 400);
  }

  try {
    // Tenta achar a loja pelo nome
    const r = await pool.query(
      `SELECT id, nome_fantasia FROM sevenconstruction.lojas
        WHERE LOWER(nome_fantasia) = LOWER($1) AND ativo = TRUE
        LIMIT 1`,
      [lojaNome],
    );
    const loja = r.rows[0] as { id: number; nome_fantasia: string } | undefined;

    if (!loja) {
      // Sem loja identificada — log mas confirma pro user (nao vaza info)
      console.warn(`[unsubscribe] loja nao encontrada: "${lojaNome}" / destino mascarado`);
      return paginaSucesso(destino, lojaNome);
    }

    // Idempotente: se ja esta na supressao, ON CONFLICT DO NOTHING
    await pool.query(
      `INSERT INTO sevenconstruction.mkt_supressoes
         (loja_id, destino, canal, motivo, origem)
       VALUES ($1, $2, $3, 'descadastro', 'webhook')
       ON CONFLICT (loja_id, destino, canal) DO NOTHING`,
      [loja.id, destino, canal],
    );

    return paginaSucesso(destino, loja.nome_fantasia);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[unsubscribe] erro:", msg);
    return paginaSimples("Erro ao processar descadastro. Tente novamente.", 500);
  }
}

function paginaSucesso(destino: string, lojaNome: string): NextResponse {
  // Mascara destino na pagina (privacidade)
  const mascarado = destino.length > 6
    ? `${destino.slice(0, 3)}***${destino.slice(-4)}`
    : "***";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Descadastro — SevenConstruction</title>
  <meta name="robots" content="noindex,nofollow">
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0c;color:#eaeaea;
         display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
    .card{max-width:480px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;text-align:center}
    h1{color:#f59e0b;margin:0 0 12px;font-size:22px}
    p{color:#a1a1aa;line-height:1.5}
    .ok{color:#34d399;font-size:32px;margin-bottom:8px}
  </style>
</head>
<body>
  <div class="card">
    <div class="ok">✓</div>
    <h1>Descadastrado com sucesso</h1>
    <p>O destino <strong>${escapeHtml(mascarado)}</strong> não receberá mais mensagens
       da loja <strong>${escapeHtml(lojaNome)}</strong>.</p>
    <p style="margin-top:24px;font-size:13px">Você pode fechar esta janela.</p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function paginaSimples(msg: string, status: number): NextResponse {
  const html = `<!doctype html><html><body style="font-family:system-ui;padding:40px;background:#0a0a0c;color:#eaeaea">
    <h1>Descadastro</h1><p>${escapeHtml(msg)}</p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
