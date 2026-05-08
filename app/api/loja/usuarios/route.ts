import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { listarUsuariosLoja } from "@/lib/convites";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const r = await listarUsuariosLoja(sessao.loja_id!);
  return NextResponse.json({ ok: true, usuarios: r });
}
