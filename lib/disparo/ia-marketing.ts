// IA marketing 24h — gera templates novos pra cada loja todo dia.
// Usa Claude Haiku 4.5 (rapido + barato: ~$0.001 por loja/dia).
// Cron: chamar /api/disparo/ia-gerar a cada 24h.

import Anthropic from "@anthropic-ai/sdk";
import pool from "@/lib/db";

type LojaPerfil = {
  id: number;
  nome_fantasia: string;
  cidade: string | null;
  uf: string | null;
  plano: string;
};

const SYSTEM_PROMPT = `Voce e copywriter especialista em marketing B2B pra lojas de material de construcao no Brasil.

Cada loja e um SaaS-tenant que vende cimento/areia/brita/blocos/ferragens e ALEM disso revende servicos digitais (certidoes, consultas RFB, certificado digital, score credito) ganhando comissao em cada venda.

Seu objetivo: gerar 3 templates DIVERSOS para a loja usar em outbound (WhatsApp + Email).

REGRAS:
- Tom: profissional mas humano, com gancho local (cidade)
- Foco em VALOR pro cliente final (construtor, instalador, prestador)
- Use as variaveis: {{nome}}, {{empresa}}, {{cidade}}, {{loja_nome}}
- WhatsApp: ate 320 chars (template Cloud API tem limite)
- Email: pode ser mais longo, mas no maximo 600 chars no corpo
- LGPD: nao prometa coisas que precisam consentimento previo
- Brasileiro coloquial, evite "voce" formal demais
- Cada template TEM que ser tematico diferente: 1) primeiro contato, 2) servico digital especifico, 3) follow-up

Retorne JSON estritamente neste formato:
{
  "templates": [
    {
      "nome": "Apresentacao loja - WhatsApp",
      "canal": "whatsapp",
      "assunto": null,
      "corpo": "..."
    },
    {
      "nome": "Promo certidao - Email",
      "canal": "email",
      "assunto": "...",
      "corpo": "..."
    },
    {
      "nome": "Follow-up - WhatsApp",
      "canal": "whatsapp",
      "assunto": null,
      "corpo": "..."
    }
  ]
}`;

type TemplateGerado = {
  nome: string;
  canal: "email" | "whatsapp";
  assunto: string | null;
  corpo: string;
};

async function gerarTemplatesIA(perfil: LojaPerfil): Promise<TemplateGerado[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao configurada");

  const client = new Anthropic({ apiKey });

  const userMsg = `Loja: ${perfil.nome_fantasia}
Localizacao: ${perfil.cidade ?? "—"}/${perfil.uf ?? "—"}
Plano: ${perfil.plano}
Data: ${new Date().toLocaleDateString("pt-BR")}

Gere 3 templates frescos (1 email + 2 WhatsApp) que essa loja possa usar HOJE para captar leads e converter clientes. Use o nome da cidade quando fizer sentido.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = msg.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  // Extrai JSON do texto
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA nao retornou JSON valido");
  const parsed = JSON.parse(match[0]) as { templates?: TemplateGerado[] };
  if (!parsed.templates || !Array.isArray(parsed.templates)) {
    throw new Error("Formato JSON invalido (templates ausente)");
  }
  return parsed.templates.filter(
    (t): t is TemplateGerado =>
      typeof t.nome === "string" &&
      (t.canal === "email" || t.canal === "whatsapp") &&
      typeof t.corpo === "string" &&
      t.corpo.length > 10,
  );
}

/**
 * Gera templates IA para uma loja e salva como mkt_templates.
 * Idempotente: ja gerou hoje? skip.
 */
export async function gerarTemplatesParaLoja(loja_id: number): Promise<{
  ok: boolean;
  inseridos: number;
  motivo?: string;
}> {
  // Carrega perfil
  const r = await pool.query(
    `SELECT id, nome_fantasia, cidade, uf, plano
       FROM sevenconstruction.lojas
      WHERE id = $1 AND ativo = TRUE`,
    [loja_id],
  );
  const perfil = r.rows[0] as LojaPerfil | undefined;
  if (!perfil) return { ok: false, inseridos: 0, motivo: "Loja nao encontrada" };

  // Idempotencia: nao gera 2x no mesmo dia
  const j = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM sevenconstruction.mkt_templates
      WHERE loja_id = $1
        AND nome LIKE 'IA %'
        AND criado_em::date = CURRENT_DATE`,
    [loja_id],
  );
  if ((j.rows[0]?.n ?? 0) >= 3) {
    return { ok: false, inseridos: 0, motivo: "Ja gerou hoje" };
  }

  const templates = await gerarTemplatesIA(perfil);

  let inseridos = 0;
  for (const t of templates) {
    try {
      await pool.query(
        `INSERT INTO sevenconstruction.mkt_templates
           (loja_id, nome, canal, assunto, corpo, criado_por)
         VALUES ($1, $2, $3, $4, $5, NULL)`,
        [
          loja_id,
          `IA ${new Date().toLocaleDateString("pt-BR")} — ${t.nome}`.slice(0, 200),
          t.canal,
          t.assunto,
          t.corpo,
        ],
      );
      inseridos++;
    } catch (e) {
      console.error("[ia-marketing] erro ao salvar template:", e);
    }
  }
  return { ok: true, inseridos };
}

/**
 * Gera templates pra TODAS as lojas ativas. Para cron diario.
 */
export async function gerarParaTodasLojas(): Promise<{
  lojas_processadas: number;
  total_inseridos: number;
}> {
  const r = await pool.query(
    `SELECT id FROM sevenconstruction.lojas WHERE ativo = TRUE ORDER BY id`,
  );
  let total_inseridos = 0;
  for (const row of r.rows) {
    try {
      const res = await gerarTemplatesParaLoja(row.id);
      total_inseridos += res.inseridos;
    } catch (e) {
      console.error(`[ia-marketing] loja ${row.id} falhou:`, e);
    }
  }
  return { lojas_processadas: r.rows.length, total_inseridos };
}
