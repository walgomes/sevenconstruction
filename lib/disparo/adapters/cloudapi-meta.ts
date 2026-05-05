// Provider WhatsApp Cloud API Meta. Le META_WHATSAPP_TOKEN +
// META_WHATSAPP_PHONE_NUMBER_ID + META_WHATSAPP_TEMPLATE_NAME (template aprovado).

import type { EnvioInput, EnvioResultado, ProviderWhatsapp } from "./types";
import { aplicarVariaveis } from "./types";

class CloudApiMetaProvider implements ProviderWhatsapp {
  nome = "cloudapi-meta";

  async enviar(input: EnvioInput): Promise<EnvioResultado> {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.META_WHATSAPP_TEMPLATE_NAME;
    const apiVersion = process.env.META_GRAPH_API_VERSION || "v22.0";

    if (!token || !phoneId || !templateName) {
      return {
        ok: false,
        provider_nome: this.nome,
        erro: "META_WHATSAPP_TOKEN/PHONE_NUMBER_ID/TEMPLATE_NAME nao configurados",
        permanente: true,
      };
    }

    // Cloud API Meta exige template aprovado p/ outbound (legitimo interesse).
    // O template recebe variaveis posicionais ({{1}}, {{2}}, ...) — nosso
    // template aprovado deve aceitar 4 variaveis: nome, empresa, cidade, loja.
    const corpoFormatado = aplicarVariaveis(input.corpo, input);
    const variaveis = [
      input.contato_nome ?? "cliente",
      input.contato_empresa ?? "",
      input.contato_cidade ?? "",
      input.loja_nome,
      corpoFormatado.slice(0, 1024),
    ];

    const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
    const destino = input.destino.replace(/\D/g, "");

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino,
          type: "template",
          template: {
            name: templateName,
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: variaveis.map((v) => ({ type: "text", text: String(v) })),
              },
            ],
          },
        }),
      });

      const j = (await r.json().catch(() => null)) as
        | { messages?: { id?: string }[]; error?: { message?: string; code?: number } }
        | null;

      if (!r.ok || !j?.messages?.[0]?.id) {
        return {
          ok: false,
          provider_nome: this.nome,
          erro: j?.error?.message || `HTTP ${r.status}`,
          permanente: r.status >= 400 && r.status < 500 && r.status !== 429,
        };
      }

      return {
        ok: true,
        provider_id: j.messages[0].id,
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

export const cloudApiMeta = new CloudApiMetaProvider();
