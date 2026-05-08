// Aceita convite: cria user na loja com senha + auto-login.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { lerConvitePorToken, aceitarConvite } from "@/lib/convites";
import { gerarToken, setCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function senhaForte(s: string): { ok: boolean; motivo?: string } {
  if (s.length < 8) return { ok: false, motivo: "Mínimo 8 caracteres" };
  if (!/[A-Za-z]/.test(s)) return { ok: false, motivo: "Precisa de letras" };
  if (!/\d/.test(s)) return { ok: false, motivo: "Precisa de números" };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  // Permite preview do convite na page (sem aceitar ainda)
  const token = req.nextUrl.searchParams.get("t") || "";
  if (!token) return NextResponse.json({ ok: false, motivo: "token ausente" }, { status: 400 });
  const info = await lerConvitePorToken(token);
  if (!info) return NextResponse.json({ ok: false, motivo: "Convite inválido ou expirado" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    convite: {
      loja_nome: info.loja_nome,
      email: info.email,
      papel: info.papel,
      expira_em: info.expira_em,
    },
  });
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const rl = rateLimit(`sc:aceitar-convite:ip:${ip ?? "unknown"}`, 10, 15 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, motivo: "Muitas tentativas" }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim();
  const nome = String(b.nome || "").trim();
  const senha = String(b.senha || "");
  const telefone = String(b.telefone || "").trim() || undefined;

  if (!token || !nome) return NextResponse.json({ ok: false, motivo: "campos obrigatórios" }, { status: 400 });
  const sf = senhaForte(senha);
  if (!sf.ok) return NextResponse.json({ ok: false, motivo: sf.motivo! }, { status: 400 });

  try {
    const hash = await bcrypt.hash(senha, 12);
    const r = await aceitarConvite({ token, nome, senha_hash: hash, telefone });
    if (!r) return NextResponse.json({ ok: false, motivo: "Convite inválido ou expirado" }, { status: 404 });

    // Auto-login
    const tk = gerarToken(r.user_id, "loja_user", r.loja_id);
    await setCookie(tk);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
