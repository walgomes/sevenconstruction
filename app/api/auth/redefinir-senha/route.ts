// Recebe token + nova senha. Marca token como usado (1-uso).

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function senhaForte(s: string): { ok: boolean; motivo?: string } {
  if (s.length < 8) return { ok: false, motivo: "Mínimo 8 caracteres" };
  if (!/[A-Za-z]/.test(s)) return { ok: false, motivo: "Precisa de letras" };
  if (!/\d/.test(s)) return { ok: false, motivo: "Precisa de números" };
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const rl = rateLimit(`sc:redefinir:ip:${ip ?? "unknown"}`, 10, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, motivo: "Muitas tentativas" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const senha = String(body.senha || "");
  if (!token) return NextResponse.json({ ok: false, motivo: "Token inválido" }, { status: 400 });

  const sf = senhaForte(senha);
  if (!sf.ok) return NextResponse.json({ ok: false, motivo: sf.motivo! }, { status: 400 });

  const r = await pool.query<{ id: number; user_id: number; expira_em: string; usado_em: string | null; ativo: boolean }>(
    `SELECT id, user_id, expira_em::text AS expira_em, usado_em::text, ativo
       FROM sevenconstruction.senha_reset_tokens WHERE token = $1`,
    [token],
  );
  const row = r.rows[0];
  if (!row) return NextResponse.json({ ok: false, motivo: "Token inválido" }, { status: 400 });
  if (!row.ativo) return NextResponse.json({ ok: false, motivo: "Token desativado" }, { status: 400 });
  if (row.usado_em) return NextResponse.json({ ok: false, motivo: "Token já usado" }, { status: 400 });
  if (new Date(row.expira_em).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, motivo: "Token expirado" }, { status: 400 });
  }

  const hash = await bcrypt.hash(senha, 12);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE sevenconstruction.loja_users SET senha_hash = $1 WHERE id = $2`,
      [hash, row.user_id],
    );
    await client.query(
      `UPDATE sevenconstruction.senha_reset_tokens
          SET usado_em = NOW(), ativo = FALSE
        WHERE id = $1`,
      [row.id],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, mensagem: "Senha alterada. Faça login com a nova senha." });
}
