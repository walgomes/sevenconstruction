import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { gerarMatches } from "@/lib/rede-b2b/rede";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const cnpj = sp.get("cnpj") || "";
  const limite = Math.min(Number(sp.get("limite")) || 50, 500);
  const salvar = sp.get("salvar") === "true";

  if ((cnpj || "").replace(/\D/g, "").length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  try {
    const matches = await gerarMatches(cnpj, { limite, salvar });
    const stats = {
      fit_medio: matches.length
        ? Math.round(matches.reduce((s, m) => s + m.fit_score, 0) / matches.length)
        : 0,
      com_signals_30d: matches.filter((m) => m.signals && m.signals.recentes_30d > 0).length,
      com_perfil_declarado: matches.filter((m) => m.perfil_declarado).length,
      abertos_para_conversa: matches.filter((m) => m.aberto_para_conversas).length,
    };
    return NextResponse.json({ ok: true, matches, stats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
