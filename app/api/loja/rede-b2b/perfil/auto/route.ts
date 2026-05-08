/**
 * POST /api/loja/rede-b2b/perfil/auto
 *
 * Onboarding IA: le o site da empresa e preenche o perfil B2B em ~30s.
 * Reduz friction do cadastro de 5min de form pra 30s de espera.
 *
 * Body: { cnpj, site_url }
 * Resposta: { perfil_sugerido } — usuario REVISA antes de salvar.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { lerSessao } from "@/lib/auth";
import { rfbQuery } from "@/lib/rfb-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SYSTEM = `Você é um analista de prospecção B2B. Recebe o conteúdo do site de uma empresa e extrai:
1. O QUE ELA VENDE (em 1 frase clara, sem jargão de marketing vazio)
2. DIFERENCIAL competitivo (em 1 frase concreta — preço, qualidade, processo, pessoa, tecnologia)
3. ICP — perfil do cliente ideal:
   - CNAEs de 7 dígitos prováveis (até 5 — usar tabela CNAE 2.3 do IBGE)
   - UFs onde provavelmente atende (cite SP, RJ, MG explicitamente; "todo o BR" → ["SP","RJ","MG","RS","PR","SC"])
   - Porte típico (ME / EPP / MEDIA / GRANDE — escolha 1 ou 2)
   - Faixa de faturamento mín/máx (em R$/ano) do cliente típico
   - Descrição livre do ICP em 1-2 frases
4. CAPACIDADE — quantos atendimentos/clientes/projetos por mês a empresa parece comportar (estimar)
5. TICKET MÉDIO — valor típico que a empresa cobra (em centavos), se possível inferir

REGRAS DURAS:
- USE APENAS o que está no site. Não invente.
- Se o site não diz, retorne null no campo.
- ICP deve ser DEDUZIDO do que está escrito (público-alvo, cases, depoimentos), não chutado.
- CNAE — use seu conhecimento da classificação CNAE 2.3 brasileira para mapear a atividade descrita.

FORMATO DE RESPOSTA — JSON puro, sem markdown, sem texto extra:

{
  "o_que_vende": "string ou null",
  "diferencial": "string ou null",
  "icp_cnaes": ["7-digits", ...] | null,
  "icp_ufs": ["SP", ...] | null,
  "icp_porte": ["ME"|"EPP"|"MEDIA"|"GRANDE", ...] | null,
  "icp_faturamento_min": número-em-reais ou null,
  "icp_faturamento_max": número-em-reais ou null,
  "icp_descricao": "string ou null",
  "capacidade_atendimentos_mes": número ou null,
  "ticket_medio_centavos": número ou null,
  "modalidade": ["B2B"|"B2C"|"B2G", ...],
  "evidencias": "string — trecho do site que justificou as escolhas"
}`;

function extrairTexto(html: string): string {
  const limpo = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
  return limpo.slice(0, 8000);
}

async function fetchSite(siteUrl: string): Promise<string> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const url = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SevenConstructionBot/1.0)" },
      redirect: "follow",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ao acessar ${url}`);
    return await r.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "anthropic_nao_configurado" }, { status: 503 });
  }

  let body: { cnpj?: string; site_url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "payload_invalido" }, { status: 400 }); }
  if (!body.cnpj || !body.site_url) {
    return NextResponse.json({ error: "cnpj_e_site_obrigatorios" }, { status: 400 });
  }

  const cnpjLimpo = body.cnpj.replace(/\D/g, "");
  if (cnpjLimpo.length !== 14) return NextResponse.json({ error: "cnpj_invalido" }, { status: 400 });

  let textoSite: string;
  try {
    const html = await fetchSite(body.site_url);
    textoSite = extrairTexto(html);
    if (textoSite.length < 100) {
      return NextResponse.json({ error: "site_vazio_ou_bloqueado", mensagem: "Site retornou pouco conteúdo. Verifique URL ou cole texto manual." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "erro_fetch_site", mensagem: (e as Error).message }, { status: 400 });
  }

  // Contexto RFB (sevendb)
  let contextoRfb = "";
  try {
    const rows = await rfbQuery<{
      razao_social: string; nome_fantasia: string | null; cnae_fiscal: string;
      cnae_descricao: string | null; uf: string; municipio: string | null; porte: number;
    }>(
      `SELECT razao_social, nome_fantasia, cnae_fiscal, cnae_descricao, uf, municipio, porte
         FROM empresas WHERE cnpj = $1 LIMIT 1`,
      [cnpjLimpo],
    );
    if (rows[0]) {
      const e = rows[0];
      contextoRfb = `\n\n## Dados RFB (referência):
- Razão social: ${e.razao_social}
- Nome fantasia: ${e.nome_fantasia || "—"}
- CNAE principal: ${e.cnae_fiscal} (${e.cnae_descricao})
- Localização: ${e.municipio || ""} / ${e.uf || ""}
- Porte: ${e.porte}`;
    }
  } catch { /* opcional */ }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let json: Record<string, unknown> = {};
  let inputTokens = 0, outputTokens = 0;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Site: ${body.site_url}${contextoRfb}\n\n## Conteúdo do site:\n\n${textoSite}\n\nExtraia o perfil B2B em JSON puro.`,
      }],
    });

    inputTokens = resp.usage.input_tokens;
    outputTokens = resp.usage.output_tokens;

    let texto = "";
    for (const b of resp.content) {
      if (b.type === "text") texto += b.text;
    }
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    json = JSON.parse(texto);
  } catch (e) {
    return NextResponse.json({
      error: "ia_falhou",
      mensagem: (e as Error).message,
    }, { status: 500 });
  }

  const perfilSugerido = {
    o_que_vende: typeof json.o_que_vende === "string" ? json.o_que_vende : null,
    diferencial: typeof json.diferencial === "string" ? json.diferencial : null,
    icp_cnaes: Array.isArray(json.icp_cnaes) ? json.icp_cnaes.filter((c) => typeof c === "string").map((c) => String(c).replace(/\D/g, "").slice(0, 7)) : null,
    icp_ufs: Array.isArray(json.icp_ufs) ? json.icp_ufs.filter((u) => typeof u === "string").map((u) => String(u).toUpperCase().slice(0, 2)) : null,
    icp_porte: Array.isArray(json.icp_porte) ? json.icp_porte.filter((p) => ["ME","EPP","MEDIA","GRANDE"].includes(String(p).toUpperCase())) : null,
    icp_faturamento_min: typeof json.icp_faturamento_min === "number" ? json.icp_faturamento_min : null,
    icp_faturamento_max: typeof json.icp_faturamento_max === "number" ? json.icp_faturamento_max : null,
    icp_descricao: typeof json.icp_descricao === "string" ? json.icp_descricao : null,
    capacidade_atendimentos_mes: typeof json.capacidade_atendimentos_mes === "number" ? json.capacidade_atendimentos_mes : null,
    ticket_medio_centavos: typeof json.ticket_medio_centavos === "number" ? json.ticket_medio_centavos : null,
    modalidade: Array.isArray(json.modalidade) ? json.modalidade.filter((m) => typeof m === "string") : ["B2B"],
  };

  return NextResponse.json({
    ok: true,
    perfil_sugerido: perfilSugerido,
    evidencias: typeof json.evidencias === "string" ? json.evidencias : null,
    fonte: { site_url: body.site_url, chars_lidos: textoSite.length },
    custo: { tokens_input: inputTokens, tokens_output: outputTokens, modelo: "claude-haiku-4-5" },
    aviso: "Perfil sugerido pela IA. REVISE cada campo antes de salvar — você é responsável pela precisão.",
  });
}
