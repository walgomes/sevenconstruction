import Link from "next/link";
import {
  lerKpis,
  lerDashboardSrm,
  listarParceiros,
  listarUfs,
  TIPOS_PARCEIRO,
  type TipoParceiro,
  type Parceiro,
} from "@/lib/parceiros";
import KanbanView from "./KanbanView";
import AnalisarLoteBtn from "./AnalisarLoteBtn";

export const dynamic = "force-dynamic";

type Vista = "cards" | "tabela" | "kanban";

type SearchParams = Promise<{
  vista?: string;
  tipo?: string;
  uf?: string;
  busca?: string;
  cnae?: string;
  produto?: string;
}>;

export default async function ParceirosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const vista: Vista =
    sp.vista === "tabela" ? "tabela" : sp.vista === "kanban" ? "kanban" : "cards";

  const tipo = TIPOS_PARCEIRO.find((t) => t.valor === sp.tipo)?.valor;
  const uf = sp.uf?.toUpperCase().slice(0, 2);
  const filtros = {
    tipo,
    uf,
    busca: sp.busca?.trim() || undefined,
    cnae: sp.cnae?.replace(/\D+/g, "").slice(0, 7) || undefined,
    produto: sp.produto?.trim() || undefined,
  };

  const [k, parceiros, ufs, srm] = await Promise.all([
    lerKpis(),
    listarParceiros({ ...filtros, limite: vista === "kanban" ? 1000 : 200 }),
    listarUfs(),
    lerDashboardSrm(),
  ]);

  function hrefVista(v: Vista): string {
    const params = new URLSearchParams();
    if (filtros.tipo) params.set("tipo", filtros.tipo);
    if (filtros.uf) params.set("uf", filtros.uf);
    if (filtros.busca) params.set("busca", filtros.busca);
    if (filtros.cnae) params.set("cnae", filtros.cnae);
    if (filtros.produto) params.set("produto", filtros.produto);
    params.set("vista", v);
    return `/admin/parceiros?${params.toString()}`;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold">Parceiros</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Fornecedores upstream — código interno a partir de 150.000.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AnalisarLoteBtn />
          <Link
            href="/admin/parceiros/novo"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:border-zinc-500"
          >
            + Novo parceiro
          </Link>
          <Link
            href="/admin/parceiros/importar"
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
          >
            Importar lista
          </Link>
        </div>
      </header>

      <KpisRow k={k} />

      <FiltrosBar
        ufs={ufs}
        filtros={filtros}
        vista={vista}
        hrefVista={hrefVista}
      />

      {vista === "kanban" ? (
        <KanbanView parceiros={parceiros} kpisSrm={srm.kpis} />
      ) : parceiros.length === 0 ? (
        <Vazio />
      ) : vista === "cards" ? (
        <GradeCards parceiros={parceiros} />
      ) : (
        <Tabela parceiros={parceiros} />
      )}
    </main>
  );
}

function KpisRow({ k }: { k: Awaited<ReturnType<typeof lerKpis>> }) {
  const items = [
    { rotulo: "Total",        valor: k.total,        cor: "text-zinc-100" },
    { rotulo: "Fábrica",      valor: k.fabrica,      cor: "text-blue-300" },
    { rotulo: "Importador",   valor: k.importador,   cor: "text-purple-300" },
    { rotulo: "Distribuidor", valor: k.distribuidor, cor: "text-emerald-300" },
    { rotulo: "Lojista",      valor: k.lojista,      cor: "text-amber-300" },
    { rotulo: "Outros",       valor: k.outros,       cor: "text-zinc-300" },
  ];
  return (
    <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((i) => (
        <div key={i.rotulo} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{i.rotulo}</p>
          <p className={`mt-0.5 text-lg font-semibold ${i.cor}`}>{i.valor.toLocaleString("pt-BR")}</p>
        </div>
      ))}
    </section>
  );
}

function FiltrosBar({
  ufs,
  filtros,
  vista,
  hrefVista,
}: {
  ufs: string[];
  filtros: { tipo?: TipoParceiro; uf?: string; busca?: string; cnae?: string; produto?: string };
  vista: Vista;
  hrefVista: (v: Vista) => string;
}) {
  return (
    <section className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <form className="flex flex-1 flex-wrap items-center gap-2" method="GET">
        <input type="hidden" name="vista" value={vista} />
        <input
          name="busca"
          defaultValue={filtros.busca ?? ""}
          placeholder="Buscar por nome ou CNPJ"
          className="min-w-[180px] flex-1 rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-sm placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none"
        />
        <select
          name="tipo"
          defaultValue={filtros.tipo ?? ""}
          className="rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_PARCEIRO.map((t) => (
            <option key={t.valor} value={t.valor}>{t.rotulo}</option>
          ))}
        </select>
        <select
          name="uf"
          defaultValue={filtros.uf ?? ""}
          className="rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1.5 text-sm"
        >
          <option value="">Todas UFs</option>
          {ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          name="cnae"
          defaultValue={filtros.cnae ?? ""}
          placeholder="CNAE"
          className="w-24 rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1.5 text-sm placeholder:text-zinc-600"
        />
        <input
          name="produto"
          defaultValue={filtros.produto ?? ""}
          placeholder="Produto"
          className="w-32 rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1.5 text-sm placeholder:text-zinc-600"
        />
        <button className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:border-zinc-500">
          Filtrar
        </button>
      </form>

      <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950/40 p-0.5">
        <ToggleVista vista={vista} alvo="cards" hrefVista={hrefVista} icone={<IconeCards />} label="Cards" />
        <ToggleVista vista={vista} alvo="tabela" hrefVista={hrefVista} icone={<IconeTabela />} label="Tabela" />
        <ToggleVista vista={vista} alvo="kanban" hrefVista={hrefVista} icone={<IconeKanban />} label="Kanban" />
      </div>
    </section>
  );
}

function ToggleVista({
  vista, alvo, hrefVista, icone, label,
}: {
  vista: Vista; alvo: Vista; hrefVista: (v: Vista) => string; icone: React.ReactNode; label: string;
}) {
  const ativo = vista === alvo;
  return (
    <Link
      href={hrefVista(alvo)}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
        ativo ? "bg-rose-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
      title={`Visualizar como ${label.toLowerCase()}`}
    >
      {icone}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function IconeCards() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconeTabela() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 14h18" />
      <path d="M9 4v16" />
    </svg>
  );
}

function IconeKanban() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="3" width="5" height="18" rx="1.5" />
      <rect x="10" y="3" width="5" height="12" rx="1.5" />
      <rect x="17" y="3" width="4" height="8" rx="1.5" />
    </svg>
  );
}

function GradeCards({ parceiros }: { parceiros: Parceiro[] }) {
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {parceiros.map((p) => (
        <CardParceiro key={p.id} p={p} />
      ))}
    </section>
  );
}

function CardParceiro({ p }: { p: Parceiro }) {
  const meta = TIPOS_PARCEIRO.find((t) => t.valor === p.tipo);
  return (
    <Link
      href={`/admin/parceiros/${p.id}`}
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-rose-700/50 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between">
        <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta?.cor ?? ""}`}>
          {meta?.rotulo ?? p.tipo}
        </span>
        <span className="font-mono text-xs text-zinc-500">#{p.codigo}</span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-100">{p.nome_fantasia}</h3>
      {p.razao_social && p.razao_social !== p.nome_fantasia && (
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{p.razao_social}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
        {p.cidade && p.uf && <span>{p.cidade}/{p.uf}</span>}
        {!p.cidade && p.uf && <span>{p.uf}</span>}
        {p.cnae_principal && <span>CNAE {formatarCnae(p.cnae_principal)}</span>}
        {p.cnpj && <span>{formatarCnpj(p.cnpj)}</span>}
      </div>
      {p.produtos && p.produtos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.produtos.slice(0, 4).map((pr) => (
            <span key={pr} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {pr}
            </span>
          ))}
          {p.produtos.length > 4 && (
            <span className="text-[10px] text-zinc-500">+{p.produtos.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function Tabela({ parceiros }: { parceiros: Parceiro[] }) {
  return (
    <section className="mt-5 overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Código</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Nome fantasia</th>
            <th className="px-3 py-2 font-medium">CNPJ</th>
            <th className="px-3 py-2 font-medium">CNAE</th>
            <th className="px-3 py-2 font-medium">UF</th>
            <th className="px-3 py-2 font-medium">Cidade</th>
            <th className="px-3 py-2 font-medium">Telefone</th>
            <th className="px-3 py-2 font-medium">Site</th>
            <th className="px-3 py-2 font-medium">Produtos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {parceiros.map((p) => {
            const meta = TIPOS_PARCEIRO.find((t) => t.valor === p.tipo);
            return (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-mono text-zinc-300">
                  <Link href={`/admin/parceiros/${p.id}`} className="hover:text-rose-300">
                    {p.codigo}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta?.cor ?? ""}`}>
                    {meta?.rotulo ?? p.tipo}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-zinc-100">{p.nome_fantasia}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                  {p.cnpj ? formatarCnpj(p.cnpj) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                  {p.cnae_principal ? formatarCnae(p.cnae_principal) : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">{p.uf ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{p.cidade ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{p.telefone ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {p.site ? (
                    <a
                      href={p.site}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-rose-300"
                    >
                      {p.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {p.produtos && p.produtos.length > 0
                    ? `${p.produtos.length} cadastrados`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Vazio() {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
      <p className="text-zinc-400">Nenhum parceiro cadastrado ainda.</p>
      <p className="mt-1 text-sm text-zinc-500">
        Comece adicionando manualmente em <strong>+ Novo parceiro</strong> ou
        importando uma lista via <strong>Importar lista</strong>.
      </p>
    </div>
  );
}

function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D+/g, "").padStart(14, "0");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

function formatarCnae(cnae: string): string {
  const d = cnae.replace(/\D+/g, "").padStart(7, "0");
  return `${d.slice(0,4)}-${d.slice(4,5)}/${d.slice(5,7)}`;
}
