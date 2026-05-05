import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerResumoComissoes, listarEventosComissao } from "@/lib/comissoes";

export const dynamic = "force-dynamic";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

function statusColor(s: string) {
  switch (s) {
    case "aprovada": return "bg-emerald-500/10 text-emerald-300";
    case "pendente": return "bg-amber-500/10 text-amber-300";
    case "cancelada":
    case "estornada": return "bg-red-500/10 text-red-300";
    default: return "bg-zinc-500/10 text-zinc-400";
  }
}

export default async function ComissoesPage() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const [resumo, eventos] = await Promise.all([
    lerResumoComissoes(sessao.loja_id),
    listarEventosComissao(sessao.loja_id, 50),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Receita</p>
          <h1 className="mt-1 text-3xl font-semibold">Comissões</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Tudo que você ganhou revendendo serviços digitais aos seus clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/comissoes/csv"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            Baixar CSV
          </a>
          <Link
            href="/loja"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Painel
          </Link>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">Comissões no mês</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">{fmtBrl(resumo.total_mes)}</div>
          <div className="mt-1 text-xs text-zinc-400">{resumo.qtd_eventos_mes} vendas</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Acumulado total</div>
          <div className="mt-2 text-3xl font-semibold">{fmtBrl(resumo.total_acumulado)}</div>
          <div className="mt-1 text-xs text-zinc-400">{resumo.qtd_eventos_total} vendas</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Ticket médio</div>
          <div className="mt-2 text-3xl font-semibold">{fmtBrl(resumo.ticket_medio)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Vendas / mês</div>
          <div className="mt-2 text-3xl font-semibold">{resumo.qtd_eventos_mes}</div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Últimas 50 transações</h2>
        {eventos.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-500 py-12">
            Nenhuma comissão registrada ainda. Quando você vender um serviço digital ao seu cliente
            (certidão, consulta, clube, etc), o evento aparece aqui.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Serviço</th>
                  <th className="px-3 py-2 text-right">Venda</th>
                  <th className="px-3 py-2 text-right">Comissão</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                    <td className="px-3 py-2 text-xs text-zinc-400 whitespace-nowrap">{fmtData(e.criado_em)}</td>
                    <td className="px-3 py-2">{e.cliente_nome || <span className="text-zinc-500">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.servico_nome || e.servico_codigo}</div>
                      {e.descricao && <div className="text-xs text-zinc-500">{e.descricao}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtBrl(e.valor_venda)}</td>
                    <td className="px-3 py-2 text-right font-medium text-amber-300">{fmtBrl(e.comissao_loja)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(e.status)}`}>
                        {e.status}
                      </span>
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
