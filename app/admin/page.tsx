import Link from "next/link";
import { lerKpis } from "@/lib/parceiros";

export const dynamic = "force-dynamic";

export default async function AdminInicio() {
  const k = await lerKpis();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wider text-rose-400">Painel super-admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Comando central</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Áreas internas — invisíveis pra lojas e clientes finais.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/parceiros"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-rose-700/60 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium">Parceiros</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Fornecedores upstream (fábrica, importador, distribuidor, lojista).
              </p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950/40 text-rose-300 group-hover:bg-rose-900/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M3 7l9-4 9 4-9 4-9-4z" />
                <path d="M3 12l9 4 9-4" />
                <path d="M3 17l9 4 9-4" />
              </svg>
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-400">
            <div><dt>Total</dt><dd className="text-base font-semibold text-zinc-100">{k.total.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Ativos</dt><dd className="text-base font-semibold text-emerald-400">{k.ativos.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Estados</dt><dd className="text-base font-semibold text-zinc-100">{k.estados}</dd></div>
          </dl>
        </Link>
      </section>
    </main>
  );
}
