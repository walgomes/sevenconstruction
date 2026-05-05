// Provider Resend (email). Lê RESEND_API_KEY + RESEND_FROM_EMAIL do env.

import type { EnvioInput, EnvioResultado, ProviderEmail } from "./types";
import { aplicarVariaveis } from "./types";

class ResendProvider implements ProviderEmail {
  nome = "resend";

  async enviar(input: EnvioInput): Promise<EnvioResultado> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return {
        ok: false,
        provider_nome: this.nome,
        erro: "RESEND_API_KEY ou RESEND_FROM_EMAIL nao configurados",
        permanente: true,
      };
    }

    const corpo = aplicarVariaveis(input.corpo, input);
    const html = corpoParaHtml(corpo, input);

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: input.destino,
          subject: input.assunto || "(sem assunto)",
          html,
          text: corpo,
        }),
      });

      const j = (await r.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!r.ok) {
        return {
          ok: false,
          provider_nome: this.nome,
          erro: j?.message || `HTTP ${r.status}`,
          permanente: r.status >= 400 && r.status < 500,
        };
      }

      return {
        ok: true,
        provider_id: j?.id ?? `resend-${Date.now()}`,
        provider_nome: this.nome,
      };
    } catch (e) {
      return {
        ok: false,
        provider_nome: this.nome,
        erro: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

function corpoParaHtml(corpo: string, ctx: EnvioInput): string {
  // Conversao basica: paragrafos por linha em branco, links automaticos
  const safe = corpo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = safe
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  // Link de descadastro obrigatorio (LGPD legitimo interesse)
  const baseUrl = process.env.SC_PUBLIC_URL || "https://sevenconstruction.local";
  const unsubLink = `${baseUrl}/api/disparo/unsubscribe?destino=${encodeURIComponent(ctx.destino)}&loja=${encodeURIComponent(ctx.loja_nome)}`;
  const footer = `
<hr>
<p style="font-size:11px;color:#666">
Você está recebendo este email da loja <strong>${ctx.loja_nome}</strong>.<br>
Para não receber mais, <a href="${unsubLink}">clique aqui para descadastrar</a>.
</p>`.trim();

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">${html}\n${footer}</body></html>`;
}

export const resend = new ResendProvider();
