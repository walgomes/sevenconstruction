import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req);
  if (sessao instanceof NextResponse) return sessao;
  const r = await pool.query(
    `SELECT id, nome_fantasia, razao_social, cnpj, email_contato, telefone, whatsapp,
            cep, endereco, numero, bairro, cidade, uf, raio_atuacao_km, plano, ativo
       FROM sevenconstruction.lojas WHERE id = $1`,
    [sessao.loja_id],
  );
  if (!r.rows[0]) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, loja: r.rows[0] });
}

export async function PATCH(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 10 });
  if (sessao instanceof NextResponse) return sessao;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "JSON inválido" }, { status: 400 });
  }

  // Só permite editar campos seguros (não: plano, ativo, id)
  const camposPermitidos = [
    "nome_fantasia", "razao_social", "cnpj", "email_contato", "telefone", "whatsapp",
    "cep", "endereco", "numero", "bairro", "cidade", "uf", "raio_atuacao_km",
  ];
  const sets: string[] = [];
  const params: unknown[] = [sessao.loja_id];
  for (const campo of camposPermitidos) {
    if (campo in body) {
      params.push(body[campo] === "" ? null : body[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    return NextResponse.json({ ok: false, motivo: "Nada a atualizar" }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE sevenconstruction.lojas SET ${sets.join(", ")} WHERE id = $1`,
      params,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[loja/perfil PATCH] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha ao salvar" }, { status: 500 });
  }
}
