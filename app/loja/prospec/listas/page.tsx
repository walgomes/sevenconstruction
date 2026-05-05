import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { listarListasDaLoja } from "@/lib/prospec";

export const dynamic = "force-dynamic";

export default async function ListasPage() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const listas = await listarListasDaLoja(sessao.loja_id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Prospecção</p>
          <h1 className="mt-1 text-3xl font-semibold">Listas salvas</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/loja/prospec"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Nova busca
          </Link>
          <Link
            href="/loja"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Painel
          </Link>
        </div>
      </header>

      {listas.length === 0 && (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhuma lista salva ainda. Faça uma{" "}
          <Link href="/loja/prospec" className="text-amber-400 hover:underline">
            busca de prospecção
          </Link>
          .
        </p>
      )}

      {listas.length > 0 && (
        <ul className="mt-8 space-y-3">
          {listas.map((l) => (
            <li key={l.id}>
              <Link
                href={`/loja/prospec/listas/${l.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/40"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{l.nome}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {l.cidade ? `${l.cidade}/${l.uf}` : (l.uf || "—")}
                      {l.cnaes_alvo?.length ? ` · CNAE ${l.cnaes_alvo.join(", ")}` : ""}
                      {" · "}{new Date(l.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                    {l.total_itens} {l.total_itens === 1 ? "empresa" : "empresas"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
