import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import { criarConvite, listarConvites, revogarConvite, type Papel, VALIDADE_DIAS } from "@/lib/convites";
import { enviarEmail, tplConvite } from "@/lib/email";
import pool from "@/lib/db";

export const runtime = "nodejs";

const PAPEIS: Papel[] = ["dono", "gerente", "vendedor"];

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const r = await listarConvites(sessao.loja_id!, true);
  return NextResponse.json({ ok: true, convites: r });
}

export async function POST(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  const meu = await pool.query<{ papel: string; nome: string; loja_nome: string }>(
    `SELECT u.papel, u.nome, l.nome_fantasia AS loja_nome
       FROM sevenconstruction.loja_users u
       JOIN sevenconstruction.lojas l ON l.id = u.loja_id
      WHERE u.id = $1 AND u.loja_id = $2`,
    [sessao.id, sessao.loja_id],
  );
  const eu = meu.rows[0];
  if (!eu || (eu.papel !== "dono" && eu.papel !== "gerente")) {
    return NextResponse.json({ ok: false, motivo: "Apenas dono ou gerente convida" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim();
  const papel = String(b.papel || "vendedor") as Papel;
  if (!PAPEIS.includes(papel)) {
    return NextResponse.json({ ok: false, motivo: "papel invalido" }, { status: 400 });
  }
  // Gerente nao pode convidar dono nem outro gerente
  if (eu.papel === "gerente" && (papel === "dono" || papel === "gerente")) {
    return NextResponse.json({ ok: false, motivo: "Gerente só convida vendedor" }, { status: 403 });
  }

  try {
    const convite = await criarConvite({
      loja_id: sessao.loja_id!,
      email,
      papel,
      criado_por: sessao.id,
    });

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:8800";
    const link = `${proto}://${host}/aceitar-convite?t=${encodeURIComponent(convite.token)}`;

    const tpl = tplConvite({
      nome_loja: eu.loja_nome,
      papel,
      link,
      convidado_por: eu.nome,
      expira_dias: VALIDADE_DIAS,
    });
    enviarEmail({ para: email, assunto: tpl.assunto, html: tpl.html, text: tpl.text }).catch(() => {});

    return NextResponse.json({ ok: true, convite, link });
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await revogarConvite(id, sessao.loja_id!);
  return NextResponse.json({ ok });
}
