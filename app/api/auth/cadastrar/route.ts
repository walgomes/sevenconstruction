// Onboarding self-service: cria loja + dono + assinatura trial em 1 transacao.
// Trigger SQL trg_loja_inicia_trial cria a assinatura trialing 14d.
// Auto-login: gera token e seta cookie ja na resposta.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { gerarToken, setCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import pool from "@/lib/db";
import { enviarEmail, tplBoasVindas } from "@/lib/email";

export const runtime = "nodejs";

interface CadastroIn {
  // Loja
  nome_fantasia?: string;
  razao_social?: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  // Dono
  nome_dono?: string;
  email?: string;
  senha?: string;
  telefone?: string;
  // LGPD
  aceite_termos?: boolean;
}

function senhaForte(s: string): { ok: boolean; motivo?: string } {
  if (s.length < 8) return { ok: false, motivo: "Senha mínimo 8 caracteres" };
  if (!/[A-Za-z]/.test(s)) return { ok: false, motivo: "Senha precisa de letras" };
  if (!/\d/.test(s)) return { ok: false, motivo: "Senha precisa de números" };
  return { ok: true };
}

function emailValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  const rl = rateLimit(`sc:cadastrar:ip:${ip ?? "unknown"}`, 10, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, motivo: "Muitas tentativas. Tente em 1h." }, { status: 429 });
  }

  let body: CadastroIn;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 }); }

  // Validacoes obrigatorias
  const nomeFantasia = (body.nome_fantasia || "").trim();
  const cidade = (body.cidade || "").trim();
  const uf = (body.uf || "").trim().toUpperCase().slice(0, 2);
  const nomeDono = (body.nome_dono || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const senha = body.senha || "";
  const telefone = (body.telefone || "").trim() || null;
  const cnpj = (body.cnpj || "").replace(/\D+/g, "") || null;

  if (!nomeFantasia) return NextResponse.json({ ok: false, motivo: "nome_fantasia obrigatório" }, { status: 400 });
  if (!cidade) return NextResponse.json({ ok: false, motivo: "cidade obrigatória" }, { status: 400 });
  if (!uf || uf.length !== 2) return NextResponse.json({ ok: false, motivo: "UF inválida" }, { status: 400 });
  if (!nomeDono) return NextResponse.json({ ok: false, motivo: "nome_dono obrigatório" }, { status: 400 });
  if (!emailValido(email)) return NextResponse.json({ ok: false, motivo: "email inválido" }, { status: 400 });
  if (cnpj && cnpj.length !== 14) return NextResponse.json({ ok: false, motivo: "CNPJ deve ter 14 dígitos" }, { status: 400 });
  if (!body.aceite_termos) return NextResponse.json({ ok: false, motivo: "Aceite dos termos obrigatório" }, { status: 400 });

  const sf = senhaForte(senha);
  if (!sf.ok) return NextResponse.json({ ok: false, motivo: sf.motivo! }, { status: 400 });

  // Verifica se email ja existe em qualquer loja_user
  const ja = await pool.query(
    `SELECT 1 FROM sevenconstruction.loja_users WHERE LOWER(email) = $1 LIMIT 1`,
    [email],
  );
  if (ja.rows[0]) {
    return NextResponse.json(
      { ok: false, motivo: "Email já cadastrado. Use a página de login." },
      { status: 409 },
    );
  }

  // Verifica CNPJ duplicado se fornecido
  if (cnpj) {
    const dup = await pool.query(`SELECT 1 FROM sevenconstruction.lojas WHERE cnpj = $1 LIMIT 1`, [cnpj]);
    if (dup.rows[0]) {
      return NextResponse.json(
        { ok: false, motivo: "Já existe loja cadastrada com este CNPJ." },
        { status: 409 },
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Cria a loja (trigger trg_loja_inicia_trial cria assinatura trialing 14d)
    const lojaR = await client.query<{ id: number }>(
      `INSERT INTO sevenconstruction.lojas
         (nome_fantasia, razao_social, cnpj, email_contato, telefone, cidade, uf, plano, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'starter', TRUE)
       RETURNING id`,
      [
        nomeFantasia,
        body.razao_social?.trim() || null,
        cnpj,
        email,                                    // email_contato = email do dono
        telefone,
        cidade,
        uf,
      ],
    );
    const lojaId = lojaR.rows[0].id;

    // 2) Cria o dono
    const hash = await bcrypt.hash(senha, 12);
    const userR = await client.query<{ id: number }>(
      `INSERT INTO sevenconstruction.loja_users
         (loja_id, email, senha_hash, nome, papel, telefone, ativo)
       VALUES ($1, $2, $3, $4, 'dono', $5, TRUE)
       RETURNING id`,
      [lojaId, email, hash, nomeDono, telefone],
    );
    const userId = userR.rows[0].id;

    // 3) Registra aceite LGPD
    await client.query(
      `INSERT INTO sevenconstruction.termo_aceite
         (loja_id, user_id, versao, ip, user_agent, contexto)
       VALUES ($1, $2, '1.0', $3, $4, 'cadastro')`,
      [lojaId, userId, ip, ua],
    );

    await client.query("COMMIT");

    // 4) Auto-login
    const token = gerarToken(userId, "loja_user", lojaId);
    await setCookie(token);

    // 5) Email de boas-vindas (best-effort — nao bloqueia cadastro)
    const tpl = tplBoasVindas({ nome: nomeDono, nome_loja: nomeFantasia, trial_dias: 14 });
    enviarEmail({ para: email, assunto: tpl.assunto, html: tpl.html, text: tpl.text }).catch(() => {});

    return NextResponse.json({
      ok: true,
      loja_id: lojaId,
      user_id: userId,
      nome_loja: nomeFantasia,
      mensagem: `Bem-vindo, ${nomeDono}! Você tem 14 dias de trial grátis.`,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
