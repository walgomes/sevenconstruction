import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerKpisSistema } from "@/lib/sistema-loja";

export const dynamic = "force-dynamic";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function SistemaLojaHome() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }
  const k = await lerKpisSistema(sessao.loja_id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Sistema Loja</p>
        <h1 className="mt-1 text-3xl font-semibold">Gestão da loja (ERP)</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Tudo que faz a loja rodar: produtos em estoque, fornecedores, notas fiscais de entrada,
          contas a pagar e a receber, e a base de clientes.
        </p>
      </header>

      {/* KPIs financeiros principais */}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">A receber em aberto</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">{fmtBrl(k.valor_contas_receber)}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {k.contas_receber_abertas} contas
            {k.contas_receber_atrasadas > 0 && (
              <span className="ml-2 text-red-300">⚠️ {k.contas_receber_atrasadas} atrasadas</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-rose-700/30 bg-rose-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-rose-300">A pagar em aberto</div>
          <div className="mt-2 text-3xl font-semibold text-rose-200">{fmtBrl(k.valor_contas_pagar)}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {k.contas_pagar_abertas} contas
            {k.contas_pagar_atrasadas > 0 && (
              <span className="ml-2 text-red-300">⚠️ {k.contas_pagar_atrasadas} atrasadas</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-amber-300">Saldo (a receber − a pagar)</div>
          <div className={`mt-2 text-3xl font-semibold ${
            k.valor_contas_receber - k.valor_contas_pagar >= 0 ? "text-emerald-200" : "text-red-300"
          }`}>
            {fmtBrl(k.valor_contas_receber - k.valor_contas_pagar)}
          </div>
        </div>
      </section>

      {/* 6 sub-modulos */}
      <h2 className="mt-10 text-lg font-semibold">Sub-módulos</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile
          href="/loja/sistema/produtos"
          emoji="📦"
          titulo="Produtos"
          desc="Estoque, preços, NCM"
          stat={`${k.total_produtos} ativos${k.produtos_estoque_baixo > 0 ? ` · ⚠️ ${k.produtos_estoque_baixo} estoque baixo` : ""}`}
          subStat={`Valor estoque (custo): ${fmtBrl(k.valor_estoque_custo)}`}
        />
        <Tile
          href="/loja/sistema/fornecedores"
          emoji="🏭"
          titulo="Fornecedores"
          desc="Quem te abastece"
          stat={`${k.total_fornecedores} cadastrados`}
        />
        <Tile
          href="/loja/sistema/nota-entrada"
          emoji="📥"
          titulo="Notas de entrada"
          desc="NF-e de fornecedor"
          stat={`${k.notas_entrada_30d} nos últimos 30 dias`}
        />
        <Tile
          href="/loja/sistema/conta-pagar"
          emoji="💸"
          titulo="Contas a pagar"
          desc="O que a loja deve"
          stat={`${k.contas_pagar_abertas} abertas`}
          subStat={fmtBrl(k.valor_contas_pagar)}
          alerta={k.contas_pagar_atrasadas > 0 ? `${k.contas_pagar_atrasadas} atrasadas` : null}
        />
        <Tile
          href="/loja/sistema/conta-receber"
          emoji="💰"
          titulo="Contas a receber"
          desc="O que clientes devem"
          stat={`${k.contas_receber_abertas} abertas`}
          subStat={fmtBrl(k.valor_contas_receber)}
          alerta={k.contas_receber_atrasadas > 0 ? `${k.contas_receber_atrasadas} atrasadas` : null}
        />
        <Tile
          href="/loja/clientes-base"
          emoji="👥"
          titulo="Clientes"
          desc="Base + import prospec"
          stat={`${k.total_clientes} ativos`}
        />
      </ul>
    </main>
  );
}

function Tile({
  href, emoji, titulo, desc, stat, subStat, alerta,
}: {
  href: string; emoji: string; titulo: string; desc: string;
  stat: string; subStat?: string; alerta?: string | null;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/40"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold group-hover:text-amber-300">{titulo}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
          <p className="mt-2 text-sm">{stat}</p>
          {subStat && <p className="text-xs text-zinc-400">{subStat}</p>}
          {alerta && (
            <p className="mt-1 text-xs text-red-300">⚠️ {alerta}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
