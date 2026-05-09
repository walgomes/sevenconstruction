import Link from "next/link";
import { lerKpis, lerDashboardSrm } from "@/lib/parceiros";
import {
  lerReceitaSc, lerKpisLojas, lerTopLojas, lerFunilCadastro, lerKpisOperacionais,
} from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtBrlCent(centavos: number) { return fmtBrl(centavos / 100); }

export default async function AdminInicio() {
  const [k, srm, receita, kpisLojas, topLojas, funil, opers] = await Promise.all([
    lerKpis(),
    lerDashboardSrm(),
    lerReceitaSc(),
    lerKpisLojas(),
    lerTopLojas(10),
    lerFunilCadastro(),
    lerKpisOperacionais(),
  ]);
  const kp = srm.kpis as Record<string, number | null>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wider text-rose-400">Painel super-admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Comando central</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Visão consolidada do negócio SC — invisível pra lojas e clientes finais.
        </p>
      </header>

      {/* === RECEITA === */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-emerald-400">💰 Receita SC</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <KpiBig label="MRR (assinaturas active+trial)" valor={fmtBrlCent(receita.mrr_centavos)} cor="text-emerald-300" />
          <KpiBig label="Comissão marketplace 30d" valor={fmtBrl(receita.comissao_marketplace_30d)} cor="text-amber-300" />
          <KpiBig label="Comissão crédito 30d" valor={fmtBrl(receita.comissao_credito_30d)} cor="text-violet-300" />
          <KpiBig label="Total estimado 30d" valor={fmtBrl(receita.total_30d_brl)} cor="text-emerald-200" />
        </div>
      </section>

      {/* === LOJAS === */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-amber-400">🏪 Lojas na plataforma</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Painel rotulo="Total" valor={kpisLojas.total} cor="text-zinc-100" />
          <Painel rotulo="Active (paga)" valor={kpisLojas.active} cor="text-emerald-300" />
          <Painel rotulo="Trial" valor={kpisLojas.trial} cor="text-blue-300" />
          <Painel rotulo="Churn" valor={kpisLojas.churned} cor="text-rose-300" />
          <Painel rotulo="Novas 7d" valor={kpisLojas.novas_7d} cor="text-amber-300" />
          <Painel rotulo="Novas 30d" valor={kpisLojas.novas_30d} cor="text-amber-200" />
        </div>
        {Object.keys(kpisLojas.por_plano).length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(kpisLojas.por_plano).map(([codigo, n]) => (
              <Painel key={codigo} rotulo={`Plano ${codigo}`} valor={n} cor="text-zinc-300" />
            ))}
          </div>
        )}
      </section>

      {/* === FUNIL === */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-violet-400">📊 Funil cadastro → trial → paid</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <Painel rotulo="Cadastros 30d" valor={funil.cadastros_30d} cor="text-zinc-100" />
          <Painel rotulo="Cadastros 7d" valor={funil.cadastros_7d} cor="text-zinc-100" />
          <Painel rotulo="Trial ativos" valor={funil.trial_ativos} cor="text-blue-300" />
          <Painel rotulo="Paid ativos" valor={funil.paid_ativos} cor="text-emerald-300" />
          <Painel rotulo="Trial → Paid" valor={`${funil.conv_trial_pra_paid_pct}%`} cor="text-amber-300" />
        </div>
      </section>

      {/* === OPERACIONAL === */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-cyan-400">⚙️ Operacional 30d</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Painel rotulo="Parceiros homologados" valor={`${opers.parceiros_homologados}/${opers.parceiros_total}`} cor="text-emerald-300" />
          <Painel rotulo="Transações marketplace" valor={opers.transacoes_marketplace_30d} cor="text-amber-300" />
          <Painel rotulo="Volume marketplace" valor={fmtBrl(opers.volume_marketplace_30d)} cor="text-amber-200" />
          <Painel rotulo="Propostas crédito (efet/total)" valor={`${opers.propostas_efetivadas_30d}/${opers.propostas_credito_30d}`} cor="text-violet-300" />
          <Painel rotulo="Clientes no clube" valor={opers.clientes_no_clube} cor="text-rose-300" />
          <Painel rotulo="Pontos em circulação" valor={opers.pontos_em_circulacao.toLocaleString("pt-BR")} cor="text-rose-200" />
        </div>
      </section>

      {/* === TOP LOJAS === */}
      {topLojas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-amber-400">🏆 Top {topLojas.length} lojas (volume 30d)</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2">Loja</th>
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Volume 30d</th>
                  <th className="px-3 py-2 text-right">Clientes</th>
                  <th className="px-3 py-2">Último login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {topLojas.map((l, idx) => (
                  <tr key={l.loja_id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-right font-mono text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-100">{l.nome_fantasia}</p>
                      <p className="text-[10px] text-zinc-500">{l.cidade}{l.uf && `/${l.uf}`}</p>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase tracking-wider text-amber-300">{l.plano}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                        l.status === "active" ? "bg-emerald-500/15 text-emerald-300"
                        : l.status === "trialing" ? "bg-blue-500/15 text-blue-300"
                        : "bg-zinc-500/15 text-zinc-400"
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-100">{fmtBrl(l.volume_30d)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{l.clientes_total}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {l.ultimo_login ? new Date(l.ultimo_login).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* === SRM EXISTENTE === */}
      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">SRM — Esteira de homologação</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
          <PainelFase rotulo="Solicitação"  valor={kp.solicitacao}  cor="text-zinc-300" />
          <PainelFase rotulo="Pré-checagem" valor={kp.pre_check}    cor="text-sky-300" />
          <PainelFase rotulo="Análises"     valor={kp.analises}     cor="text-indigo-300" />
          <PainelFase rotulo="Consolidação" valor={kp.consolidacao} cor="text-violet-300" />
          <PainelFase rotulo="Decisão"      valor={kp.decisao}      cor="text-amber-300" />
          <PainelFase rotulo="Homologado"   valor={kp.homologado}   cor="text-emerald-300" />
          <PainelFase rotulo="Reprovado"    valor={kp.reprovado}    cor="text-rose-400" />
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/parceiros"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-rose-700/60 hover:bg-zinc-900"
        >
          <h2 className="text-lg font-medium">Parceiros</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Fornecedores upstream (fábrica, importador, distribuidor, lojista).
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-400">
            <div><dt>Total</dt><dd className="text-base font-semibold text-zinc-100">{k.total.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Fábrica</dt><dd className="text-base font-semibold text-blue-300">{k.fabrica}</dd></div>
            <div><dt>Distrib.</dt><dd className="text-base font-semibold text-emerald-300">{k.distribuidor}</dd></div>
          </dl>
        </Link>
        <Link
          href="/admin/credito-parceiros"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-rose-700/60 hover:bg-zinc-900"
        >
          <h2 className="text-lg font-medium">Crédito (FIDC)</h2>
          <p className="mt-1 text-sm text-zinc-400">CRUD de parceiros financeiros + taxas + comissões.</p>
        </Link>
        <Link
          href="/admin/skus"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-rose-700/60 hover:bg-zinc-900"
        >
          <h2 className="text-lg font-medium">Catálogo SKUs</h2>
          <p className="mt-1 text-sm text-zinc-400">Busca cross-parceiros por NCM/produto.</p>
        </Link>
      </section>
    </main>
  );
}

function KpiBig({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
function PainelFase({ rotulo, valor, cor }: { rotulo: string; valor: number | null; cor: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className={`mt-0.5 text-lg font-semibold ${cor}`}>{Number(valor ?? 0).toLocaleString("pt-BR")}</p>
    </div>
  );
}
function Painel({ rotulo, valor, cor }: { rotulo: string; valor: number | string | null; cor: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className={`mt-0.5 text-lg font-semibold ${cor}`}>
        {valor == null ? "—" : typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
      </p>
    </div>
  );
}
