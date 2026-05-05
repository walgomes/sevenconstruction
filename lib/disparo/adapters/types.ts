// Adapter pattern: cada provider de envio (mock, Cloud API Meta, Resend, UltraMSG)
// implementa a mesma interface. Worker escolhe baseado em env vars.

export type EnvioInput = {
  destino: string;             // email ou WhatsApp (com ddi)
  assunto?: string;            // só email
  corpo: string;
  loja_nome: string;
  contato_nome?: string;
  contato_empresa?: string;
  contato_cidade?: string;
};

export type EnvioResultado =
  | { ok: true; provider_id: string; provider_nome: string }
  | { ok: false; erro: string; provider_nome: string; permanente?: boolean };

export interface ProviderEmail {
  nome: string;
  enviar(input: EnvioInput): Promise<EnvioResultado>;
}

export interface ProviderWhatsapp {
  nome: string;
  enviar(input: EnvioInput): Promise<EnvioResultado>;
}

/**
 * Aplica variaveis padrao no corpo do template:
 *   {{nome}}, {{empresa}}, {{cidade}}, {{loja_nome}}
 */
export function aplicarVariaveis(corpo: string, ctx: EnvioInput): string {
  return corpo
    .replace(/\{\{nome\}\}/g, ctx.contato_nome ?? "")
    .replace(/\{\{empresa\}\}/g, ctx.contato_empresa ?? "")
    .replace(/\{\{cidade\}\}/g, ctx.contato_cidade ?? "")
    .replace(/\{\{loja_nome\}\}/g, ctx.loja_nome ?? "");
}
