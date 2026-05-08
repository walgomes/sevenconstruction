import { NextRequest, NextResponse } from "next/server";
import { lerSessao } from "@/lib/auth";
import { iniciarConversa } from "@/lib/rede-b2b/rede";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  const cnpj = (req.nextUrl.searchParams.get("cnpj") || "").replace(/\D/g, "");
  if (cnpj.length !== 14) return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });

  const r = await pool.query(
    `SELECT c.id, c.cnpj_origem, c.cnpj_alvo, c.decisor_nome, c.decisor_cargo, c.status,
            c.iniciada_em, c.ultima_mensagem_em,
            (SELECT count(*) FROM sevenconstruction.b2b_mensagens m
              WHERE m.conversa_id = c.id AND m.lida = FALSE)::int AS nao_lidas,
            (SELECT conteudo FROM sevenconstruction.b2b_mensagens m
              WHERE m.conversa_id = c.id ORDER BY criada_em DESC LIMIT 1) AS ultima_msg
       FROM sevenconstruction.b2b_conversas c
      WHERE c.cnpj_origem = $1 OR c.cnpj_alvo = $1
      ORDER BY COALESCE(c.ultima_mensagem_em, c.iniciada_em) DESC
      LIMIT 100`,
    [cnpj],
  );
  return NextResponse.json({ conversas: r.rows });
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.cnpj_origem || !body.cnpj_alvo || !body.primeira_mensagem) {
    return NextResponse.json({ error: "campos obrigatorios faltando" }, { status: 400 });
  }
  if (String(body.primeira_mensagem).trim().length < 10) {
    return NextResponse.json({ error: "Mensagem muito curta" }, { status: 400 });
  }
  try {
    const r = await iniciarConversa({
      cnpj_origem: body.cnpj_origem,
      cnpj_alvo: body.cnpj_alvo,
      match_id: body.match_id || undefined,
      decisor_nome: body.decisor_nome || undefined,
      decisor_cargo: body.decisor_cargo || undefined,
      decisor_email: body.decisor_email || undefined,
      decisor_telefone: body.decisor_telefone || undefined,
      primeira_mensagem: String(body.primeira_mensagem),
      remetente_user_id: sessao.id,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
