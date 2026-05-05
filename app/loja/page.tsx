import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PainelLoja() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const r = await pool.query(
    `SELECT loja_id, nome_fantasia, cidade, uf, plano,
            clientes_ativos, clientes_verdes, usuarios_ativos, listas_prospec
       FROM sevenconstruction.v_loja_resumo
      WHERE loja_id = $1`,
    [sessao.loja_id],
  );
  const resumo = r.rows[0] || {
    nome_fantasia: "Sua loja",
    cidade: "—",
    uf: "—",
    plano: "starter",
    clientes_ativos: 0,
    clientes_verdes: 0,
    usuarios_ativos: 1,
    listas_prospec: 0,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">
            Painel da loja
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{resumo.nome_fantasia}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {resumo.cidade} / {resumo.uf} — plano{" "}
            <span className="font-medium text-zinc-200">{resumo.plano}</span>
          </p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Sair
          </button>
        </form>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Clientes ativos" valor={resumo.clientes_ativos} />
        <Stat label="Rating verde" valor={resumo.clientes_verdes} />
        <Stat label="Usuários" valor={resumo.usuarios_ativos} />
        <Stat label="Listas de prospecção" valor={resumo.listas_prospec} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Próximos passos</h2>
        <p className="mt-1 text-sm text-zinc-400">
          F0 (auth/tenant) entregue. F1 (prospecção do bairro) é o próximo passo.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <Tile titulo="Prospecção do bairro" status="em breve" />
          <Tile titulo="Catálogo + cotação" status="em breve" />
          <Tile titulo="Crédito no checkout (FIDC)" status="em breve" />
          <Tile titulo="Consultas & certidões" status="em breve" />
        </ul>
      </section>

      <footer className="mt-12 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">
          ← landing pública
        </Link>
      </footer>
    </main>
  );
}

function Stat({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-zinc-100">{valor}</div>
    </div>
  );
}

function Tile({ titulo, status }: { titulo: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <span className="text-sm">{titulo}</span>
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
        {status}
      </span>
    </div>
  );
}
