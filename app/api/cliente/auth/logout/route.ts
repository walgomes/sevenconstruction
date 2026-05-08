import { NextRequest, NextResponse } from "next/server";
import { limparCookieCliente } from "@/lib/cliente-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await limparCookieCliente();
  return NextResponse.redirect(new URL("/cliente", req.url), 303);
}
