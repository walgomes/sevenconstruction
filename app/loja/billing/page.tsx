import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerAssinatura, listarPlanos } from "@/lib/billing";
import pool from "@/lib/db";
import BotoesBilling from "./BotoesBilling";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  trialing:   { label: "Período de teste",  cor: "bg-blue-500/15 text-blue-300 border-blue-700/40" },
  active:     { label: "Ativa",             cor: "bg-emerald-500/15 text-emerald-300 border-emerald-700/40" },
  past_due:   { label: "Em atraso",         cor: "bg-amber-500/15 text-amber-300 border-amber-700/40" },
  unpaid:     { label: "Não paga",          cor: "bg-rose-500/15 text-rose-300 border-rose-700/40" },
  canceled:   { label: "Cancelada",         cor: "bg-zinc-500/15 text-zinc-400 border-zinc-700" },
  incomplete: { label: "Pagamento pendente", cor: "bg-amber-500/15 text-amber-300 border-amber-700/40" },
};

function fmtBrl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

type SearchParams = Promise<{ ok?: string; cancelled?: string }>;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
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

  const [assinatura, planos] = await Promise.all([
    lerAssinatura(lojaId),
    listarPlanos(),
  ]);

  const stripeConfigurado = !!process.env.STRIPE_SECRET_KEY;
  const planoAtual = assinatura?.plano_codigo;
  const sm = assinatura ? STATUS_LABEL[assinatura.status] ?? { label: assinatura.status, cor: "bg-zinc-500/15 text-zinc-300" } : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">Assinatura</p>
        <h1 className="mt-1 text-3xl font-semibold">Plano e cobrança</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Gerencie sua assinatura, atualize cartão, baixe NF e mude de plano a qualquer momento.
        </p>
      </header>

      {sp.ok === "1" && (
        <div className="mb-4 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">
          ✓ Assinatura concluída! Pode levar alguns segundos pra refletir aqui.
        </div>
      )}
      {sp.cancelled === "1" && (
        <div className="mb-4 rounded-md border border-amber-700/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          Pagamento cancelado. Sua loja continua no plano atual.
        </div>
      )}
      {!stripeConfigurado && (
        <div className="mb-4 rounded-md border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-400">
          ℹ️ Stripe ainda não configurado nesta instância. UI funcional, checkout retornará erro até as
          env vars <code className="rounded bg-zinc-800 px-1">STRIPE_SECRET_KEY</code>,{" "}
          <code className="rounded bg-zinc-800 px-1">STRIPE_PRICE_*</code> e{" "}
          <code className="rounded bg-zinc-800 px-1">STRIPE_WEBHOOK_SECRET</code> serem definidas.
        </div>
      )}

      {/* Assinatura atual */}
      {assinatura && sm && (
        <section className={`rounded-2xl border-2 p-6 ${sm.cor}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-80">Plano atual</p>
              <h2 className="mt-1 text-2xl font-semibold">
                {assinatura.plano_nome ?? "—"}
                {assinatura.preco_mensal_centavos != null && (
                  <span className="ml-2 text-base font-normal opacity-80">
                    {fmtBrl(assinatura.preco_mensal_centavos)}/mês
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm">
                Status: <strong className="uppercase">{sm.label}</strong>
                {assinatura.dias_restantes > 0 && assinatura.status === "trialing" && (
                  <> · {assinatura.dias_restantes} dias restantes do trial</>
                )}
                {assinatura.cancelar_no_fim_periodo && (
                  <> · cancelando ao fim do período</>
                )}
              </p>
            </div>
            <BotoesBilling stripeConfigurado={stripeConfigurado} planoAtualCodigo={planoAtual} />
          </div>

          {assinatura.features && assinatura.features.length > 0 && (
            <div className="mt-5 border-t border-current/20 pt-4">
              <p className="text-xs uppercase tracking-wider opacity-80 mb-2">Features inclusas</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {assinatura.features.map((f, i) => <li key={i}>✓ {f}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Comparativo de planos */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Mudar de plano</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {planos.map((p) => {
            const ehAtual = planoAtual === p.codigo;
            const destaque = p.codigo === "pro";
            return (
              <article key={p.id}
                className={`rounded-xl border p-5 ${
                  ehAtual ? "border-emerald-500/60 bg-emerald-950/15"
                  : destaque ? "border-amber-500/60 bg-amber-950/15"
                  : "border-zinc-800 bg-zinc-900/40"
                }`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-zinc-100">{p.nome}</h3>
                  {destaque && (
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950">
                      Mais popular
                    </span>
                  )}
                </div>
                <p className="mt-3 text-3xl font-black text-amber-300">
                  {fmtBrl(p.preco_mensal_centavos)}<span className="text-base font-normal text-zinc-400">/mês</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">{p.trial_dias} dias de teste grátis</p>
                <ul className="mt-4 space-y-1 text-xs text-zinc-300">
                  {p.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                </ul>
                <div className="mt-5">
                  {ehAtual ? (
                    <span className="inline-block rounded bg-emerald-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      ✓ Plano atual
                    </span>
                  ) : (
                    <BotoesBilling stripeConfigurado={stripeConfigurado} planoAtualCodigo={planoAtual} alvoPlano={p.codigo} />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-600">
        <Link href="/loja" className="hover:text-zinc-400">← Painel da loja</Link>
      </p>
    </main>
  );
}
