// Importa todos os fornecedores do sitemap publico de guiafornecedoresic.com.br
// direto no Postgres local. NAO usa /api (nao precisa login).
//
// Uso: node db/import-guia-ic.mjs [--limit=N] [--tipo=outros]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function carregarEnv(arq) {
  try {
    const txt = readFileSync(arq, "utf8");
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

const FONTE = "guiafornecedoresic";
const BASE = "https://guiafornecedoresic.com.br";
const UA = "Mozilla/5.0 (compatible; SevenConstructionBot/1.0)";
const TIPO_PADRAO = arg("tipo", "outros"); // sem categorizacao confiavel via web — admin re-categoriza depois
const LIMIT = parseInt(arg("limit", "0") || "0", 10);
const CONCURRENCY = 4;

async function listarSitemap() {
  const r = await fetch(`${BASE}/_fornecedores-sitemap.xml`, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`sitemap ${r.status}`);
  const xml = await r.text();
  const seen = new Set();
  const itens = [];
  for (const m of xml.matchAll(/<loc>([^<]+_fornecedores\/[^<]+)<\/loc>/g)) {
    const url = m[1].trim();
    const slug = url.match(/_fornecedores\/([^/]+)\/?$/)?.[1];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    itens.push({ url, slug });
  }
  return itens;
}

function limparTitulo(t) {
  return t.replace(/\s*[|\-–—]\s*Guia Fornecedores.*$/i, "").trim();
}

function unique(a) { return [...new Set(a)]; }

const URL_EXCLUSAO = [
  /^https?:\/\/(?:[a-z0-9-]+\.)?guiafornecedoresic\.com\.br/,
  /^https?:\/\/fonts\./,
  /^https?:\/\/maps\.google/,
  /^https?:\/\/(?:web|www|m)\.facebook\.com\/(?:sharer|profile\.php)/,
  /^https?:\/\/(?:www\.)?instagram\.com\/guiafornecedores/,
  /^https?:\/\/(?:www\.)?youtube\.com\/@guiafornecedoresic/,
  /^https?:\/\/(?:www\.)?linkedin\.com\/in\/guia-de-fornecedores/,
  /^https?:\/\/twitter\.com\/(?:intent|share)/,
  /^https?:\/\/(?:wa\.me|api\.whatsapp\.com)/,
  /^https?:\/\/gmpg\.org/, /^https?:\/\/w3\.org/, /^https?:\/\/cdn-cgi/,
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)(?:\?|$)/i,
];

function formatarWa(d) {
  const x = d.replace(/\D+/g, "");
  if (x.startsWith("55") && x.length >= 12) {
    const s = x.slice(2);
    if (s.length === 11) return `+55 (${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
    if (s.length === 10) return `+55 (${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
  }
  return `+${x}`;
}

async function extrair(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const html = await r.text();
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g,"").trim();
  const nome = limparTitulo((h1 || ogTitle || url.split("/").filter(Boolean).pop() || "").trim());
  const descricao = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)?.[1] || null;
  const logo = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1] || null;
  const tels = unique([...html.matchAll(/href="tel:([^"]+)"/g)].map(m => decodeURIComponent(m[1]).trim()));
  const wa = html.match(/href="https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\?phone=?(\d+)/)?.[1]
          || html.match(/wa\.me\/(\d+)/)?.[1];
  const sites = unique(
    [...html.matchAll(/href="(https?:\/\/[^"#]+)"/g)].map(m => m[1])
      .filter(u => !URL_EXCLUSAO.some(re => re.test(u))),
  );
  const emails = unique(
    [...html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map(m => m[0].toLowerCase())
      .filter(e => !e.endsWith("@guiafornecedoresic.com.br") && !e.includes("noreply") && !e.includes("wordpress")),
  );

  const slug = url.match(/_fornecedores\/([^/]+)\/?$/)?.[1] || "";
  return {
    url, slug, nome,
    descricao,
    logo_url: logo,
    telefone: tels[0] || null,
    whatsapp: wa ? formatarWa(wa) : null,
    site: sites[0] || null,
    email: emails[0] || null,
  };
}

function extrairProdutos(desc) {
  if (!desc) return [];
  const m = desc.toLowerCase().match(/(?:oferece|fornece|fabrica|distribui|comercializa)\s+([^.]+)/i);
  if (!m) return [];
  return m[1].split(/,|\s+e\s+/i).map(s => s.trim()).filter(s => s.length >= 4 && s.length <= 40).slice(0, 8);
}

function normalizar(p) {
  return p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
          .replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL nao definido"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log(`Lendo sitemap ${BASE}/_fornecedores-sitemap.xml ...`);
const itens = await listarSitemap();
console.log(`Total no sitemap: ${itens.length}`);

// Filtra ja importados
const r = await client.query(
  `SELECT url FROM sevenconstruction.parceiros_fontes WHERE fonte = $1`, [FONTE],
);
const ja = new Set(r.rows.map(x => x.url));
const pendentes = itens.filter(i => !ja.has(i.url));
console.log(`Ja importados antes: ${ja.size} | Pendentes: ${pendentes.length}`);

const lista = LIMIT > 0 ? pendentes.slice(0, LIMIT) : pendentes;
console.log(`Vou importar: ${lista.length}\n`);

let ok = 0, falhas = 0, dup = 0;
const queue = [...lista];

async function worker(id) {
  while (queue.length) {
    const it = queue.shift();
    if (!it) break;
    try {
      const det = await extrair(it.url);
      if (!det.nome) { falhas++; console.log(`[${id}] ✗ ${it.slug} (sem_nome)`); continue; }

      await client.query("BEGIN");
      try {
        const ins = await client.query(
          `INSERT INTO sevenconstruction.parceiros
             (tipo, nome_fantasia, telefone, whatsapp, site, logo_url, email, notas, origem, origem_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, codigo`,
          [TIPO_PADRAO, det.nome, det.telefone, det.whatsapp, det.site, det.logo_url, det.email, det.descricao, FONTE, it.url],
        );
        const parceiro_id = ins.rows[0].id;
        const codigo = ins.rows[0].codigo;

        const produtos = extrairProdutos(det.descricao);
        for (const p of produtos) {
          const norm = normalizar(p);
          if (!norm) continue;
          await client.query(
            `INSERT INTO sevenconstruction.parceiros_produtos (parceiro_id, produto, produto_raw, origem)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [parceiro_id, norm, p.trim(), FONTE],
          );
        }
        await client.query(
          `INSERT INTO sevenconstruction.parceiros_fontes (parceiro_id, fonte, url, payload_json)
           VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
          [parceiro_id, FONTE, it.url, JSON.stringify(det)],
        );
        await client.query("COMMIT");
        ok++;
        if (ok % 20 === 0) console.log(`[${id}] progresso: ${ok} ok / ${falhas} falhas / ${dup} dup`);
      } catch (e) {
        await client.query("ROLLBACK");
        if (e.message?.includes("parceiros_cnpj_unico") || /unique/i.test(e.message)) {
          dup++;
        } else {
          falhas++;
          console.log(`[${id}] ✗ ${it.slug}: ${e.message}`);
        }
      }
    } catch (e) {
      falhas++;
      console.log(`[${id}] ✗ ${it.slug}: ${e.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
await client.end();

console.log(`\n=== IMPORT OK ===`);
console.log(`Importados: ${ok}`);
console.log(`Duplicados/skip: ${dup}`);
console.log(`Falhas: ${falhas}`);
console.log(`Total tentativas: ${ok + dup + falhas}`);
