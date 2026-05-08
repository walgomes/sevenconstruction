import Link from "next/link";
import pool from "@/lib/db";
import FormParceiroFin from "./FormParceiroFin";

export const dynamic = "force-dynamic";

interface ParceiroFinRow {
  id: number;
  nome: string;
  tipo: string;
  cnpj: string | null;
  taxa_minima_aa: number | null;
  taxa_maxima_aa: number | null;
  prazo_min_dias: number | null;
  prazo_max_dias: number | null;
  ticket_min: number | null;
  ticket_max: number | null;
  comissao_loja_pct: number | null;
  status: string;
  adapter_codigo: string | null;
  observacoes: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  fidc: "🏦 FIDC", banco: "🏛️ Banco", fintech: "💸 Fintech",
  factoring: "📑 Factoring", cooperativa: "🤝 Cooperativa", cartao: "💳 BNPL",
};
const STATUS_COR: Record<string, string> = {
  ativo: "text-emerald-300",
  pausado: "text-amber-300",
  avaliacao: "text-zinc-400",
  contrato_pendente: "text-blue-300",
  integrando: "text-violet-300",
};

function fmtPct(v: number | null) { return v == null ? "—" : `${v.toFixed(2)}%`; }
function fmtBrl(v: number | null) { return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

export default async function CreditoParceirosAdminPage() {
  const r = await pool.query<ParceiroFinRow>(
    `SELECT id, nome, tipo, cnpj,
            taxa_minima_aa::float AS taxa_minima_aa, taxa_maxima_aa::float AS taxa_maxima_aa,
            prazo_min_dias, prazo_max_dias,
            ticket_min::float AS ticket_min, ticket_max::float AS ticket_max,
            comissao_loja_pct::float AS comissao_loja_pct,
            status, adapter_codigo, observacoes
       FROM sevenconstruction.parceiros_financeiros
      ORDER BY status DESC, nome ASC`,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-rose-400">Admin · Crédito</p>
        <h1 className="mt-1 text-2xl font-semibold">Parceiros financeiros (FIDC/Bancos)</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {r.rows.length} parceiros cadastrados · ative/pause/edite cada um abaixo · novo parceiro vincula automaticamente em todas as lojas
        </p>
      </header>

      <FormParceiroFin />

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Parceiros cadastrados</h2>
        {r.rows.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
            Nenhum parceiro ainda — cadastre acima.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Nome / Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-center">Taxa a.a.</th>
                  <th className="px-3 py-2 text-center">Prazo</th>
                  <th className="px-3 py-2 text-right">Ticket</th>
                  <th className="px-3 py-2 text-right">Comissão</th>
                  <th className="px-3 py-2">Adapter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {r.rows.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-100">{p.nome}</p>
                      <p className="text-[10px] text-zinc-500">{TIPO_LABEL[p.tipo] ?? p.tipo}{p.cnpj && ` · CNPJ ${p.cnpj}`}</p>
                    </td>
                    <td className={`px-3 py-2 text-xs uppercase tracking-wider ${STATUS_COR[p.status] ?? "text-zinc-300"}`}>
                      {p.status}
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-300">
                      {fmtPct(p.taxa_minima_aa)} – {fmtPct(p.taxa_maxima_aa)}
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-400">
                      {p.prazo_min_dias}-{p.prazo_max_dias}d
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
                      {fmtBrl(p.ticket_min)} → {fmtBrl(p.ticket_max)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">{fmtPct(p.comissao_loja_pct)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{p.adapter_codigo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-zinc-600">
        <Link href="/admin" className="hover:text-zinc-400">← Painel admin</Link>
      </p>
    </main>
  );
}
