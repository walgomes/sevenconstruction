import Link from "next/link";
import { lerKpis, lerDashboardSrm } from "@/lib/parceiros";

export const dynamic = "force-dynamic";

export default async function AdminInicio() {
  const [k, srm] = await Promise.all([lerKpis(), lerDashboardSrm()]);
  const kp = srm.kpis as Record<string, number | null>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wider text-rose-400">Painel super-admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Comando central</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Áreas internas — invisíveis pra lojas e clientes finais.
        </p>
      </header>

      {/* SRM Dashboard */}
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

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Painel rotulo="Trust score médio" valor={kp.trust_medio ?? "—"} sufixo="/100" cor="text-emerald-300" />
          <Painel rotulo="Risco alto" valor={kp.risco_alto} cor="text-rose-300" />
          <Painel rotulo="Em andamento" valor={kp.em_andamento} cor="text-amber-300" />
          <Painel rotulo="Homologados 7d" valor={kp.homologados_7d} cor="text-emerald-300" />
        </div>

        {srm.tempos.length > 0 && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Tempo médio por fase (h)</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {srm.tempos.map((t: { fase: string; horas_media: number; amostras: number }) => (
                <li key={t.fase} className="rounded bg-zinc-800/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t.fase}</p>
                  <p className="text-base font-semibold text-zinc-100">{Number(t.horas_media).toFixed(1)}h</p>
                  <p className="text-[10px] text-zinc-500">{t.amostras} amostras</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Tile de parceiros */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/parceiros"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-rose-700/60 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium">Parceiros</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Fornecedores upstream (fábrica, importador, distribuidor, lojista).
              </p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950/40 text-rose-300 group-hover:bg-rose-900/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M3 7l9-4 9 4-9 4-9-4z" />
                <path d="M3 12l9 4 9-4" />
                <path d="M3 17l9 4 9-4" />
              </svg>
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-400">
            <div><dt>Total</dt><dd className="text-base font-semibold text-zinc-100">{k.total.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Fábrica</dt><dd className="text-base font-semibold text-blue-300">{k.fabrica}</dd></div>
            <div><dt>Distrib.</dt><dd className="text-base font-semibold text-emerald-300">{k.distribuidor}</dd></div>
          </dl>
        </Link>
      </section>
    </main>
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

function Painel({
  rotulo, valor, sufixo, cor,
}: { rotulo: string; valor: number | string | null; sufixo?: string; cor: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className={`mt-0.5 text-lg font-semibold ${cor}`}>
        {valor == null ? "—" : typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
        {sufixo && <span className="text-xs font-normal text-zinc-500">{sufixo}</span>}
      </p>
    </div>
  );
}
