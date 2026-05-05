// Selector que escolhe o provider certo baseado em env vars.

import type { ProviderEmail, ProviderWhatsapp } from "./types";
import { mockEmail, mockWhatsapp } from "./mock";
import { resend } from "./resend";
import { cloudApiMeta } from "./cloudapi-meta";

export function emailProvider(): ProviderEmail {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    return resend;
  }
  return mockEmail;
}

export function whatsappProvider(): ProviderWhatsapp {
  if (
    process.env.META_WHATSAPP_TOKEN &&
    process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
    process.env.META_WHATSAPP_TEMPLATE_NAME
  ) {
    return cloudApiMeta;
  }
  return mockWhatsapp;
}

export function statusProviders(): { email: string; whatsapp: string } {
  return {
    email: emailProvider().nome,
    whatsapp: whatsappProvider().nome,
  };
}
