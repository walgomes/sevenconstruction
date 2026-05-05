import { NextRequest, NextResponse } from "next/server";
import { loginLojaUser, gerarToken, setCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  const rlIp = rateLimit(`sc:login:ip:${ip ?? "unknown"}`, 5, 15 * 60_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { ok: false, motivo: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  let body: { email?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  const email = (body.email || "").toString();
  const senha = (body.senha || "").toString();
  if (!email || !senha) {
    return NextResponse.json({ ok: false, motivo: "Email e senha obrigatórios" }, { status: 400 });
  }

  const rlEmail = rateLimit(`sc:login:email:${email.toLowerCase()}`, 10, 60 * 60_000);
  if (!rlEmail.ok) {
    return NextResponse.json(
      { ok: false, motivo: "Muitas tentativas para este email." },
      { status: 429 },
    );
  }

  const r = await loginLojaUser(email, senha, { ip, ua });
  if (!r.ok) {
    return NextResponse.json({ ok: false, motivo: r.motivo }, { status: 401 });
  }

  const token = gerarToken(r.sessao.id, r.sessao.role, r.sessao.loja_id);
  await setCookie(token);

  return NextResponse.json({
    ok: true,
    nome: r.nome,
    loja_nome: r.loja_nome,
    role: r.sessao.role,
  });
}
