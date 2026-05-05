// Provider mock — simula envio bem-sucedido. Em DEV faz log; em PROD se cair
// aqui (env var faltando), FALHA explicitamente em vez de vazar PII no log.

import type { EnvioInput, EnvioResultado, ProviderEmail, ProviderWhatsapp } from "./types";
import { aplicarVariaveis } from "./types";

function ehDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function mascara(destino: string): string {
  // Mascara PII pra log: keeps first 3 + last 2 chars
  if (destino.length <= 6) return "***";
  return `${destino.slice(0, 3)}***${destino.slice(-2)}`;
}

class MockEmailProvider implements ProviderEmail {
  nome = "mock-email";
  async enviar(input: EnvioInput): Promise<EnvioResultado> {
    if (!ehDev()) {
      // Em PROD nunca deve cair no mock — se cair, env vars Resend faltam.
      // Falha explicita pra worker reagendar/registrar erro permanente.
      return {
        ok: false,
        provider_nome: this.nome,
        erro: "Provider de email nao configurado em producao (RESEND_API_KEY ausente)",
        permanente: true,
      };
    }
    const corpo = aplicarVariaveis(input.corpo, input);
    console.log(
      `[mock-email DEV] → ${mascara(input.destino)} | "${input.assunto}"\n${corpo.slice(0, 120)}...`,
    );
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
    return {
      ok: true,
      provider_id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider_nome: this.nome,
    };
  }
}

class MockWhatsappProvider implements ProviderWhatsapp {
  nome = "mock-whatsapp";
  async enviar(input: EnvioInput): Promise<EnvioResultado> {
    if (!ehDev()) {
      return {
        ok: false,
        provider_nome: this.nome,
        erro: "Provider de WhatsApp nao configurado em producao (META_WHATSAPP_TOKEN ausente)",
        permanente: true,
      };
    }
    const corpo = aplicarVariaveis(input.corpo, input);
    console.log(
      `[mock-whatsapp DEV] → ${mascara(input.destino)}\n${corpo.slice(0, 120)}...`,
    );
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
    return {
      ok: true,
      provider_id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider_nome: this.nome,
    };
  }
}

export const mockEmail = new MockEmailProvider();
export const mockWhatsapp = new MockWhatsappProvider();
