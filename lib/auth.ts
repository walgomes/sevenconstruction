// Auth do SevenConstruction. 3 niveis: super-admin, loja_user, loja_cliente.
// Cookie sc_auth, HMAC-SHA256, bcrypt.

import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";

export const COOKIE_SC = "sc_auth";
const EXPIRA_MS = 7 * 24 * 60 * 60 * 1000;

export type RoleSc = "super" | "loja_user" | "loja_cliente";
export type SessaoSc = {
  v: 1;
  id: number;
  role: RoleSc;
  loja_id: number | null;
  exp: number;
};

function secret(): string {
  const s = process.env.SC_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SC_SECRET nao configurado (>= 16 chars) em producao");
  }
  return "fallback-dev-secret-only-CHANGE-ME";
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function gerarToken(
  id: number,
  role: RoleSc,
  loja_id: number | null,
): string {
  const payload: SessaoSc = { v: 1, id, role, loja_id, exp: Date.now() + EXPIRA_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function validarToken(token: string | undefined | null): SessaoSc | null {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const esperado = b64url(createHmac("sha256", secret()).update(body).digest());
  let bufA: Buffer, bufB: Buffer;
  try {
    bufA = Buffer.from(sig, "base64url");
    bufB = Buffer.from(esperado, "base64url");
  } catch { return null; }
  if (bufA.length !== bufB.length) return null;
  if (!timingSafeEqual(bufA, bufB)) return null;

  let payload: SessaoSc;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessaoSc;
  } catch { return null; }

  if (!payload || payload.v !== 1 || typeof payload.id !== "number") return null;
  if (!["super", "loja_user", "loja_cliente"].includes(payload.role)) return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  if (payload.role !== "super" && typeof payload.loja_id !== "number") return null;
  return payload;
}

export async function lerSessao(): Promise<SessaoSc | null> {
  const c = await cookies();
  return validarToken(c.get(COOKIE_SC)?.value);
}

export async function exigirLojaUser(): Promise<SessaoSc> {
  const s = await lerSessao();
  if (!s) throw new Error("Não autenticado");
  if (s.role !== "loja_user") throw new Error("Apenas loja_user");
  if (!s.loja_id) throw new Error("Sem loja vinculada");
  return s;
}

export async function exigirSuper(): Promise<SessaoSc> {
  const s = await lerSessao();
  if (!s) throw new Error("Não autenticado");
  if (s.role !== "super") throw new Error("Apenas super-admin");
  return s;
}

export async function setCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_SC, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EXPIRA_MS / 1000,
  });
}

export async function limparCookie() {
  const c = await cookies();
  c.delete(COOKIE_SC);
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}
export async function checarHash(senha: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try { return await bcrypt.compare(senha, hash); } catch { return false; }
}

type ResultadoLogin =
  | { ok: true; sessao: SessaoSc; nome: string; loja_nome: string }
  | { ok: false; motivo: string };

export async function loginLojaUser(
  email: string,
  senha: string,
  meta: { ip: string | null; ua: string | null },
): Promise<ResultadoLogin> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !senha) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: null, sucesso: false, motivo: "campos_vazios" });
    return { ok: false, motivo: "Email e senha obrigatórios" };
  }

  const r = await pool.query(
    `SELECT u.id, u.loja_id, u.nome, u.senha_hash, u.ativo,
            l.ativo AS loja_ativa, l.nome_fantasia
       FROM sevenconstruction.loja_users u
       JOIN sevenconstruction.lojas l ON l.id = u.loja_id
      WHERE u.email = $1
      LIMIT 1`,
    [emailNorm],
  );
  const row = r.rows[0];
  if (!row) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: null, sucesso: false, motivo: "inexistente" });
    return { ok: false, motivo: "Credenciais inválidas" };
  }
  if (!row.ativo) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: row.loja_id, sucesso: false, motivo: "user_inativo" });
    return { ok: false, motivo: "Usuário inativo" };
  }
  if (!row.loja_ativa) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: row.loja_id, sucesso: false, motivo: "loja_inativa" });
    return { ok: false, motivo: "Loja inativa — fale com o administrador" };
  }

  const ok = await checarHash(senha, row.senha_hash);
  if (!ok) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: row.loja_id, sucesso: false, motivo: "senha_errada" });
    return { ok: false, motivo: "Credenciais inválidas" };
  }

  await pool.query(
    `UPDATE sevenconstruction.loja_users SET ultimo_login = NOW() WHERE id = $1`,
    [row.id],
  );
  await registrarTentativa({ ...meta, email: emailNorm, papel: "loja_user", loja_id: row.loja_id, sucesso: true, motivo: "ok" });

  const token = gerarToken(row.id, "loja_user", row.loja_id);
  return {
    ok: true,
    sessao: validarToken(token)!,
    nome: row.nome,
    loja_nome: row.nome_fantasia,
  };
}

async function registrarTentativa(p: {
  ip: string | null; ua: string | null; email: string; papel: string;
  loja_id: number | null; sucesso: boolean; motivo: string;
}) {
  try {
    await pool.query(
      `INSERT INTO sevenconstruction.login_tentativas
         (ip, email, papel, loja_id, sucesso, user_agent, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.ip, p.email, p.papel, p.loja_id, p.sucesso, p.ua, p.motivo],
    );
  } catch {
    // nao bloqueia login se log falhar
  }
}

export type ResultadoLoginSuper =
  | { ok: true; sessao: SessaoSc; nome: string }
  | { ok: false; motivo: string };

export async function loginSuperAdmin(
  email: string,
  senha: string,
  meta: { ip: string | null; ua: string | null },
): Promise<ResultadoLoginSuper> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !senha) {
    return { ok: false, motivo: "Email e senha obrigatórios" };
  }

  const r = await pool.query(
    `SELECT id, email, senha_hash, nome, ativo
       FROM sevenconstruction.super_admins
      WHERE email = $1 LIMIT 1`,
    [emailNorm],
  );
  const row = r.rows[0];
  if (!row) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "super", loja_id: null, sucesso: false, motivo: "inexistente" });
    return { ok: false, motivo: "Credenciais inválidas" };
  }
  if (!row.ativo) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "super", loja_id: null, sucesso: false, motivo: "inativo" });
    return { ok: false, motivo: "Usuário inativo" };
  }

  const ok = await checarHash(senha, row.senha_hash);
  if (!ok) {
    await registrarTentativa({ ...meta, email: emailNorm, papel: "super", loja_id: null, sucesso: false, motivo: "senha_errada" });
    return { ok: false, motivo: "Credenciais inválidas" };
  }

  await pool.query(
    `UPDATE sevenconstruction.super_admins SET ultimo_login = NOW() WHERE id = $1`,
    [row.id],
  );
  await registrarTentativa({ ...meta, email: emailNorm, papel: "super", loja_id: null, sucesso: true, motivo: "ok" });

  const token = gerarToken(row.id, "super", null);
  return { ok: true, sessao: validarToken(token)!, nome: row.nome };
}
