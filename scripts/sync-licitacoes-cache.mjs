#!/usr/bin/env node
// Sync diário do cache local de licitacoes.
// Estrategia: pra cada UF prioritária, busca pequeno batch do Supabase
// (filter SOMENTE uf — outros filtros estouram timeout do free tier)
// e popula sevenconstruction.licitacoes_cache em batches pequenos.
//
// Uso:
//   node scripts/sync-licitacoes-cache.mjs
//   node scripts/sync-licitacoes-cache.mjs --uf BA   (so uma UF)
//
// UFs priorizadas: BA, SP, RJ, MG, PR, RS, SC, GO, PE, CE
// (top 10 economias do Brasil; cobre maior parte das lojas).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function carregarEnv(arquivo) {
  try {
    const txt = readFileSync(arquivo, "utf8");
    for (const linha of txt.split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
carregarEnv(resolve(__dirname, "..", ".env.local"));
carregarEnv(resolve(__dirname, "..", ".env"));

const supabaseUrl = process.env.LICITACOES_SUPABASE_URL;
const supabaseKey = process.env.LICITACOES_SUPABASE_ANON_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey || !dbUrl) {
  console.error("ERRO: env vars LICITACOES_SUPABASE_*/DATABASE_URL faltam");
  process.exit(1);
}

const UFs_PRIORITARIAS = [
  "BA", "SP", "RJ", "MG", "PR", "RS", "SC", "GO", "PE", "CE",
];

const args = process.argv.slice(2);
const ufFiltro = args.includes("--uf") ? args[args.indexOf("--uf") + 1] : null;
const ufs = ufFiltro ? [ufFiltro.toUpperCase()] : UFs_PRIORITARIAS;

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pool = new pg.Pool({ connectionString: dbUrl, max: 3 });

let totalInseridos = 0;
let totalErros = 0;
const inicioGlobal = Date.now();

for (const uf of ufs) {
  console.log(`\n[sync] UF=${uf} iniciando...`);
  const t0 = Date.now();

  try {
    // Pega ate 50 com select minimal — limit pequeno pra nao timeoutar
    const { data: licits, error } = await sb
      .schema("transparencia")
      .from("licitacoes")
      .select(
        "id_licitacao, modalidade, objeto, data_abertura, valor_licitacao, nome_orgao, uf, municipio",
      )
      .eq("uf", uf)
      .limit(50);

    if (error) {
      console.error(`[sync] UF=${uf} ERRO supabase:`, error.message);
      totalErros++;
      continue;
    }

    if (!licits || licits.length === 0) {
      console.log(`[sync] UF=${uf} sem resultados`);
      continue;
    }

    // Vencedores em batch
    const ids = licits.map((l) => l.id_licitacao);
    const { data: vencedores } = await sb
      .schema("transparencia")
      .from("licitacoes_participantes")
      .select("id_licitacao, cnpj, nome, valor_proposto")
      .in("id_licitacao", ids)
      .eq("vencedor", true);

    const mapaV = new Map();
    for (const v of vencedores || []) {
      mapaV.set(v.id_licitacao, v);
    }

    // Upsert no cache local
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const l of licits) {
        const v = mapaV.get(l.id_licitacao);
        await client.query(
          `INSERT INTO sevenconstruction.licitacoes_cache
             (id_licitacao, modalidade, objeto, data_abertura, valor_licitacao,
              nome_orgao, uf, municipio, vencedor_cnpj, vencedor_nome, vencedor_valor,
              cached_em)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (id_licitacao) DO UPDATE
             SET modalidade = EXCLUDED.modalidade,
                 objeto = EXCLUDED.objeto,
                 data_abertura = EXCLUDED.data_abertura,
                 valor_licitacao = EXCLUDED.valor_licitacao,
                 nome_orgao = EXCLUDED.nome_orgao,
                 vencedor_cnpj = COALESCE(EXCLUDED.vencedor_cnpj, sevenconstruction.licitacoes_cache.vencedor_cnpj),
                 vencedor_nome = COALESCE(EXCLUDED.vencedor_nome, sevenconstruction.licitacoes_cache.vencedor_nome),
                 vencedor_valor = COALESCE(EXCLUDED.vencedor_valor, sevenconstruction.licitacoes_cache.vencedor_valor),
                 cached_em = NOW()`,
          [
            l.id_licitacao,
            l.modalidade,
            l.objeto,
            l.data_abertura,
            l.valor_licitacao,
            l.nome_orgao,
            l.uf,
            l.municipio,
            v?.cnpj || null,
            v?.nome || null,
            v?.valor_proposto || null,
          ],
        );
      }
      await client.query("COMMIT");
      totalInseridos += licits.length;
      const dur = Date.now() - t0;
      console.log(`[sync] UF=${uf} OK ${licits.length} rows em ${dur}ms`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`[sync] UF=${uf} ERRO upsert:`, e.message);
      totalErros++;
    } finally {
      client.release();
    }

    // Pausa entre UFs pra nao saturar Supabase
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error(`[sync] UF=${uf} ERRO fatal:`, e.message);
    totalErros++;
  }
}

const durTotal = Date.now() - inicioGlobal;
console.log(
  `\n[sync] CONCLUIDO em ${(durTotal / 1000).toFixed(1)}s — ` +
  `${ufs.length} UFs, ${totalInseridos} licitações cacheadas, ${totalErros} erros`,
);

await pool.end();
process.exit(totalErros > 0 ? 1 : 0);
