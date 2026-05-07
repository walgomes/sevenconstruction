import { NextRequest, NextResponse } from "next/server";
import { exigirSuper } from "@/lib/auth";
import {
  atualizarParceiro,
  deletarParceiro,
  lerParceiro,
  TIPOS_PARCEIRO,
  type TipoParceiro,
} from "@/lib/parceiros";

export const runtime = "nodejs";

const TIPOS_VALIDOS = new Set<TipoParceiro>(TIPOS_PARCEIRO.map((t) => t.valor));

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const p = await lerParceiro(n);
  if (!p) return NextResponse.json({ ok: false, motivo: "nao encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, parceiro: p });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (body.tipo !== undefined && !TIPOS_VALIDOS.has(body.tipo as TipoParceiro)) {
    return NextResponse.json({ ok: false, motivo: "tipo invalido" }, { status: 400 });
  }

  const p = await atualizarParceiro(n, body as Parameters<typeof atualizarParceiro>[1]);
  if (!p) return NextResponse.json({ ok: false, motivo: "nao encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, parceiro: p });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirSuper();
  } catch {
    return NextResponse.json({ ok: false, motivo: "Apenas super-admin" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await deletarParceiro(n);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
