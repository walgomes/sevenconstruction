#!/usr/bin/env node
// Pre-commit hook: bloqueia commit se diff contiver secrets.
// Padrões reconhecidos:
//   - .env, .env.local, .env.*.local em arquivos
//   - JWT eyJ... (Supabase anon, etc)
//   - sk_live_, sk_test_ (Stripe)
//   - sb_secret_, sb_publishable_ (Supabase nova chave)
//   - ghp_, gho_, ghs_ (GitHub tokens)
//   - AKIA[A-Z0-9]{16} (AWS Access Key)
//   - rotina: "password = '...'" inline com >=6 chars

import { execSync } from "node:child_process";

const PATTERNS = [
  // Arquivos
  { name: ".env files",          re: /^\.env(\.|$)/m,                               kind: "filename" },
  // Tokens
  { name: "JWT (eyJ...)",        re: /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\./, kind: "diff" },
  { name: "Stripe key",          re: /\bsk_(live|test)_[A-Za-z0-9]{20,}\b/,         kind: "diff" },
  { name: "Supabase secret",     re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,            kind: "diff" },
  { name: "GitHub token",        re: /\bgh[posu]_[A-Za-z0-9]{36,}\b/,               kind: "diff" },
  { name: "AWS Access Key",      re: /\bAKIA[A-Z0-9]{16}\b/,                        kind: "diff" },
  { name: "Anthropic key",       re: /\bsk-ant-[A-Za-z0-9_-]{50,}\b/,               kind: "diff" },
  // Senhas hardcoded (evita false positives em SQL constants/seed-test)
  { name: "Hardcoded password",  re: /\b(?:password|senha)\s*[:=]\s*["'][^"']{6,}["']/i, kind: "diff" },
];

function staged() {
  try {
    return execSync("git diff --cached --name-only", { encoding: "utf8" });
  } catch {
    return "";
  }
}

function diffContent() {
  try {
    return execSync("git diff --cached --no-color", { encoding: "utf8", maxBuffer: 1024 * 1024 });
  } catch {
    return "";
  }
}

const arquivos = staged().split("\n").filter(Boolean);
const conteudo = diffContent();

const violacoes = [];

for (const p of PATTERNS) {
  if (p.kind === "filename") {
    for (const arq of arquivos) {
      if (p.re.test(arq)) {
        violacoes.push(`  ✗ ${p.name}: arquivo "${arq}" não pode ser commitado`);
      }
    }
  } else {
    // Match no conteúdo, ignorando linhas de remoção (-) — só interessa o que entra
    const linhasAdd = conteudo.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    for (const linha of linhasAdd) {
      if (p.re.test(linha)) {
        // Mostra só prefixo (privacidade) — não logue a linha inteira
        const match = linha.match(p.re);
        const trecho = match ? `${match[0].slice(0, 12)}...` : "";
        violacoes.push(`  ✗ ${p.name}: ${trecho} (linha de adição)`);
        break; // 1 violação por padrão é suficiente
      }
    }
  }
}

if (violacoes.length > 0) {
  console.error("\n❌ Pre-commit BLOQUEADO — secret detectado no diff:\n");
  for (const v of violacoes) console.error(v);
  console.error(`
Como resolver:
  1. Remova o secret do código (use process.env.X)
  2. Adicione o arquivo ao .gitignore se for .env
  3. Se foi falso positivo, edite scripts/pre-commit-anti-secret.mjs
  4. Para forçar bypass (NÃO RECOMENDADO): git commit --no-verify
`);
  process.exit(1);
}
