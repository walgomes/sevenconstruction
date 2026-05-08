import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { contar } from "@/lib/notificacoes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const c = await contar({ loja_id: sessao.loja_id!, user_id: sessao.id });
  return NextResponse.json({ ok: true, ...c });
}
