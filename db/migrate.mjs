// Aplica db/schema*.sql no Postgres do SevenConstruction.
// Uso: node db/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL nao definido. Confira .env.local");
  process.exit(1);
}

const arquivos = readdirSync(__dirname)
  .filter((f) => /^schema(?:[-.].*)?\.sql$/i.test(f))
  .sort((a, b) => (a === "schema.sql" ? -1 : b === "schema.sql" ? 1 : a.localeCompare(b)));

const client = new pg.Client({ connectionString: url });
console.log("Conectando em", url.replace(/:[^:@]+@/, ":****@"));
await client.connect();
for (const arq of arquivos) {
  const sql = readFileSync(resolve(__dirname, arq), "utf8");
  console.log(`Rodando ${arq}...`);
  await client.query(sql);
}
console.log("OK — schema aplicado.");
await client.end();
