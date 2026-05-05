#!/usr/bin/env node
// Cron diário: gera 3 templates IA pra cada loja ativa.
// Uso:
//   node scripts/cron-ia-marketing.mjs
//
// Variaveis de ambiente:
//   SC_PUBLIC_URL       (default: http://localhost:8800)
//   SC_ADMIN_API_KEY    (obrigatoria)
//
// Em prod: agendar via Vercel Cron, GitHub Actions ou systemd timer.
// Idempotente: nao gera 2x no mesmo dia (verificacao em mkt_templates).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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

const baseUrl = process.env.SC_PUBLIC_URL || "http://localhost:8800";
const adminKey = process.env.SC_ADMIN_API_KEY;

if (!adminKey) {
  console.error("ERRO: SC_ADMIN_API_KEY nao configurado em .env.local");
  process.exit(1);
}

const inicio = Date.now();
console.log(`[cron-ia] ${new Date().toISOString()} - chamando ${baseUrl}/api/disparo/ia-gerar`);

try {
  const r = await fetch(`${baseUrl}/api/disparo/ia-gerar`, {
    method: "POST",
    headers: {
      "x-sc-admin-key": adminKey,
      "Content-Type": "application/json",
    },
  });
  const j = await r.json();
  const durMs = Date.now() - inicio;

  if (!r.ok || !j.ok) {
    console.error(`[cron-ia] FALHA HTTP=${r.status} motivo=${j.motivo} (${durMs}ms)`);
    process.exit(2);
  }

  console.log(
    `[cron-ia] OK lojas_processadas=${j.lojas_processadas} ` +
    `total_inseridos=${j.total_inseridos} duracao=${durMs}ms`,
  );
} catch (e) {
  console.error("[cron-ia] erro fatal:", e.message);
  process.exit(3);
}
