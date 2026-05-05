// Provider mock — log no console, simula envio bem-sucedido. Para dev.

import type { EnvioInput, EnvioResultado, ProviderEmail, ProviderWhatsapp } from "./types";
import { aplicarVariaveis } from "./types";

class MockEmailProvider implements ProviderEmail {
  nome = "mock-email";
  async enviar(input: EnvioInput): Promise<EnvioResultado> {
    const corpo = aplicarVariaveis(input.corpo, input);
    console.log(
      `[mock-email] → ${input.destino} | "${input.assunto}"\n${corpo.slice(0, 200)}...`,
    );
    // Simula latência real (50-200ms)
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
    const corpo = aplicarVariaveis(input.corpo, input);
    console.log(
      `[mock-whatsapp] → ${input.destino}\n${corpo.slice(0, 200)}...`,
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
