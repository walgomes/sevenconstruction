// Solicita reset de senha. Sempre retorna 200 (mesmo se email nao existe)
// pra evitar enumeracao de usuarios. Email com link de 1h (token UUID).

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import pool from "@/lib/db";
import { enviarEmail, tplResetSenha } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const VALIDADE_MIN = 60;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  // Rate limit: 10/h por IP, 3/h por email (verificado depois)
  const rlIp = rateLimit(`sc:reset:ip:${ip ?? "unknown"}`, 10, 60 * 60_000);
  if (!rlIp.ok) {
    return NextResponse.json({ ok: true, mensagem: "Se este email estiver cadastrado, você receberá um link em alguns minutos." });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, motivo: "Email inválido" }, { status: 400 });
  }

  const rlEmail = rateLimit(`sc:reset:email:${email}`, 3, 60 * 60_000);
  if (!rlEmail.ok) {
    // Mesma resposta 200 silenciosa
    return NextResponse.json({ ok: true, mensagem: "Se este email estiver cadastrado, você receberá um link em alguns minutos." });
  }

  // Busca user — case-insensitive
  const r = await pool.query<{ id: number; nome: string; email: string }>(
    `SELECT id, nome, email FROM sevenconstruction.loja_users
      WHERE LOWER(email) = $1 AND ativo LIMIT 1`,
    [email],
  );
  const user = r.rows[0];
  if (!user) {
    // Resposta neutra pra nao vazar info
    return NextResponse.json({ ok: true, mensagem: "Se este email estiver cadastrado, você receberá um link em alguns minutos." });
  }

  // Desativa tokens antigos
  await pool.query(
    `UPDATE sevenconstruction.senha_reset_tokens SET ativo = FALSE
      WHERE user_id = $1 AND ativo`,
    [user.id],
  );

  // Gera novo token
  const tk = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + VALIDADE_MIN * 60_000);
  await pool.query(
    `INSERT INTO sevenconstruction.senha_reset_tokens
       (user_id, token, expira_em, ip_solicit, ua_solicit)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tk, expira, ip, ua],
  );

  // Envia email
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:8800";
  const link = `${proto}://${host}/redefinir-senha?t=${encodeURIComponent(tk)}`;
  const tpl = tplResetSenha({ nome: user.nome, link, expira_min: VALIDADE_MIN });
  await enviarEmail({ para: user.email, assunto: tpl.assunto, html: tpl.html, text: tpl.text });
  // Mesmo se Resend falhar, retorna 200 — admin ve nos logs

  return NextResponse.json({ ok: true, mensagem: "Se este email estiver cadastrado, você receberá um link em alguns minutos." });
}
