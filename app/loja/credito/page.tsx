import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { listarParceirosLoja, listarPropostas, lerKpisCredito } from "@/lib/credito";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, { label: string; emoji: string }> = {
  fidc: { label: "FIDC", emoji: "🏦" },
  banco: { label: "Banco", emoji: "🏛️" },
  fintech: { label: "Fintech", emoji: "💸" },
  factoring: { label: "Factoring", emoji: "📑" },
  cooperativa: { label: "Cooperativa", emoji: "🤝" },
  cartao: { label: "Cartão BNPL", emoji: "💳" },
};

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  simulada:   { label: "Simulada",   cor: "bg-zinc-500/10 text-zinc-300 border-zinc-700" },
  enviada:    { label: "Enviada",    cor: "bg-blue-500/10 text-blue-300 border-blue-700/40" },
  analise:    { label: "Em análise", cor: "bg-amber-500/10 text-amber-300 border-amber-700/40" },
  aprovada:   { label: "Aprovada",   cor: "bg-emerald-500/10 text-emerald-300 border-emerald-700/40" },
  efetivada:  { label: "Efetivada",  cor: "bg-emerald-600/20 text-emerald-200 border-emerald-700/60" },
  recusada:   { label: "Recusada",   cor: "bg-red-500/10 text-red-300 border-red-700/40" },
  cancelada:  { label: "Cancelada",  cor: "bg-zinc-500/10 text-zinc-500 border-zinc-700/60" },
};

function fmtBrl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtPct(v: number | null, casas = 2) {
  if (v == null) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export default async function CreditoPage() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  let lojaIdRef: number | null = null;
  if (sessao.role === "loja_user" && sessao.loja_id) lojaIdRef = sessao.loja_id;
  else if (sessao.role === "super") {
    const lr = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    lojaIdRef = lr.rows[0]?.id ?? null;
  } else redirect("/login");

  if (!lojaIdRef) redirect("/login");

  const [parceiros, propostas, kpis] = await Promise.all([
    listarParceirosLoja(lojaIdRef),
    listarPropostas(lojaIdRef, { limite: 25 }),
    lerKpisCredito(lojaIdRef),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Crédito no checkout</p>
          <h1 className="mt-1 text-3xl font-semibold">FIDC + Bancos parceiros</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Compare ofertas de {parceiros.length} parceiros financeiros · acompanhe propostas · feche venda com pagamento parcelado
          </p>
        </div>
        <Link
          href="/loja/credito/simular"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          🔥 Simular nova proposta
        </Link>
      </header>

      {/* KPIs */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Volume total" valor={fmtBrl(kpis.volume_total)} cor="text-zinc-100" />
        <Kpi label="Volume efetivado" valor={fmtBrl(kpis.volume_efetivado)} cor="text-emerald-300" />
        <Kpi label="Comissão estimada" valor={fmtBrl(kpis.comissao_estimada)} cor="text-amber-300" />
        <Kpi label="Taxa média a.a." valor={fmtPct(kpis.taxa_aa_media, 2)} cor="text-zinc-100" />
      </section>

      <section className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-7">
        {(["simulada","enviada","analise","aprovada","efetivada","recusada","cancelada"] as const).map((s) => (
          <KpiPequeno
            key={s}
            label={STATUS_LABEL[s].label}
            valor={kpis.por_status[s] ?? 0}
            cor={STATUS_LABEL[s].cor.split(" ").find((c) => c.startsWith("text-")) ?? "text-zinc-300"}
          />
        ))}
      </section>

      {/* Parceiros */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Parceiros financeiros ativos</h2>
        {parceiros.length === 0 ? (
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
            Nenhum parceiro financeiro vinculado à sua loja. Fale com o admin.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {parceiros.map((p) => {
              const tl = TIPO_LABEL[p.tipo] ?? { label: p.tipo, emoji: "💰" };
              return (
                <article key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">{tl.emoji}</span>
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {tl.label}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">{p.nome}</h3>
                  <dl className="mt-3 space-y-1 text-xs text-zinc-400">
                    <div className="flex justify-between"><dt>Taxa</dt><dd className="text-zinc-200">{fmtPct(p.taxa_minima_aa)} – {fmtPct(p.taxa_maxima_aa)}</dd></div>
                    <div className="flex justify-between"><dt>Prazo</dt><dd className="text-zinc-200">{p.prazo_min_dias}-{p.prazo_max_dias} dias</dd></div>
                    <div className="flex justify-between"><dt>Ticket</dt><dd className="text-zinc-200">{fmtBrl(p.ticket_min)} – {fmtBrl(p.ticket_max)}</dd></div>
                    <div className="flex justify-between"><dt>Comissão loja</dt><dd className="text-emerald-300">{fmtPct(p.comissao_loja_pct)}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Propostas recentes */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Últimas propostas</h2>
        {propostas.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
            Nenhuma proposta ainda — clique em <strong>Simular nova proposta</strong> pra começar.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2">Parceiro</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Prazo</th>
                  <th className="px-3 py-2 text-center">Taxa a.a.</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {propostas.map((p) => {
                  const sm = STATUS_LABEL[p.status] ?? { label: p.status, cor: "bg-zinc-500/10 text-zinc-300 border-zinc-700" };
                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-2 text-right font-mono text-zinc-500">{p.id}</td>
                      <td className="px-3 py-2 text-zinc-200">{p.parceiro_nome ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-100">{fmtBrl(p.valor_solicitado)}</td>
                      <td className="px-3 py-2 text-center text-zinc-400">{p.prazo_dias ? `${p.prazo_dias}d` : "—"}</td>
                      <td className="px-3 py-2 text-center text-zinc-400">{fmtPct(p.taxa_aa_ofertada)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sm.cor}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {new Date(p.criado_em).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
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

function KpiPequeno({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-base font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}
