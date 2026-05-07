import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";
import HeaderLoja from "@/components/HeaderLoja";

export const dynamic = "force-dynamic";

export default async function LojaLayout({ children }: { children: ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  // loja_user: precisa loja_id vinculado.
  // super: pode entrar no painel de qualquer loja — usa a primeira ativa pra
  // exibicao (em prod admin pode ter um seletor de loja).
  let lojaNome = "";
  if (sessao.role === "loja_user") {
    if (!sessao.loja_id) redirect("/login");
    const r = await pool.query(
      `SELECT nome_fantasia FROM sevenconstruction.lojas WHERE id = $1`,
      [sessao.loja_id],
    );
    lojaNome = r.rows[0]?.nome_fantasia ?? "";
  } else if (sessao.role === "super") {
    const r = await pool.query(
      `SELECT nome_fantasia FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    lojaNome = (r.rows[0]?.nome_fantasia ?? "Loja demo") + " (modo super)";
  } else {
    redirect("/login");
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <HeaderLoja lojaNome={lojaNome} />
      </div>
      {children}
    </>
  );
}
