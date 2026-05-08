// POST gera token de acesso pra um cliente. Loja cola o link gerado e
// manda pro cliente final por WhatsApp/email. Cliente clica, abre o app.

import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { gerarTokenAcesso } from "@/lib/cliente-auth";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  const b = await req.json().catch(() => ({}));
  const cliente_id = Number(b.cliente_id);
  const dias = Math.min(Math.max(Number(b.dias) || 30, 1), 90);
  if (!Number.isFinite(cliente_id)) return NextResponse.json({ ok: false }, { status: 400 });

  // Verifica que o cliente pertence à loja do usuario
  const c = await pool.query(
    `SELECT id FROM sevenconstruction.loja_clientes WHERE id = $1 AND loja_id = $2`,
    [cliente_id, sessao.loja_id],
  );
  if (!c.rows[0]) return NextResponse.json({ ok: false, motivo: "cliente nao encontrado" }, { status: 404 });

  const t = await gerarTokenAcesso(cliente_id, dias);
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:8800";
  const link = `${proto}://${host}/api/cliente/auth/login?t=${encodeURIComponent(t.token)}`;
  return NextResponse.json({ ok: true, link, expira_em: t.expira_em });
}
