// Permite que um loja_user "vire super-admin" sem precisar deslogar.
// Pede a senha do super_admins associado ao mesmo email.
// Se OK, sobrescreve o cookie sc_auth com token role=super.

import { NextRequest, NextResponse } from "next/server";
import { lerSessao, loginSuperAdmin, gerarToken, setCookie } from "@/lib/auth";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  // Rate limit pra evitar brute-force a partir do painel da loja
  const rl = rateLimit(`sc:abrir-admin:ip:${ip ?? "unknown"}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, motivo: "Muitas tentativas." }, { status: 429 });
  }

  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  let body: { senha?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const senha = String(body.senha || "");
  if (!senha) return NextResponse.json({ ok: false, motivo: "Senha obrigatória" }, { status: 400 });

  // Pega email do user atual (loja_user OU super)
  let email: string | null = null;
  if (sessao.role === "loja_user") {
    const r = await pool.query<{ email: string }>(
      `SELECT email FROM sevenconstruction.loja_users WHERE id = $1`, [sessao.id],
    );
    email = r.rows[0]?.email ?? null;
  } else if (sessao.role === "super") {
    const r = await pool.query<{ email: string }>(
      `SELECT email FROM sevenconstruction.super_admins WHERE id = $1`, [sessao.id],
    );
    email = r.rows[0]?.email ?? null;
  }
  if (!email) return NextResponse.json({ ok: false, motivo: "Sessão inválida" }, { status: 401 });

  // Valida senha super
  const r = await loginSuperAdmin(email, senha, { ip, ua });
  if (!r.ok) {
    return NextResponse.json({ ok: false, motivo: "Senha admin inválida" }, { status: 401 });
  }

  const token = gerarToken(r.sessao.id, "super", null);
  await setCookie(token);
  return NextResponse.json({ ok: true });
}
