import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarSecaoPorSlug, rankingPorSlug } from "@/lib/secoes-cnae";
import { listarPorRanking, formatarCnpj, porteLabel } from "@/lib/empresas-cadernos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = Promise<{ page?: string }>;

export default async function RankingPage({
  params, searchParams,
}: {
  params: Promise<{ secao: string; ranking: string }>;
  searchParams: SearchParams;
}) {
  const { secao: secaoSlug, ranking: rankingSlug } = await params;
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page || "1", 10) || 1, 1);

  const secao = buscarSecaoPorSlug(secaoSlug);
  if (!secao) notFound();
  const ranking = rankingPorSlug(secao.codigo, rankingSlug);
  if (!ranking) notFound();

  const dados = await listarPorRanking(secao.codigo, ranking, page, 50);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">
          <Link href="/loja/empresas-brasileiras" className="hover:text-amber-300">Setores</Link>
          {" · "}
          <Link href={`/loja/empresas-brasileiras/${secao.slug}`} className="hover:text-amber-300">
            {secao.icone} {secao.nome}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{ranking.rotulo}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {dados.total.toLocaleString("pt-BR")} empresas · página {dados.page} de {dados.totalPages.toLocaleString("pt-BR")}
        </p>
      </header>

      {dados.empresas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
          Nenhuma empresa encontrada nessa página.
        </div>
      ) : (
        <>
          <section className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2">Razão social</th>
                  <th className="px-3 py-2">CNPJ</th>
                  <th className="px-3 py-2">CNAE</th>
                  <th className="px-3 py-2">Município/UF</th>
                  <th className="px-3 py-2">Porte</th>
                  <th className="px-3 py-2 text-right">Capital social</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {dados.empresas.map((e, idx) => (
                  <tr key={e.cnpj} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-right font-mono text-zinc-500">
                      {(dados.page - 1) * dados.pageSize + idx + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-100">
                      {e.razao_social || e.nome_fantasia || "—"}
                      {e.nome_fantasia && e.nome_fantasia !== e.razao_social && (
                        <p className="text-[10px] text-zinc-500">{e.nome_fantasia}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{formatarCnpj(e.cnpj)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      <span className="font-mono">{e.cnae_fiscal}</span>
                      {e.cnae_descricao && <p className="line-clamp-1 text-[10px] text-zinc-500">{e.cnae_descricao}</p>}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {e.municipio ?? "—"}{e.uf ? `/${e.uf}` : ""}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{porteLabel(e.porte)}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-100">
                      {e.capital_social != null
                        ? Number(e.capital_social).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Paginador
            base={`/loja/empresas-brasileiras/${secao.slug}/${ranking.slug}`}
            page={dados.page}
            totalPages={dados.totalPages}
          />
        </>
      )}
    </main>
  );
}

function Paginador({ base, page, totalPages }: { base: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const max = totalPages;
  const ant = page > 1 ? page - 1 : null;
  const prox = page < max ? page + 1 : null;

  // Janela de 5 paginas em torno da atual
  const inicio = Math.max(1, page - 2);
  const fim = Math.min(max, inicio + 4);
  const numeros: number[] = [];
  for (let i = inicio; i <= fim; i++) numeros.push(i);

  const item = (n: number, label?: string, ativo?: boolean) => (
    <Link
      key={`${n}-${label ?? ""}`}
      href={`${base}?page=${n}`}
      className={`rounded-md px-3 py-1.5 text-sm ${
        ativo ? "bg-amber-500 text-zinc-950 font-bold"
              : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-500/40 hover:text-amber-200"
      }`}
    >
      {label ?? n}
    </Link>
  );

  return (
    <nav className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {ant ? item(ant, "← Anterior") : <span className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-600">← Anterior</span>}
      {inicio > 1 && (
        <>
          {item(1)}
          {inicio > 2 && <span className="text-zinc-600">…</span>}
        </>
      )}
      {numeros.map((n) => item(n, undefined, n === page))}
      {fim < max && (
        <>
          {fim < max - 1 && <span className="text-zinc-600">…</span>}
          {item(max)}
        </>
      )}
      {prox ? item(prox, "Próxima →") : <span className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-600">Próxima →</span>}
    </nav>
  );
}
