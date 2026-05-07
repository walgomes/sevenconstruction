import { NextRequest, NextResponse } from "next/server";
import { loginLojaUser, loginSuperAdmin, gerarToken, setCookie } from "@/lib/auth";
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

  // 1) Tenta super-admin primeiro (raro)
  const rs = await loginSuperAdmin(email, senha, { ip, ua });
  if (rs.ok) {
    const token = gerarToken(rs.sessao.id, rs.sessao.role, null);
    await setCookie(token);
    return NextResponse.json({ ok: true, nome: rs.nome, loja_nome: null, role: "super" });
  }

  // 2) Senao, fluxo normal de loja_user
  const r = await loginLojaUser(email, senha, { ip, ua });
  if (!r.ok) {
    return NextResponse.json({ ok: false, motivo: r.motivo }, { status: 401 });
  }

  const token = gerarToken(r.sessao.id, r.sessao.role, r.sessao.loja_id);
  await setCookie(token);

  // LGPD: registra aceite de termos se foi sinalizado no body
  if (body && (body as { aceite_termos?: boolean }).aceite_termos === true) {
    try {
      const pool = (await import("@/lib/db")).default;
      await pool.query(
        `INSERT INTO sevenconstruction.termo_aceite
           (loja_id, user_id, versao, ip, user_agent, contexto)
         VALUES ($1, $2, '1.0', $3, $4, 'login')`,
        [r.sessao.loja_id, r.sessao.id, ip, ua],
      );
    } catch (e) {
      // nao bloqueia login se log falhar
      console.error("[auth/login] erro registrar aceite:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    nome: r.nome,
    loja_nome: r.loja_nome,
    role: r.sessao.role,
  });
}
