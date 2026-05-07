import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import { buscarSkusCross } from "@/lib/skus";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try { await exigirSuper(); } catch { return NextResponse.json({ ok: false }, { status: 403 }); }

  const sp = req.nextUrl.searchParams;
  const skus = await buscarSkusCross({
    ncm: sp.get("ncm") || undefined,
    q: sp.get("q") || undefined,
    uf: sp.get("uf") || undefined,
    tipo_parceiro: sp.get("tipo") || undefined,
    apenas_homologados: sp.get("homologados") === "1",
    limite: Number(sp.get("limite") || 100),
  });

  return NextResponse.json({ ok: true, total: skus.length, skus });
}
