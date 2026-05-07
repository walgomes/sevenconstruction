import Link from "next/link";
import { buscarSkusCross, totalParceirosComSkus, topNcms } from "@/lib/skus";
import { TIPOS_PARCEIRO, type TipoParceiro } from "@/lib/parceiros-tipos";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  ncm?: string;
  q?: string;
  uf?: string;
  tipo?: string;
  homologados?: string;
}>;

export default async function SkusPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filtros = {
    ncm: sp.ncm?.trim() || undefined,
    q: sp.q?.trim() || undefined,
    uf: sp.uf?.toUpperCase().slice(0, 2) || undefined,
    tipo_parceiro: sp.tipo as TipoParceiro | undefined,
    apenas_homologados: sp.homologados === "1",
  };

  const temFiltro = !!(filtros.ncm || filtros.q);

  const [resultados, totalParceiros, top] = await Promise.all([
    temFiltro ? buscarSkusCross({ ...filtros, limite: 200 }) : Promise.resolve([]),
    totalParceirosComSkus(),
    topNcms(15),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold">Busca por NCM / produto</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Encontra parceiros que entregam um produto específico. Filtra por NCM (8 dígitos
            ou prefixo), descrição, marca, UF e fase de homologação.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Painel admin
        </Link>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Parceiros com SKU" valor={totalParceiros} cor="text-emerald-300" />
        <Stat label="NCMs distintos" valor={top.length} cor="text-zinc-100" />
        <Stat label="SKUs no resultado" valor={resultados.length} cor="text-rose-300" />
        <Stat label="Filtro ativo" valor={temFiltro ? "sim" : "não"} cor={temFiltro ? "text-amber-300" : "text-zinc-500"} />
      </section>

      <form className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3" method="GET">
        <input
          name="ncm"
          defaultValue={filtros.ncm ?? ""}
          placeholder="NCM (ex: 2523 = cimento)"
          className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none"
        />
        <input
          name="q"
          defaultValue={filtros.q ?? ""}
          placeholder="Descrição, SKU ou marca"
          className="min-w-[220px] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none"
        />
        <input
          name="uf"
          defaultValue={filtros.uf ?? ""}
          placeholder="UF"
          maxLength={2}
          className="w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm placeholder:text-zinc-600"
        />
        <select
          name="tipo"
          defaultValue={filtros.tipo_parceiro ?? ""}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_PARCEIRO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input type="checkbox" name="homologados" value="1" defaultChecked={filtros.apenas_homologados} className="accent-rose-600" />
          Apenas homologados
        </label>
        <button className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500">
          Buscar
        </button>
      </form>

      {!temFiltro && top.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Top NCMs cadastrados (mais parceiros)
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {top.map((t) => (
              <Link
                key={t.ncm}
                href={`/admin/skus?ncm=${t.ncm}`}
                className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-xs hover:border-rose-700/40"
              >
                <span className="font-mono text-zinc-300">{t.ncm}</span>
                <span className="ml-1.5 text-emerald-300">{t.n_parceiros}p</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {temFiltro && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Resultados ({resultados.length})
          </h2>
          {resultados.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
              Nenhum SKU encontrado com esses filtros.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">NCM</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Marca</th>
                    <th className="px-3 py-2">Norma</th>
                    <th className="px-3 py-2">Parceiro</th>
                    <th className="px-3 py-2">UF</th>
                    <th className="px-3 py-2 text-center">Score</th>
                    <th className="px-3 py-2 text-right">Preço ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {resultados.map((s) => {
                    const tipoMeta = TIPOS_PARCEIRO.find((t) => t.valor === s.parceiro_tipo);
                    return (
                      <tr key={s.id} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 font-mono text-xs text-zinc-300">{s.ncm ?? "—"}</td>
                        <td className="px-3 py-2 font-medium text-zinc-100">{s.descricao}</td>
                        <td className="px-3 py-2 text-zinc-400">{s.marca ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400">{s.norma_abnt ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Link href={`/admin/parceiros/${s.parceiro_id}`} className="text-rose-300 hover:underline">
                            {s.parceiro_nome}
                          </Link>
                          <span className={`ml-1.5 rounded px-1 py-0.5 text-[9px] uppercase tracking-wider ${tipoMeta?.cor ?? ""}`}>
                            {tipoMeta?.rotulo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{s.parceiro_uf ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {s.parceiro_trust != null ? (
                            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                              s.parceiro_trust >= 70 ? "bg-emerald-900/40 text-emerald-300"
                              : s.parceiro_trust >= 40 ? "bg-amber-900/40 text-amber-300"
                              : "bg-rose-900/40 text-rose-300"
                            }`}>
                              {s.parceiro_trust}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
                          {s.preco_referencia != null
                            ? `R$ ${Number(s.preco_referencia).toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Stat({ label, valor, cor }: { label: string; valor: number | string; cor?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${cor ?? "text-zinc-100"}`}>
        {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
      </p>
    </div>
  );
}
