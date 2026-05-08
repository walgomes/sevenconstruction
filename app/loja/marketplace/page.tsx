import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import {
  listarOfertasLoja, listarDemandasLoja, listarTransacoesLoja, lerKpisMarketplace, COMISSAO_PLATAFORMA_PCT,
} from "@/lib/marketplace";
import pool from "@/lib/db";
import MarketplaceTabs from "./MarketplaceTabs";

export const dynamic = "force-dynamic";

function fmtBrl(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default async function MarketplacePage() {
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

  const [kpis, ofertas, demandas, transacoes] = await Promise.all([
    lerKpisMarketplace(lojaId),
    listarOfertasLoja(lojaId),
    listarDemandasLoja(lojaId),
    listarTransacoesLoja(lojaId, undefined, 50),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Marketplace B2B</p>
          <h1 className="mt-1 text-3xl font-semibold">Lojas parceiras (cross-fulfillment)</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            <strong className="text-zinc-200">&quot;Eu não tenho cimento? Você tem? Eu vendo, você entrega, dividimos.&quot;</strong>{" "}
            Comissão da plataforma: {COMISSAO_PLATAFORMA_PCT}% sobre cada transação fechada.
          </p>
        </div>
        <Link href="/loja" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900">
          ← Painel
        </Link>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Lojas na rede" valor={String(kpis.total_lojas)} cor="text-zinc-100" />
        <Kpi label="Ofertas da rede (excluindo você)" valor={String(kpis.ofertas_rede_total)} cor="text-amber-300" />
        <Kpi label="Volume 30d (compras)" valor={fmtBrl(kpis.volume_30d_compras)} cor="text-emerald-300" />
        <Kpi label="Volume 30d (vendas)" valor={fmtBrl(kpis.volume_30d_vendas)} cor="text-violet-300" />
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-3">
        <Kpi label="Minhas ofertas ativas" valor={String(kpis.ofertas_ativas_loja)} cor="text-zinc-200" />
        <Kpi label="Minhas demandas abertas" valor={String(kpis.demandas_abertas_loja)} cor="text-zinc-200" />
        <Kpi label="Comissão SC 30d" valor={fmtBrl(kpis.comissao_plataforma_30d)} cor="text-rose-300" />
      </section>

      <MarketplaceTabs
        ofertasIniciais={ofertas}
        demandasIniciais={demandas}
        transacoesIniciais={transacoes}
      />
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
