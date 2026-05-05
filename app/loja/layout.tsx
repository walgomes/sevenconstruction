import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";
import HeaderLoja from "@/components/HeaderLoja";

export const dynamic = "force-dynamic";

export default async function LojaLayout({ children }: { children: ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const r = await pool.query(
    `SELECT nome_fantasia FROM sevenconstruction.lojas WHERE id = $1`,
    [sessao.loja_id],
  );
  const lojaNome = r.rows[0]?.nome_fantasia ?? "";

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <HeaderLoja lojaNome={lojaNome} />
      </div>
      {children}
    </>
  );
}
