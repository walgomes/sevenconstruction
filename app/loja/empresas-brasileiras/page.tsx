import Link from "next/link";
import { SECOES_CNAE, rankingsDaSecao, type SecaoCnae } from "@/lib/secoes-cnae";
import { contarPorSecao } from "@/lib/empresas-cadernos";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; ordem?: string; vista?: string }>;

export default async function EmpresasBrasileirasPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim().toLowerCase();
  const ordem = sp.ordem || "mais";
  const vista: "cards" | "lista" = sp.vista === "lista" ? "lista" : "cards";

  const counts = await contarPorSecao();

  let setores = SECOES_CNAE.map((s) => ({
    ...s,
    n_empresas: counts[s.codigo] ?? 0,
    n_rankings: rankingsDaSecao(s.codigo).length,
  }));

  if (q) setores = setores.filter((s) => s.nome.toLowerCase().includes(q));
  switch (ordem) {
    case "az":     setores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")); break;
    case "za":     setores.sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR")); break;
    case "menos":  setores.sort((a, b) => a.n_empresas - b.n_empresas); break;
    case "mais":
    default:       setores.sort((a, b) => b.n_empresas - a.n_empresas); break;
  }

  const totalEmpresas = setores.reduce((s, x) => s + x.n_empresas, 0);
  const totalRankings = setores.reduce((s, x) => s + x.n_rankings, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">Diretório</p>
        <h1 className="mt-1 text-2xl font-semibold">Empresas brasileiras por setor</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {totalEmpresas.toLocaleString("pt-BR")} empresas ativas em{" "}
          {SECOES_CNAE.length} setores · {totalRankings} páginas de rankings
        </p>
      </header>

      <form className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar setor"
          className="min-w-[220px] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
        <select
          name="ordem"
          defaultValue={ordem}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="mais">Mais empresas</option>
          <option value="menos">Menos empresas</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
        <select
          name="vista"
          defaultValue={vista}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="cards">Cards</option>
          <option value="lista">Lista compacta</option>
        </select>
        <button className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400">
          Filtrar
        </button>
      </form>

      {setores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
          Nenhum setor encontrado pra &quot;{q}&quot;.
        </div>
      ) : vista === "cards" ? (
        <CardsSetores setores={setores} />
      ) : (
        <ListaSetores setores={setores} />
      )}
    </main>
  );
}

type SetorCard = SecaoCnae & { n_empresas: number; n_rankings: number };

function CardsSetores({ setores }: { setores: SetorCard[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {setores.map((s) => (
        <Link
          key={s.codigo}
          href={`/loja/empresas-brasileiras/${s.slug}`}
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-amber-500/50 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl">{s.icone}</span>
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              {s.codigo}
            </span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-sm font-semibold text-zinc-100 group-hover:text-amber-200">{s.nome}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div>
              <dt>Empresas</dt>
              <dd className="text-base font-semibold text-zinc-100">{s.n_empresas.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Rankings</dt>
              <dd className="text-base font-semibold text-zinc-300">{s.n_rankings}</dd>
            </div>
          </dl>
        </Link>
      ))}
    </section>
  );
}

function ListaSetores({ setores }: { setores: SetorCard[] }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-2">Cód</th>
            <th className="px-3 py-2">Setor</th>
            <th className="px-3 py-2 text-right">Empresas</th>
            <th className="px-3 py-2 text-right">Rankings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {setores.map((s) => (
            <tr key={s.codigo} className="hover:bg-zinc-900/40">
              <td className="px-3 py-2 font-mono text-amber-300">{s.codigo}</td>
              <td className="px-3 py-2">
                <Link href={`/loja/empresas-brasileiras/${s.slug}`} className="hover:text-amber-200">
                  <span className="mr-2">{s.icone}</span>
                  {s.nome}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-100">{s.n_empresas.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-2 text-right text-zinc-400">{s.n_rankings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
