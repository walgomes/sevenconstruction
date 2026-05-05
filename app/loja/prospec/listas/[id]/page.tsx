import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerListaComItens } from "@/lib/prospec";

export const dynamic = "force-dynamic";

function formatCnpj(cnpj: string) {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export default async function DetalheListaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const { id } = await params;
  const lista_id = parseInt(id, 10);
  if (!Number.isFinite(lista_id)) notFound();

  const dados = await lerListaComItens(lista_id, sessao.loja_id);
  if (!dados) notFound();
  const { lista, itens } = dados;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Lista de prospecção</p>
          <h1 className="mt-1 text-3xl font-semibold">{lista.nome}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {lista.cidade ? `${lista.cidade}/${lista.uf}` : (lista.uf || "—")}
            {lista.cnaes_alvo?.length ? ` · CNAE ${lista.cnaes_alvo.join(", ")}` : ""}
            {` · ${lista.total_itens} ${lista.total_itens === 1 ? "empresa" : "empresas"}`}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/prospec/listas/${lista.id}/csv`}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            Baixar CSV
          </a>
          <Link
            href="/loja/prospec/listas"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Listas
          </Link>
        </div>
      </header>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">CNPJ / Razão social</th>
              <th className="px-3 py-2">CNAE</th>
              <th className="px-3 py-2">Cidade/UF</th>
              <th className="px-3 py-2">Bairro</th>
              <th className="px-3 py-2">Porte</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((e) => (
              <tr
                key={e.cnpj}
                className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50"
              >
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {e.razao_social || <span className="text-zinc-500">—</span>}
                  </div>
                  <div className="text-xs text-zinc-500">{formatCnpj(e.cnpj)}</div>
                </td>
                <td className="px-3 py-2">{e.cnae}</td>
                <td className="px-3 py-2">
                  {e.cidade ? `${e.cidade}/${e.uf}` : (e.uf || "—")}
                </td>
                <td className="px-3 py-2">{e.bairro || <span className="text-zinc-500">—</span>}</td>
                <td className="px-3 py-2">{e.porte || <span className="text-zinc-500">—</span>}</td>
                <td className="px-3 py-2">
                  {e.telefone || <span className="text-zinc-500">—</span>}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate">
                  {e.email || <span className="text-zinc-500">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
