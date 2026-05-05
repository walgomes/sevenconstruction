import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import {
  buscarLicitacoesEnriquecidas,
  type FiltroLicitacoes,
} from "@/lib/licitacoes";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    return NextResponse.json({ ok: false, motivo: "Não autenticado" }, { status: 401 });
  }

  const r = await pool.query(
    `SELECT uf FROM sevenconstruction.lojas WHERE id = $1`,
    [sessao.loja_id],
  );
  const ufLoja = r.rows[0]?.uf || "";

  const url = new URL(req.url);
  const ufParam = url.searchParams.get("uf");
  const uf = (ufParam || ufLoja || "").toUpperCase().slice(0, 2);
  if (!uf || uf.length !== 2) {
    return NextResponse.json(
      { ok: false, motivo: "Informe UF (?uf=BA) ou cadastre UF da loja" },
      { status: 400 },
    );
  }

  const dias = parseInt(url.searchParams.get("dias") || "90", 10);
  const desde = new Date(Date.now() - Math.max(1, Math.min(dias, 365)) * 86400_000)
    .toISOString().slice(0, 10);
  const termo = url.searchParams.get("termo") || undefined;
  const limite = parseInt(url.searchParams.get("limite") || "100", 10);

  const filtro: FiltroLicitacoes = {
    uf,
    desde,
    termo,
    limite: Math.min(Math.max(limite, 1), 200),
  };

  try {
    const r = await buscarLicitacoesEnriquecidas(filtro);
    return NextResponse.json({
      ok: true,
      uf,
      desde,
      total: r.licitacoes.length,
      fonte: r.fonte,
      cache_idade_h: r.cache_idade_h,
      licitacoes: r.licitacoes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[licitacoes-estado] erro fatal:", msg);
    return NextResponse.json(
      { ok: false, motivo: "Falha total ao buscar licitações" },
      { status: 503 },
    );
  }
}
