import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerKpis, topClientes, PONTO_VALOR_REAIS } from "@/lib/fidelizacao";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

export default async function FidelizacaoPage() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  let lojaId: number;
  if (sessao.role === "loja_user" && sessao.loja_id) lojaId = sessao.loja_id;
  else if (sessao.role === "super") {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    if (!r.rows[0]) redirect("/login");
    lojaId = r.rows[0].id;
  } else redirect("/login");

  const [kpis, top] = await Promise.all([
    lerKpis(lojaId),
    topClientes(lojaId, 20),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">Fidelização</p>
        <h1 className="mt-1 text-3xl font-semibold">Clube de Pontos</h1>
        <p className="mt-1 text-sm text-zinc-400">
          1 ponto por R$ 1 em compras · 1 ponto = R$ 0,01 no resgate · Indicação rende 50 pts pra cada lado quando o indicado comprar R$ 50+
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Clientes no clube" valor={kpis.clientes_no_clube.toLocaleString("pt-BR")} cor="text-zinc-100" />
        <Kpi label="Pontos em circulação" valor={kpis.pontos_em_circulacao.toLocaleString("pt-BR")} cor="text-amber-300" />
        <Kpi label="Passivo (resgatável)" valor={fmtBrl(kpis.passivo_brl)} cor="text-rose-300" />
        <Kpi label="Distribuídos / Resgatados" valor={`${kpis.pontos_distribuidos.toLocaleString("pt-BR")} / ${kpis.pontos_resgatados.toLocaleString("pt-BR")}`} cor="text-zinc-200" />
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-2">
        <Kpi label="Indicações efetivas" valor={kpis.indicacoes_efetivas.toLocaleString("pt-BR")} cor="text-emerald-300" />
        <Kpi label="Indicações pendentes" valor={kpis.indicacoes_pendentes.toLocaleString("pt-BR")} cor="text-amber-300" />
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Top 20 clientes</h2>
          <Link href="/loja/clientes-base" className="text-xs text-amber-400 hover:text-amber-300">
            ver todos clientes →
          </Link>
        </div>
        {top.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
            Nenhum cliente cadastrado ainda. Importe a base ou cadastre o primeiro em <strong>/loja/clientes-base</strong>.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">CNPJ/CPF</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">Resgatável</th>
                  <th className="px-3 py-2 text-right">Total ganho</th>
                  <th className="px-3 py-2">Última compra</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {top.map((c, idx) => (
                  <tr key={c.cliente_id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-right font-mono text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-zinc-100">{c.nome_razao}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{c.cnpj || c.cpf || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">{c.saldo.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">{fmtBrl(c.saldo * PONTO_VALOR_REAIS)}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{c.total_ganho.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {c.ultima_compra_em ? new Date(c.ultima_compra_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/loja/fidelizacao/${c.cliente_id}`} className="text-xs text-amber-400 hover:text-amber-300">
                        gerir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}
