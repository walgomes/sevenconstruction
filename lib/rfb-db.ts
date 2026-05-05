import { Pool } from "pg";

// Pool dedicado para LEITURA da base RFB do consultTudo (sevendb).
// Conecta com role `sc_reader` que so tem GRANT SELECT em public.empresas.
// Defesa em profundidade: rfbQuery() rejeita qualquer SQL que nao comece
// com SELECT / WITH — mesmo o role ja sendo read-only.

const url = process.env.CONSULTTUDO_DATABASE_URL || "";

if (!url) {
  // Nao quebra o boot; so reclama em runtime quando alguem chamar rfbQuery
  console.warn(
    "[rfb-db] CONSULTTUDO_DATABASE_URL nao definido — busca de prospec vai falhar.",
  );
}

const precisaSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/i.test(url) ||
  /\b(supabase|neon|railway|render|aws|amazonaws|gcp|azure)\b/i.test(url);

const rfbPool = url
  ? new Pool({
      connectionString: url,
      ssl: precisaSsl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

const SQL_LEITURA = /^\s*(SELECT|WITH)\b/i;

export async function rfbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!rfbPool) {
    throw new Error("CONSULTTUDO_DATABASE_URL nao configurado");
  }
  if (!SQL_LEITURA.test(sql)) {
    throw new Error("rfbQuery aceita apenas SELECT/WITH (read-only)");
  }
  const r = await rfbPool.query(sql, params);
  return r.rows as T[];
}

export default rfbPool;
