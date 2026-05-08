import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarSecaoPorSlug, rankingsDaSecao } from "@/lib/secoes-cnae";
import { contarPorSecao } from "@/lib/empresas-cadernos";

export const dynamic = "force-dynamic";

export default async function SecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao: slug } = await params;
  const secao = buscarSecaoPorSlug(slug);
  if (!secao) notFound();

  const counts = await contarPorSecao();
  const total = counts[secao.codigo] ?? 0;
  const rankings = rankingsDaSecao(secao.codigo);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">
          <Link href="/loja/empresas-brasileiras" className="hover:text-amber-300">← Setores</Link>
          {" · Seção "}{secao.codigo}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-3xl">{secao.icone}</span>
          <h1 className="text-2xl font-semibold">{secao.nome}</h1>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {total.toLocaleString("pt-BR")} empresas ativas · {rankings.length} rankings disponíveis
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rankings.map((r) => (
          <Link
            key={r.slug}
            href={`/loja/empresas-brasileiras/${secao.slug}/${r.slug}`}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-amber-500/50 hover:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-amber-400">Ranking</span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                {r.uf ? `UF ${r.uf}` : r.porte ? "Porte" : "Brasil"}
              </span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-zinc-100 group-hover:text-amber-200">{r.rotulo}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Ordenado por {r.ordem === "abertura_desc" ? "data de abertura (mais recente)" : "capital social (maior)"}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
