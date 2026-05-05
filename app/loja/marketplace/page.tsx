import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

type Resumo = {
  total_lojas: number;
  ofertas_ativas: number;
  demandas_abertas: number;
  transacoes_30d: number;
};

export default async function MarketplacePage() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const r = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM sevenconstruction.lojas WHERE ativo)               AS total_lojas,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_oferta WHERE ativo)         AS ofertas_ativas,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_demanda WHERE status = 'aberta') AS demandas_abertas,
       (SELECT COUNT(*)::int FROM sevenconstruction.b2b_transacao
         WHERE criado_em >= NOW() - INTERVAL '30 days')                              AS transacoes_30d`,
  );
  const resumo = r.rows[0] as Resumo;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Marketplace B2B</p>
          <h1 className="mt-1 text-3xl font-semibold">Lojas parceiras (concorrentes que cooperam)</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            <strong className="text-zinc-200">"Eu não tenho cimento? Você tem? Eu vendo, você entrega, dividimos a margem."</strong>{" "}
            Cada loja publica o que oferece atacado pra outras lojas e o que precisa.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <KPI label="Lojas na rede" valor={resumo.total_lojas} />
        <KPI label="Ofertas ativas" valor={resumo.ofertas_ativas} />
        <KPI label="Demandas abertas" valor={resumo.demandas_abertas} />
        <KPI label="Transações (30d)" valor={resumo.transacoes_30d} />
      </section>

      <section className="mt-8 rounded-xl border border-amber-700/40 bg-amber-950/20 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-300">
          ⚠️ Network effect: precisa de massa crítica
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Esse marketplace só faz sentido com <strong>50+ lojas ativas na mesma região</strong>.
          Hoje somos {resumo.total_lojas} loja{resumo.total_lojas !== 1 ? "s" : ""} —
          a feature está pronta estruturalmente, mas o valor real só aparece conforme novas
          lojas entram no ecossistema.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Modelo de receita: SevenConstruction cobra ~1-3% sobre cada transação fechada via marketplace.
          Loja compradora ganha margem de varejo, fornecedora ganha venda atacado, plataforma ganha taxa.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold">📤 Minhas ofertas atacado</h3>
          <p className="mt-1 text-sm text-zinc-400">
            O que você vende pra outras lojas (cimento, areia, ferragens em volume).
          </p>
          <button
            disabled
            className="mt-4 rounded-md bg-amber-500/30 px-3 py-1.5 text-sm text-zinc-400 cursor-not-allowed"
          >
            + Nova oferta (em breve)
          </button>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold">📥 Minhas demandas</h3>
          <p className="mt-1 text-sm text-zinc-400">
            O que você precisa mas não tem em estoque — outras lojas podem te suprir.
          </p>
          <button
            disabled
            className="mt-4 rounded-md bg-amber-500/30 px-3 py-1.5 text-sm text-zinc-400 cursor-not-allowed"
          >
            + Nova demanda (em breve)
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Roadmap</h3>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          <li>• Schema completo (3 tabelas: oferta, demanda, transacao) — ✅ pronto</li>
          <li>• UI cadastro/busca de ofertas e demandas — em construção</li>
          <li>• Match automático por categoria + raio de entrega — em construção</li>
          <li>• Workflow transação (aceita → em_transito → entregue) — em construção</li>
          <li>• Ledger de comissão da plataforma — em construção</li>
        </ul>
      </section>
    </main>
  );
}

function KPI({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{valor}</div>
    </div>
  );
}
