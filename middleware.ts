import { NextRequest, NextResponse } from "next/server";

const COOKIE = "sc_auth";

const PASS_PREFIX = ["/_next", "/favicon", "/images", "/fonts", "/robots", "/sitemap"];
const ROTAS_PUBLICAS = new Set([
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
]);

const CSP = [
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
].join("; ");

function aplicarHeaders(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
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
  if (!cookie?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (path !== "/") url.searchParams.set("redirect", path);
    return aplicarHeaders(NextResponse.redirect(url));
  }

  const partes = cookie.value.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return aplicarHeaders(NextResponse.redirect(url));
  }

  return aplicarHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
