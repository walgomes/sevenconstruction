// Agentes IA do SRM (inspiracao Pipefy SRM AI Studio).
// Todos consomem o parceiro + dados do sevendb (RFB) e produzem pareceres
// JSON estruturados. Trust Score combina os 4 pareceres.
// Decision Assist usa Claude Haiku 4.5 (ANTHROPIC_API_KEY).

import { rfbQuery } from "@/lib/rfb-db";
import { buscarDadosEmpresa, buscarSocios, lerCompliance } from "@/lib/consulta-cnpj";
import { geocodificarCep, distanciaKm, type Coords } from "@/lib/geocoding";
import pool from "@/lib/db";
import type { Parceiro, RiscoInicial } from "@/lib/parceiros-tipos";

// ===== Pre Check AI =====
// Triagem inicial: valida CNPJ na RFB, classifica risco inicial.
export async function preCheckAI(p: Parceiro): Promise<{
  cnpj_valido: boolean;
  encontrado_rfb: boolean;
  situacao: string;
  porte: string;
  abertura: string | null;
  cnae_fiscal: string | null;
  capital_social: number | null;
  risco_inicial: RiscoInicial;
  motivos: string[];
}> {
  const motivos: string[] = [];
  if (!p.cnpj) {
    return {
      cnpj_valido: false, encontrado_rfb: false,
      situacao: "—", porte: "—", abertura: null, cnae_fiscal: null, capital_social: null,
      risco_inicial: "alto",
      motivos: ["CNPJ ausente — nao foi possivel validar"],
    };
  }
  const cnpj_valido = p.cnpj.length === 14 && validarDigitosCnpj(p.cnpj);
  if (!cnpj_valido) motivos.push("CNPJ com digitos invalidos");

  const dados = cnpj_valido ? await buscarDadosEmpresa(p.cnpj).catch(() => null) : null;
  const encontrado = !!dados;
  if (!encontrado) motivos.push("CNPJ nao localizado na base RFB");

  let risco: RiscoInicial = "baixo";
  if (!cnpj_valido || !encontrado) risco = "alto";
  else if (dados!.situacao !== 2) { risco = "alto"; motivos.push(`Situacao ${dados!.situacao_label} (esperado: ATIVA)`); }
  else if (dados!.capital_social != null && dados!.capital_social < 1000) {
    risco = "medio"; motivos.push("Capital social muito baixo (<R$ 1.000)");
  }

  return {
    cnpj_valido,
    encontrado_rfb: encontrado,
    situacao: dados?.situacao_label ?? "—",
    porte: dados?.porte_label ?? "—",
    abertura: dados?.data_abertura ?? null,
    cnae_fiscal: dados?.cnae_fiscal ?? null,
    capital_social: dados?.capital_social ?? null,
    risco_inicial: risco,
    motivos,
  };
}

// ===== Compliance AI =====
// CADIN, PGFN, CEIS, CNEP, midia adversa (placeholder).
export async function complianceAI(p: Parceiro): Promise<{
  cadin: { presente: boolean; total: number };
  pgfn: { presente: boolean; total: number; valor_devido: number | null };
  ceis: { presente: boolean; total: number };
  cnep: { presente: boolean; total: number };
  flags: string[];
}> {
  const flags: string[] = [];
  if (!p.cnpj) {
    return {
      cadin: { presente: false, total: 0 },
      pgfn: { presente: false, total: 0, valor_devido: null },
      ceis: { presente: false, total: 0 },
      cnep: { presente: false, total: 0 },
      flags: ["sem CNPJ — nao consultado"],
    };
  }
  const compliance = await lerCompliance(p.cnpj);
  const ceis = await tentarCount("compliance_ceis", p.cnpj);
  const cnep = await tentarCount("compliance_cnep", p.cnpj);

  if (ceis.total > 0)  flags.push(`CEIS: ${ceis.total} apontamentos (inidonea)`);
  if (cnep.total > 0)  flags.push(`CNEP: ${cnep.total} apontamentos (Lei Anticorrupcao)`);
  if (compliance.cadin.total > 0) flags.push(`CADIN: ${compliance.cadin.total} pendencias`);
  if (compliance.pgfn.total > 0)  flags.push(`PGFN: ${compliance.pgfn.total} divida(s)`);

  return { ...compliance, ceis, cnep, flags };
}

async function tentarCount(tabela: string, cnpj: string): Promise<{ presente: boolean; total: number }> {
  try {
    const r = await rfbQuery<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${tabela} WHERE cnpj = $1`, [cnpj],
    );
    return { presente: (r[0]?.n ?? 0) > 0, total: r[0]?.n ?? 0 };
  } catch {
    return { presente: false, total: 0 };
  }
}

// ===== Finance AI =====
//
// Diferencial SevenConstruction: avalia se o parceiro vai gerar credito
// CBS/IBS otimo apos a Reforma Tributaria (LC 214/2025 + Decreto 12.955/2026).
// Empresas no regime regular (lucro real/presumido) geram credito integral pra
// loja-cliente; Simples Nacional gera apenas o saldo aproveitavel pelo regime
// regular do destinatario (impacto significativo a partir de 2027).
export async function financeAI(p: Parceiro, preCheck?: Awaited<ReturnType<typeof preCheckAI>>) {
  const cap = preCheck?.capital_social ?? null;
  const idade = preCheck?.abertura ? anosDesde(preCheck.abertura) : null;
  const porte = preCheck?.porte ?? "—";
  const flags: string[] = [];

  let saudeFinanceira: "verde" | "amarela" | "vermelha" = "verde";
  if (cap == null) { saudeFinanceira = "amarela"; flags.push("Capital social desconhecido"); }
  else if (cap < 10000) { saudeFinanceira = "vermelha"; flags.push("Capital social <R$10k"); }
  else if (cap < 100000) { saudeFinanceira = "amarela"; flags.push("Capital social baixo (<R$100k)"); }

  if (idade != null && idade < 1) { saudeFinanceira = saudeFinanceira === "verde" ? "amarela" : saudeFinanceira; flags.push(`Empresa muito nova (${idade.toFixed(1)} anos)`); }
  if (idade != null && idade >= 10) flags.push(`Maturidade alta (${idade.toFixed(0)} anos)`);

  // Sinal Reforma Tributaria — heuristica simples sem confirmar regime real
  // (RFB ainda nao expoe regime tributario aberto). ME/EPP tipicamente Simples;
  // Medio/Grande tipicamente regime regular. Capital + idade reforcam a heuristica.
  let credito_cbs: "otimo" | "parcial" | "ruim" | "indeterminado" = "indeterminado";
  if (porte === "Médio/Grande" && saudeFinanceira !== "vermelha") credito_cbs = "otimo";
  else if (porte === "EPP" && (cap ?? 0) >= 100000)               credito_cbs = "parcial";
  else if (porte === "ME" || porte === "EPP")                      credito_cbs = "ruim";

  if (credito_cbs === "otimo")   flags.push("Provável regime regular → crédito CBS/IBS integral pós-2027");
  if (credito_cbs === "ruim")    flags.push("Provável Simples Nacional → crédito CBS/IBS reduzido pós-2027");

  return {
    capital_social: cap,
    idade_anos: idade,
    porte,
    saude: saudeFinanceira,
    credito_cbs_pos_2027: credito_cbs,
    flags,
  };
}

// ===== Operacional AI =====
//
// Diferencial geo-aware: se o parceiro tem CEP, geocodifica e calcula
// distancia ate o centroide das lojas ativas. Distancia <100km otimo,
// 100-500km medio, >500km penaliza (logistica encarece).
export async function operacionalAI(p: Parceiro) {
  const flags: string[] = [];
  let pontos = 0;
  if (p.telefone)  pontos += 4; else flags.push("Sem telefone");
  if (p.whatsapp)  pontos += 4; else flags.push("Sem WhatsApp");
  if (p.site)      pontos += 4; else flags.push("Sem site");
  if (p.email)     pontos += 4; else flags.push("Sem email");
  if (p.endereco)  pontos += 4; else flags.push("Sem endereco completo");
  if (p.uf && p.cidade) pontos += 4; else flags.push("UF/cidade incompletos");
  // 24 max acima

  // Geo (6 max)
  let geo: {
    coords: Coords | null;
    centroide_lojas: Coords | null;
    distancia_km: number | null;
    bandeira: "perto" | "medio" | "longe" | "indeterminado";
  } = { coords: null, centroide_lojas: null, distancia_km: null, bandeira: "indeterminado" };

  let coords: Coords | null = p.lat != null && p.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null;
  if (!coords && p.cep) {
    coords = await geocodificarCep(p.cep);
    if (coords) {
      // Persiste pra evitar re-consulta
      await pool.query(
        `UPDATE sevenconstruction.parceiros SET lat=$1, lng=$2, geocoded_em=NOW() WHERE id=$3`,
        [coords.lat, coords.lng, p.id],
      );
    }
  }

  if (coords) {
    geo.coords = coords;
    const centroide = await centroideLojas();
    geo.centroide_lojas = centroide;
    if (centroide) {
      const dist = distanciaKm(coords, centroide);
      geo.distancia_km = Math.round(dist * 10) / 10;
      if (dist <= 100)      { geo.bandeira = "perto"; pontos += 6; }
      else if (dist <= 500) { geo.bandeira = "medio"; pontos += 3; flags.push(`Distancia ${dist.toFixed(0)}km da rede`); }
      else                  { geo.bandeira = "longe"; flags.push(`Distancia ${dist.toFixed(0)}km da rede (encarece logistica)`); }
    } else {
      pontos += 3; // tem coord mas sem rede pra comparar — neutro
    }
  } else if (p.cep) {
    flags.push("CEP existe mas nao geocodificavel");
  } else {
    flags.push("Sem CEP — geo nao avaliada");
  }

  return {
    pontos_contato: pontos,
    max: 30,
    completude: Math.round((pontos / 30) * 100),
    geo,
    flags,
  };
}

// Calcula centroide simples (media lat/lng) das lojas ativas com coords.
// Cache nao-persistente vai existir naturalmente (proximo deploy resetará).
async function centroideLojas(): Promise<Coords | null> {
  const r = await pool.query<{ lat: number; lng: number }>(
    `SELECT AVG(lat)::float AS lat, AVG(lng)::float AS lng
       FROM sevenconstruction.lojas
      WHERE ativo AND lat IS NOT NULL AND lng IS NOT NULL`,
  );
  const row = r.rows[0];
  if (!row || row.lat == null || row.lng == null) return null;
  return { lat: row.lat, lng: row.lng };
}

// ===== Legal AI =====
export async function legalAI(p: Parceiro, preCheck?: Awaited<ReturnType<typeof preCheckAI>>) {
  const flags: string[] = [];
  let situacao_ok = false;
  let socios: { nome: string | null; qualif: string | null; data_entrada: string | null }[] = [];
  let socios_em_outras = 0;

  if (preCheck?.encontrado_rfb && preCheck.situacao === "ATIVA") {
    situacao_ok = true;
  } else if (preCheck) {
    flags.push(`Situacao cadastral: ${preCheck.situacao}`);
  }

  if (p.cnpj) {
    const s = await buscarSocios(p.cnpj).catch(() => []);
    socios = s.map((x) => ({ nome: x.nome_socio, qualif: x.qualif_socio, data_entrada: x.data_entrada }));
    if (socios.length === 0) flags.push("Sem socios cadastrados na RFB");
  }

  return {
    situacao_cadastral_ok: situacao_ok,
    socios_total: socios.length,
    socios: socios.slice(0, 5),
    socios_em_outras_empresas: socios_em_outras,
    flags,
  };
}

// ===== Trust Score =====
// Combina os 4 pareceres em 0-100. Simples, auditavel.
//
// Regras:
//   compliance (40 pts) — comeca em 40, perde:
//      -25 cada CEIS/CNEP (fatal)
//      -10 cada CADIN
//      -5  cada PGFN
//   finance (20 pts) — saude verde=20 amarela=10 vermelha=0
//   operacional (20 pts) — completude * 20 / 100
//   legal (20 pts) — situacao_ok ? 20 : 0
export function trustScore(pareceres: {
  compliance: Awaited<ReturnType<typeof complianceAI>>;
  finance: Awaited<ReturnType<typeof financeAI>>;
  operacional: Awaited<ReturnType<typeof operacionalAI>>;
  legal: Awaited<ReturnType<typeof legalAI>>;
}): { score: number; breakdown: Record<string, number>; bandeira: "verde"|"amarela"|"vermelha" } {
  let comp = 40;
  comp -= 25 * (pareceres.compliance.ceis?.total ?? 0);
  comp -= 25 * (pareceres.compliance.cnep?.total ?? 0);
  comp -= 10 * (pareceres.compliance.cadin?.total ?? 0);
  comp -= 5  * (pareceres.compliance.pgfn?.total ?? 0);
  comp = Math.max(0, Math.min(40, comp));

  const fin = pareceres.finance.saude === "verde" ? 20 : pareceres.finance.saude === "amarela" ? 10 : 0;
  const ope = Math.round((pareceres.operacional.completude / 100) * 20);
  const leg = pareceres.legal.situacao_cadastral_ok ? 20 : 0;

  const score = comp + fin + ope + leg;
  const bandeira: "verde"|"amarela"|"vermelha" =
    score >= 70 ? "verde" : score >= 40 ? "amarela" : "vermelha";

  return {
    score,
    breakdown: { compliance: comp, finance: fin, operacional: ope, legal: leg },
    bandeira,
  };
}

// ===== Decision Assist (Claude Haiku 4.5) =====
type RecomendacaoIA = "aprovar" | "revisar" | "reprovar";

export async function decisionAssist(
  parceiro: Parceiro,
  pareceres: Parameters<typeof trustScore>[0],
  score: number,
): Promise<{ recomendacao: RecomendacaoIA; motivo: string; usado_modelo: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // fallback heuristico se nao tem API key
    const rec: RecomendacaoIA = score >= 70 ? "aprovar" : score >= 40 ? "revisar" : "reprovar";
    return {
      recomendacao: rec,
      motivo: `[heuristica] Score ${score} → ${rec}. ANTHROPIC_API_KEY nao configurada.`,
      usado_modelo: "regra:score",
    };
  }

  const prompt = `Voce eh um analista de homologacao de fornecedores de material de construcao.

DADOS DO PARCEIRO:
- Codigo interno: ${parceiro.codigo}
- Nome: ${parceiro.nome_fantasia}
- Tipo: ${parceiro.tipo}
- CNPJ: ${parceiro.cnpj ?? "—"}
- UF/Cidade: ${parceiro.uf ?? "—"}/${parceiro.cidade ?? "—"}

PARECERES DAS IAs:
- Compliance: ${JSON.stringify(pareceres.compliance, null, 2)}
- Finance: ${JSON.stringify(pareceres.finance, null, 2)}
- Operacional: ${JSON.stringify(pareceres.operacional, null, 2)}
- Legal: ${JSON.stringify(pareceres.legal, null, 2)}

TRUST SCORE: ${score}/100

Responda APENAS em JSON valido com este formato exato:
{"recomendacao": "aprovar"|"revisar"|"reprovar", "motivo": "1-2 frases curtas em pt-BR explicando a decisao"}

Regras:
- "aprovar" se score >= 70, sem CEIS/CNEP, situacao ativa
- "reprovar" se score < 30 OU tem CEIS/CNEP
- "revisar" caso contrario`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      throw new Error(`anthropic ${r.status}`);
    }
    const j = await r.json();
    const txt = j.content?.[0]?.text ?? "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("resposta sem JSON");
    const parsed = JSON.parse(m[0]);
    const rec = parsed.recomendacao;
    if (!["aprovar","revisar","reprovar"].includes(rec)) throw new Error("recomendacao invalida");
    return {
      recomendacao: rec,
      motivo: String(parsed.motivo ?? ""),
      usado_modelo: "claude-haiku-4-5-20251001",
    };
  } catch (e) {
    const rec: RecomendacaoIA = score >= 70 ? "aprovar" : score >= 40 ? "revisar" : "reprovar";
    return {
      recomendacao: rec,
      motivo: `[fallback] ${e instanceof Error ? e.message : String(e)}. Score ${score} → ${rec}.`,
      usado_modelo: "regra:score",
    };
  }
}

// ===== Helpers =====
function anosDesde(dataIso: string): number {
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function validarDigitosCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const w = base.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const s = base.split("").reduce((a, ch, i) => a + Number(ch) * w[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}
