import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import {
  criarParceiro,
  listarParceiros,
  TIPOS_PARCEIRO,
  type TipoParceiro,
} from "@/lib/parceiros";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const tipoRaw = sp.get("tipo");
  const tipo = TIPOS_PARCEIRO.find((t) => t.valor === tipoRaw)?.valor;

  const r = await listarParceiros({
    tipo,
    uf: sp.get("uf") || undefined,
    busca: sp.get("busca") || undefined,
    cnae: sp.get("cnae") || undefined,
    produto: sp.get("produto") || undefined,
    limite: Number(sp.get("limite") ?? 100),
    offset: Number(sp.get("offset") ?? 0),
  });
  return NextResponse.json({ ok: true, parceiros: r });
}

const TIPOS_VALIDOS = new Set<TipoParceiro>(TIPOS_PARCEIRO.map((t) => t.valor));

export async function POST(req: NextRequest) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON invalido" }, { status: 400 });
  }

  const tipo = body.tipo as TipoParceiro;
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json({ ok: false, motivo: "tipo invalido" }, { status: 400 });
  }
  const nome_fantasia = String(body.nome_fantasia ?? "").trim();
  if (!nome_fantasia) {
    return NextResponse.json({ ok: false, motivo: "nome_fantasia obrigatorio" }, { status: 400 });
  }

  const produtos = Array.isArray(body.produtos)
    ? (body.produtos as unknown[]).map(String).filter(Boolean)
    : undefined;

  try {
    const p = await criarParceiro({
      tipo,
      nome_fantasia,
      razao_social:   strOrNull(body.razao_social),
      cnpj:           strOrNull(body.cnpj),
      cnae_principal: strOrNull(body.cnae_principal),
      uf:             strOrNull(body.uf),
      cidade:         strOrNull(body.cidade),
      endereco:       strOrNull(body.endereco),
      cep:            strOrNull(body.cep),
      telefone:       strOrNull(body.telefone),
      whatsapp:       strOrNull(body.whatsapp),
      email:          strOrNull(body.email),
      site:           strOrNull(body.site),
      logo_url:       strOrNull(body.logo_url),
      notas:          strOrNull(body.notas),
      origem:         strOrNull(body.origem) ?? "manual",
      origem_url:     strOrNull(body.origem_url),
      produtos,
    });
    return NextResponse.json({ ok: true, parceiro: p }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, motivo: msg }, { status: 400 });
  }
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}
