// Convites de usuario pra loja. Token UUID 7 dias, 1-uso.
// Permissoes: dono+gerente convidam; vendedor nao. Apenas dono pode
// convidar com papel=dono ou gerente; gerente so cria vendedor.

import { randomBytes } from "node:crypto";
import pool from "@/lib/db";

export const VALIDADE_DIAS = 7;
export type Papel = "dono" | "gerente" | "vendedor";

export interface Convite {
  id: number;
  loja_id: number;
  email: string;
  papel: string;
  token: string;
  criado_por: number;
  expira_em: string;
  status: string;
  aceito_user_id: number | null;
  aceito_em: string | null;
  criado_em: string;
}

export async function criarConvite(opts: {
  loja_id: number;
  email: string;
  papel: Papel;
  criado_por: number;
}): Promise<Convite> {
  const email = opts.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Email inválido");

  // Verifica se ja eh user dessa loja
  const ja = await pool.query(
    `SELECT 1 FROM sevenconstruction.loja_users
      WHERE loja_id = $1 AND LOWER(email) = $2 AND ativo LIMIT 1`,
    [opts.loja_id, email],
  );
  if (ja.rows[0]) throw new Error("Esta pessoa já tem acesso à loja");

  // Verifica convite pendente do mesmo email
  const pend = await pool.query(
    `SELECT 1 FROM sevenconstruction.loja_user_convites
      WHERE loja_id = $1 AND LOWER(email) = $2 AND status = 'pendente' LIMIT 1`,
    [opts.loja_id, email],
  );
  if (pend.rows[0]) throw new Error("Já existe convite pendente para este email");

  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + VALIDADE_DIAS * 86400_000);
  const r = await pool.query<Convite>(
    `INSERT INTO sevenconstruction.loja_user_convites
       (loja_id, email, papel, token, criado_por, expira_em)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, loja_id, email, papel, token, criado_por,
              expira_em::text, status, aceito_user_id, aceito_em::text,
              criado_em::text`,
    [opts.loja_id, email, opts.papel, token, opts.criado_por, expira],
  );
  return r.rows[0];
}

export async function listarConvites(loja_id: number, apenas_pendentes = true): Promise<Convite[]> {
  const conds = ["loja_id = $1"];
  if (apenas_pendentes) conds.push("status = 'pendente'");
  const r = await pool.query<Convite>(
    `SELECT id, loja_id, email, papel, token, criado_por,
            expira_em::text, status, aceito_user_id, aceito_em::text,
            criado_em::text
       FROM sevenconstruction.loja_user_convites
      WHERE ${conds.join(" AND ")}
      ORDER BY criado_em DESC LIMIT 100`,
    [loja_id],
  );
  return r.rows;
}

export async function revogarConvite(id: number, loja_id: number): Promise<boolean> {
  const r = await pool.query(
    `UPDATE sevenconstruction.loja_user_convites
        SET status = 'revogado', revogado_em = NOW()
      WHERE id = $1 AND loja_id = $2 AND status = 'pendente'`,
    [id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}

export interface ConviteInfo {
  loja_id: number;
  loja_nome: string;
  email: string;
  papel: string;
  expira_em: string;
  conviteId: number;
}

export async function lerConvitePorToken(token: string): Promise<ConviteInfo | null> {
  const r = await pool.query<{
    id: number; loja_id: number; loja_nome: string; email: string;
    papel: string; expira_em: string; status: string;
  }>(
    `SELECT c.id, c.loja_id, l.nome_fantasia AS loja_nome, c.email, c.papel,
            c.expira_em::text, c.status
       FROM sevenconstruction.loja_user_convites c
       JOIN sevenconstruction.lojas l ON l.id = c.loja_id
      WHERE c.token = $1 LIMIT 1`,
    [token],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.status !== "pendente") return null;
  if (new Date(row.expira_em).getTime() < Date.now()) return null;
  return {
    loja_id: row.loja_id, loja_nome: row.loja_nome, email: row.email,
    papel: row.papel, expira_em: row.expira_em, conviteId: row.id,
  };
}

export async function aceitarConvite(opts: {
  token: string;
  nome: string;
  senha_hash: string;
  telefone?: string;
}): Promise<{ user_id: number; loja_id: number } | null> {
  const info = await lerConvitePorToken(opts.token);
  if (!info) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verifica se email ainda nao virou user (race condition)
    const ja = await client.query(
      `SELECT id FROM sevenconstruction.loja_users
        WHERE loja_id = $1 AND LOWER(email) = $2 LIMIT 1`,
      [info.loja_id, info.email.toLowerCase()],
    );
    if (ja.rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("Email já vinculado à loja");
    }

    const u = await client.query<{ id: number }>(
      `INSERT INTO sevenconstruction.loja_users
         (loja_id, email, senha_hash, nome, papel, telefone, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       RETURNING id`,
      [info.loja_id, info.email, opts.senha_hash, opts.nome.trim(), info.papel, opts.telefone ?? null],
    );

    await client.query(
      `UPDATE sevenconstruction.loja_user_convites
          SET status = 'aceito', aceito_user_id = $1, aceito_em = NOW()
        WHERE id = $2`,
      [u.rows[0].id, info.conviteId],
    );

    await client.query("COMMIT");
    return { user_id: u.rows[0].id, loja_id: info.loja_id };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listarUsuariosLoja(loja_id: number) {
  const r = await pool.query(
    `SELECT id, email, nome, papel, telefone, ativo, criado_em::text, ultimo_login::text
       FROM sevenconstruction.loja_users
      WHERE loja_id = $1
      ORDER BY (papel = 'dono') DESC, (papel = 'gerente') DESC, nome ASC`,
    [loja_id],
  );
  return r.rows;
}

export async function alternarAtivoUsuario(id: number, loja_id: number): Promise<boolean> {
  // Nao permite desativar o ultimo dono ativo
  const dono = await pool.query<{ ativos: number; este_eh_dono: boolean }>(
    `SELECT
       (SELECT COUNT(*)::int FROM sevenconstruction.loja_users
         WHERE loja_id = $1 AND papel = 'dono' AND ativo) AS ativos,
       (SELECT papel = 'dono' FROM sevenconstruction.loja_users WHERE id = $2 AND loja_id = $1) AS este_eh_dono`,
    [loja_id, id],
  );
  if (dono.rows[0]?.este_eh_dono && dono.rows[0]?.ativos <= 1) {
    throw new Error("Não pode desativar o último dono da loja");
  }
  const r = await pool.query(
    `UPDATE sevenconstruction.loja_users
        SET ativo = NOT ativo
      WHERE id = $1 AND loja_id = $2`,
    [id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}
