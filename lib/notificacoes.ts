// Sistema de notificacoes centralizado pro SC.
// Eventos importantes geram entrada em notificacoes; UI le via inbox.
//
// Tipos:
//   match_b2b              | Nova oferta com fit > 70 chegou (Rede B2B)
//   transacao_marketplace  | Status de transacao mudou (pendente→aceita→...)
//   indicacao_paga         | Indicacao virou compra → pts liberados
//   fatura_vencida         | Stripe devolveu invoice.payment_failed
//   parceiro_homologado    | Trust score >= 70 e fase = homologado
//   cliente_proximo_trial  | Faltam <=3 dias do trial 14d
//   sistema                | Avisos genericos da plataforma

import pool from "@/lib/db";

export interface Notificacao {
  id: number;
  loja_id: number;
  user_id: number | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  icone: string;
  prioridade: number;
  canal: string;
  lida: boolean;
  lida_em: string | null;
  metadados: Record<string, unknown>;
  criado_em: string;
}

export interface NotificarOpts {
  loja_id: number;
  user_id?: number | null;          // null = pra toda a loja
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  icone?: string;
  prioridade?: 0 | 1 | 2;
  canal?: "inbox" | "whatsapp" | "email";
  metadados?: Record<string, unknown>;
}

export async function notificar(opts: NotificarOpts): Promise<Notificacao> {
  const r = await pool.query<Notificacao>(
    `INSERT INTO sevenconstruction.notificacoes
       (loja_id, user_id, tipo, titulo, mensagem, link, icone, prioridade, canal, metadados)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     RETURNING id, loja_id, user_id, tipo, titulo, mensagem, link, icone,
              prioridade, canal, lida, lida_em::text, metadados,
              criado_em::text AS criado_em`,
    [
      opts.loja_id,
      opts.user_id ?? null,
      opts.tipo,
      opts.titulo,
      opts.mensagem,
      opts.link ?? null,
      opts.icone ?? "🔔",
      opts.prioridade ?? 1,
      opts.canal ?? "inbox",
      JSON.stringify(opts.metadados ?? {}),
    ],
  );
  return r.rows[0];
}

// Versao silenciosa pra evitar quebrar transacao caller
export async function notificarSilencioso(opts: NotificarOpts): Promise<void> {
  try { await notificar(opts); } catch { /* nao quebra fluxo principal */ }
}

export async function listar(opts: {
  loja_id: number;
  user_id?: number;
  apenas_nao_lidas?: boolean;
  tipo?: string;
  limite?: number;
}): Promise<Notificacao[]> {
  const conds: string[] = ["loja_id = $1"];
  const args: unknown[] = [opts.loja_id];
  let i = 2;

  // Mostra notif do user OU notif da loja toda (user_id IS NULL)
  if (opts.user_id != null) {
    conds.push(`(user_id = $${i++} OR user_id IS NULL)`);
    args.push(opts.user_id);
  }
  if (opts.apenas_nao_lidas) conds.push(`NOT lida`);
  if (opts.tipo) {
    conds.push(`tipo = $${i++}`);
    args.push(opts.tipo);
  }
  args.push(Math.min(Math.max(opts.limite ?? 50, 1), 200));

  const r = await pool.query<Notificacao>(
    `SELECT id, loja_id, user_id, tipo, titulo, mensagem, link, icone,
            prioridade, canal, lida, lida_em::text AS lida_em, metadados,
            criado_em::text AS criado_em
       FROM sevenconstruction.notificacoes
      WHERE ${conds.join(" AND ")}
      ORDER BY (NOT lida) DESC, prioridade DESC, criado_em DESC
      LIMIT $${i}`,
    args,
  );
  return r.rows;
}

export async function contar(opts: { loja_id: number; user_id?: number }): Promise<{
  nao_lidas: number; nao_lidas_alta: number; total: number;
}> {
  const conds: string[] = ["loja_id = $1"];
  const args: unknown[] = [opts.loja_id];
  if (opts.user_id != null) {
    conds.push(`(user_id = $2 OR user_id IS NULL)`);
    args.push(opts.user_id);
  }
  const r = await pool.query<{
    nao_lidas: number; nao_lidas_alta: number; total: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE NOT lida)::int AS nao_lidas,
       COUNT(*) FILTER (WHERE NOT lida AND prioridade = 2)::int AS nao_lidas_alta,
       COUNT(*)::int AS total
       FROM sevenconstruction.notificacoes WHERE ${conds.join(" AND ")}`,
    args,
  );
  return r.rows[0] ?? { nao_lidas: 0, nao_lidas_alta: 0, total: 0 };
}

export async function marcarLida(id: number, loja_id: number): Promise<boolean> {
  const r = await pool.query(
    `UPDATE sevenconstruction.notificacoes
        SET lida = TRUE, lida_em = NOW()
      WHERE id = $1 AND loja_id = $2 AND NOT lida`,
    [id, loja_id],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function marcarTodasLidas(loja_id: number, user_id?: number): Promise<number> {
  const conds = ["loja_id = $1", "NOT lida"];
  const args: unknown[] = [loja_id];
  if (user_id != null) {
    conds.push(`(user_id = $2 OR user_id IS NULL)`);
    args.push(user_id);
  }
  const r = await pool.query(
    `UPDATE sevenconstruction.notificacoes SET lida = TRUE, lida_em = NOW()
      WHERE ${conds.join(" AND ")}`,
    args,
  );
  return r.rowCount ?? 0;
}
