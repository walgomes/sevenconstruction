import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { listarUsuariosLoja, listarConvites } from "@/lib/convites";
import pool from "@/lib/db";
import GestaoEquipe from "./GestaoEquipe";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  let lojaId: number;
  let papelDoUser = "vendedor";
  if (sessao.role === "loja_user" && sessao.loja_id) {
    lojaId = sessao.loja_id;
    const r = await pool.query<{ papel: string }>(
      `SELECT papel FROM sevenconstruction.loja_users WHERE id = $1`, [sessao.id],
    );
    papelDoUser = r.rows[0]?.papel ?? "vendedor";
  } else if (sessao.role === "super") {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    if (!r.rows[0]) redirect("/login");
    lojaId = r.rows[0].id;
    papelDoUser = "dono";
  } else redirect("/login");

  const [usuarios, convites] = await Promise.all([
    listarUsuariosLoja(lojaId),
    listarConvites(lojaId, true),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">Equipe</p>
        <h1 className="mt-1 text-3xl font-semibold">Usuários da loja</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} ativo{usuarios.length !== 1 ? "s" : ""} ·{" "}
          {convites.length} convite{convites.length !== 1 ? "s" : ""} pendente{convites.length !== 1 ? "s" : ""}
        </p>
      </header>

      <GestaoEquipe
        usuariosIniciais={usuarios as UsuarioRow[]}
        convitesIniciais={convites}
        meuPapel={papelDoUser}
        meuId={sessao.id}
      />

      <p className="mt-8 text-xs text-zinc-600">
        <Link href="/loja" className="hover:text-zinc-400">← Painel da loja</Link>
      </p>
    </main>
  );
}

type UsuarioRow = {
  id: number;
  email: string;
  nome: string;
  papel: string;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
  ultimo_login: string | null;
};
