import { NextResponse } from "next/server";
import { limparCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await limparCookie();
  return NextResponse.json({ ok: true });
}
