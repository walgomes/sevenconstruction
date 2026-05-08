import { NextRequest, NextResponse } from "next/server";

const COOKIE = "sc_auth";

const PASS_PREFIX = [
  "/_next", "/favicon", "/images", "/fonts", "/robots", "/sitemap", "/r/",
  // PWA cliente final tem auth propria (cookie sc_cliente_auth) validada
  // dentro dos handlers — middleware nao mexe.
  "/cliente",
  "/api/cliente/",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon-",
  // Webhook Stripe — autenticidade via x-stripe-signature dentro do handler
  "/api/billing/webhook",
];
const ROTAS_PUBLICAS = new Set([
  "/",
  "/login",
  "/cadastrar",
  "/esqueci-senha",
  "/redefinir-senha",
  "/termos",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/cadastrar",
  "/api/auth/esqueci-senha",
  "/api/auth/redefinir-senha",
  "/api/disparo/unsubscribe",  // LGPD: descadastro publico (rate limit por IP no handler)
  // Webhooks de provedores externos (Meta/Resend). Autenticidade verificada
  // dentro do handler — Meta via x-hub-signature-256, Resend via Svix.
  "/api/disparo/webhook/meta",
  "/api/disparo/webhook/resend",
]);

// CSP em prod tem upgrade-insecure-requests; em dev removemos pra não brigar
// com Turbopack HMR. unsafe-inline é necessário pelo Next 16 inline boot
// script — em prod ideal seria nonce-based mas adicionar nonce exige
// integração mais profunda que o middleware (Next ainda não tem hook nativo
// que entrega nonce p/ <Script>).
const CSP_BASE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];
const CSP_PROD = [...CSP_BASE, "upgrade-insecure-requests"].join("; ");
const CSP_DEV = CSP_BASE.join("; ");

function aplicarHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === "production";
  res.headers.set("Content-Security-Policy", isProd ? CSP_PROD : CSP_DEV);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), browsing-topics=()",
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (isProd) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

function ehPublica(path: string): boolean {
  if (PASS_PREFIX.some((p) => path.startsWith(p))) return true;
  return ROTAS_PUBLICAS.has(path);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (ehPublica(path)) return aplicarHeaders(NextResponse.next());

  // API key admin (scripts/MCP externos): bypass para /api/* com header valido.
  if (path.startsWith("/api/")) {
    const apiKey = req.headers.get("x-sc-admin-key");
    const expected = process.env.SC_ADMIN_API_KEY;
    if (apiKey && expected && apiKey === expected) {
      return aplicarHeaders(NextResponse.next());
    }
  }

  const cookie = req.cookies.get(COOKIE);
  const cookieInvalido =
    !cookie?.value || cookie.value.split(".").length !== 2 ||
    !cookie.value.split(".")[0] || !cookie.value.split(".")[1];

  if (cookieInvalido) {
    // API: responder JSON 401 (clientes esperam JSON, nao redirect)
    if (path.startsWith("/api/")) {
      return aplicarHeaders(
        new NextResponse(
          JSON.stringify({ ok: false, motivo: "Não autenticado" }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      );
    }
    // Pagina: redirect pra /login com retorno
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (path !== "/") url.searchParams.set("redirect", path);
    return aplicarHeaders(NextResponse.redirect(url));
  }

  return aplicarHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
