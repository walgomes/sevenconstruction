// Scraper de https://guiafornecedoresic.com.br
//
// Estrategia: o site tem sitemap publico em /_fornecedores-sitemap.xml com
// ~362 URLs. Usar isso como indice eh ordens de magnitude mais robusto do
// que paginar via Jet Engine AJAX (que precisa de nonce).
//
// Pra cada detalhe, extraimos via OpenGraph + tel:/wa.me/ links.
// Endereco e CNPJ NAO ficam expostos no HTML — admin completa manual.

const FONTE = "guiafornecedoresic";
const BASE = "https://guiafornecedoresic.com.br";
const UA = "Mozilla/5.0 (compatible; SevenConstructionBot/1.0)";

export type SitemapItem = {
  url: string;
  slug: string;
};

export async function listarSitemap(): Promise<SitemapItem[]> {
  const r = await fetch(`${BASE}/_fornecedores-sitemap.xml`, {
    headers: { "user-agent": UA },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`sitemap status ${r.status}`);
  const xml = await r.text();
  const urls: SitemapItem[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<loc>([^<]+_fornecedores\/[^<]+)<\/loc>/g)) {
    const url = m[1].trim();
    const slug = url.match(/_fornecedores\/([^/]+)\/?$/)?.[1];
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    urls.push({ url, slug });
  }
  return urls;
}

export type DetalheGuia = {
  url: string;
  slug: string;
  nome: string;
  descricao: string | null;
  logo_url: string | null;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  emails: string[];
};

export async function extrairDetalhe(url: string): Promise<DetalheGuia> {
  const r = await fetch(url, {
    headers: { "user-agent": UA },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`detalhe status ${r.status} em ${url}`);
  const html = await r.text();
  return parseDetalhe(html, url);
}

export function parseDetalhe(html: string, url: string): DetalheGuia {
  const slug = url.match(/_fornecedores\/([^/]+)\/?$/)?.[1] ?? "";

  const ogTitleRaw = matchAttr(html, /<meta\s+property="og:title"\s+content="([^"]+)"/);
  const h1 = stripTags(matchGroup(html, /<h1[^>]*>([\s\S]*?)<\/h1>/))?.trim() ?? null;
  const nomeBruto = h1 || ogTitleRaw || slug;
  const nome = limparTituloOg(nomeBruto);

  const descricao = matchAttr(html, /<meta\s+property="og:description"\s+content="([^"]*)"/) || null;
  const logo_url = matchAttr(html, /<meta\s+property="og:image"\s+content="([^"]+)"/) || null;

  const tels = unique(
    [...html.matchAll(/href="tel:([^"]+)"/g)]
      .map((m) => decodeURIComponent(m[1]).trim())
      .filter(Boolean),
  );
  const telefone = tels[0] ?? null;

  const wa = matchGroup(html, /href="https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\?phone=?(\d+)/) ||
             matchGroup(html, /wa\.me\/(\d+)/);
  const whatsapp = wa ? formatarWhatsapp(wa) : null;

  // Site externo: pega qualquer link http(s) que NAO seja do proprio guia,
  // NAO fontes, NAO social/maps. Se sobrar mais de um, fica com o primeiro.
  const sites = unique(
    [...html.matchAll(/href="(https?:\/\/[^"#]+)"/g)]
      .map((m) => m[1])
      .filter((u) => !excludeUrl(u)),
  );
  const site = sites[0] ?? null;

  const emails = unique(
    [...html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)]
      .map((m) => m[0].toLowerCase())
      .filter((e) => !e.endsWith("@guiafornecedoresic.com.br") && !e.includes("noreply") && !e.includes("wordpress")),
  );

  return { url, slug, nome, descricao, logo_url, telefone, whatsapp, site, emails };
}

function limparTituloOg(t: string): string {
  // Tira "| ... - Guia Fornecedores" ou variacoes
  return t.replace(/\s*[|\-–—]\s*Guia Fornecedores.*$/i, "")
          .replace(/\s*\|\s*[^|]+$/, (m) => /Guia/i.test(m) ? "" : m)
          .trim();
}

function matchAttr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}
function matchGroup(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}
function stripTags(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

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
  /^https?:\/\/gmpg\.org/,
  /^https?:\/\/w3\.org/,
  /^https?:\/\/cdn-cgi/,
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)(?:\?|$)/i,
];
function excludeUrl(u: string): boolean {
  return URL_EXCLUSAO.some((re) => re.test(u));
}

function formatarWhatsapp(digits: string): string {
  const d = digits.replace(/\D+/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const sem55 = d.slice(2);
    if (sem55.length === 11) return `+55 (${sem55.slice(0,2)}) ${sem55.slice(2,7)}-${sem55.slice(7)}`;
    if (sem55.length === 10) return `+55 (${sem55.slice(0,2)}) ${sem55.slice(2,6)}-${sem55.slice(6)}`;
  }
  return `+${d}`;
}

// ---------- Importacao em lote ----------

export type ImportResult = {
  url: string;
  ok: boolean;
  motivo?: string;
  parceiro_id?: number;
  codigo?: number;
};

import { criarParceiro, type TipoParceiro } from "@/lib/parceiros";
import pool from "@/lib/db";

export async function importarLote(
  urls: string[],
  tipoPadrao: TipoParceiro,
): Promise<ImportResult[]> {
  // Concorrencia 4 (Jet Engine no upstream eh leve mas nao queremos sobrecarregar)
  const queue = [...urls];
  const resultados: ImportResult[] = [];

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      if (!url) break;
      const r = await importarUm(url, tipoPadrao);
      resultados.push(r);
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  return resultados;
}

async function importarUm(url: string, tipo: TipoParceiro): Promise<ImportResult> {
  // Dedupe por URL fonte: se ja importado antes, nao refaz
  try {
    const ja = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.parceiros_fontes
       WHERE fonte = $1 AND url = $2 LIMIT 1`,
      [FONTE, url],
    );
    if (ja.rows[0]) {
      return { url, ok: false, motivo: "ja_importado" };
    }

    const detalhe = await extrairDetalhe(url);
    if (!detalhe.nome) {
      return { url, ok: false, motivo: "sem_nome" };
    }

    const produtos = detalhe.descricao
      ? extrairProdutosDaDescricao(detalhe.descricao)
      : [];

    const p = await criarParceiro({
      tipo,
      nome_fantasia: detalhe.nome,
      telefone: detalhe.telefone,
      whatsapp: detalhe.whatsapp,
      site: detalhe.site,
      logo_url: detalhe.logo_url,
      email: detalhe.emails[0] ?? null,
      notas: detalhe.descricao,
      origem: FONTE,
      origem_url: url,
      produtos,
    });

    await pool.query(
      `INSERT INTO sevenconstruction.parceiros_fontes (parceiro_id, fonte, url, payload_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (fonte, url) DO NOTHING`,
      [p.id, FONTE, url, JSON.stringify(detalhe)],
    );

    return { url, ok: true, parceiro_id: p.id, codigo: p.codigo };
  } catch (e) {
    return { url, ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

// Heuristica simples: pega substantivos relevantes da descricao.
// Se a descricao for "X oferece Y, Z e W para construcao civil", split em
// virgula/E e fica com itens curtos (<=40 chars).
function extrairProdutosDaDescricao(desc: string): string[] {
  const baixa = desc.toLowerCase();
  const m = baixa.match(/(?:oferece|fornece|fabrica|distribui|comercializa)\s+([^.]+)/i);
  if (!m) return [];
  return m[1]
    .split(/,|\s+e\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 40)
    .slice(0, 8);
}

export const FONTE_GUIA = FONTE;
