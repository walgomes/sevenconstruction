// Cria/atualiza super-admin pra acessar /admin/*.
// Uso: node db/seed-super-admin.mjs
//   ou node db/seed-super-admin.mjs --email=foo@bar.com --senha=xyz
//
// Defaults: email=walbericogomes@gmail.com, senha=gerada aleatoria (16 chars).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

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

function arg(k, def) {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : def;
}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL nao definido"); process.exit(1); }

const email = (arg("email", "walbericogomes@gmail.com") || "").toLowerCase();
const nome = arg("nome", "Walberico Gomes (super)");
const senha = arg("senha") || randomBytes(12).toString("base64url").slice(0, 16);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const hash = await bcrypt.hash(senha, 12);
  const r = await client.query(
    `INSERT INTO sevenconstruction.super_admins (email, senha_hash, nome)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, nome = EXCLUDED.nome
     RETURNING id, email`,
    [email, hash, nome],
  );
  console.log("\n=== SUPER-ADMIN OK ===");
  console.log(`id:    ${r.rows[0].id}`);
  console.log(`email: ${r.rows[0].email}`);
  console.log(`senha: ${senha}`);
  console.log(`Acesse http://localhost:8800/login (sera redirecionado pra /admin)`);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
