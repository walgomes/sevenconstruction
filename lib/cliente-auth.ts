// Auth do cliente final (papel loja_cliente).
// Loja gera link unico com token UUID; cliente clica → cookie sc_cliente_auth
// setado por 30 dias com HMAC. Sem senha. Cliente pode ter varios tokens
// ativos (1 por dispositivo).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import pool from "@/lib/db";

export const COOKIE_CLI = "sc_cliente_auth";
const EXPIRA_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SC_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SC_SECRET nao configurado em producao");
  }
  return "fallback-dev-secret-only-CHANGE-ME";
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export interface SessaoCliente {
  v: 1;
  cliente_id: number;
  loja_id: number;
  exp: number;
}

export function gerarTokenSessao(cliente_id: number, loja_id: number): string {
  const payload: SessaoCliente = {
    v: 1, cliente_id, loja_id, exp: Date.now() + EXPIRA_MS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function validarTokenSessao(token: string | undefined | null): SessaoCliente | null {
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

  let payload: SessaoCliente;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessaoCliente;
  } catch { return null; }

  if (!payload || payload.v !== 1 || typeof payload.cliente_id !== "number") return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return payload;
}

export async function lerSessaoCliente(): Promise<SessaoCliente | null> {
  const c = await cookies();
  return validarTokenSessao(c.get(COOKIE_CLI)?.value);
}

export async function setCookieCliente(token: string) {
  const c = await cookies();
  c.set(COOKIE_CLI, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EXPIRA_MS / 1000,
  });
}

export async function limparCookieCliente() {
  const c = await cookies();
  c.delete(COOKIE_CLI);
}

// ===== Tokens de acesso (gerados pela loja) =====

export interface TokenAcesso {
  id: number;
  cliente_id: number;
  token: string;
  expira_em: string;
  ultimo_uso_em: string | null;
  usos: number;
  ativo: boolean;
}

export async function gerarTokenAcesso(cliente_id: number, dias = 30): Promise<TokenAcesso> {
  const tk = randomBytes(24).toString("base64url");
  const exp = new Date(Date.now() + dias * 86400_000);
  const r = await pool.query<TokenAcesso>(
    `INSERT INTO sevenconstruction.cliente_acesso_token (cliente_id, token, expira_em)
     VALUES ($1, $2, $3)
     RETURNING id, cliente_id, token, expira_em::text, ultimo_uso_em::text, usos, ativo`,
    [cliente_id, tk, exp],
  );
  return r.rows[0];
}

export async function consumirTokenAcesso(token: string): Promise<{ cliente_id: number; loja_id: number } | null> {
  const r = await pool.query<{ cliente_id: number; loja_id: number; ativo: boolean; expira_em: string }>(
    `SELECT t.cliente_id, c.loja_id, t.ativo,
            t.expira_em::text AS expira_em
       FROM sevenconstruction.cliente_acesso_token t
       JOIN sevenconstruction.loja_clientes c ON c.id = t.cliente_id
      WHERE t.token = $1
      LIMIT 1`,
    [token],
  );
  const row = r.rows[0];
  if (!row || !row.ativo) return null;
  if (new Date(row.expira_em).getTime() < Date.now()) return null;

  // Marca uso (assincrono, nao bloqueia)
  pool.query(
    `UPDATE sevenconstruction.cliente_acesso_token
        SET ultimo_uso_em = NOW(), usos = usos + 1
      WHERE token = $1`,
    [token],
  ).catch(() => {});

  return { cliente_id: row.cliente_id, loja_id: row.loja_id };
}
