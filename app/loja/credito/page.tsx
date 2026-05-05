import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

type Parceiro = {
  id: number;
  nome: string;
  tipo: string;
  taxa_minima_aa: number | null;
  taxa_maxima_aa: number | null;
  ticket_max: number | null;
  comissao_loja_pct: number | null;
  status: string;
};

const TIPO_LABEL: Record<string, { label: string; emoji: string }> = {
  fidc: { label: "FIDC", emoji: "🏦" },
  banco: { label: "Banco", emoji: "🏛️" },
  fintech: { label: "Fintech", emoji: "💸" },
  factoring: { label: "Factoring", emoji: "📑" },
  cooperativa: { label: "Cooperativa", emoji: "🤝" },
  cartao: { label: "Cartão BNPL", emoji: "💳" },
};

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`;
}

function fmtBrl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CreditoPage() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const r = await pool.query(
    `SELECT id, nome, tipo, taxa_minima_aa, taxa_maxima_aa, ticket_max,
            comissao_loja_pct, status
       FROM sevenconstruction.parceiros_financeiros
      ORDER BY status DESC, nome
      LIMIT 100`,
  );
  const parceiros = r.rows as Parceiro[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Crédito</p>
          <h1 className="mt-1 text-3xl font-semibold">Crédito no checkout (FIDC + bancos + fintechs)</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Plano: marketplace de <strong className="text-zinc-200">150+ parceiros financeiros</strong>.
            Cliente escolhe forma de pagar (à vista, FIDC antecipado, financiamento) — loja recebe comissão
            em cada operação fechada.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 rounded-xl border border-amber-700/40 bg-amber-950/20 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-300">
          ⚠️ Setup honesto: o que falta antes de funcionar
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Crédito no checkout NÃO é coisa que se "constrói do zero" — depende de{" "}
          <strong>contrato comercial</strong> com cada parceiro financeiro:
        </p>
        <ul className="mt-3 grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>1. Contratos com parceiros</strong>
            <p className="mt-1 text-xs text-zinc-400">Cada FIDC/banco/fintech exige due diligence
            (~30-60 dias por parceiro). Comissão típica: 0,3–1,5% da operação.</p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>2. Adapter por parceiro</strong>
            <p className="mt-1 text-xs text-zinc-400">Cada parceiro tem API própria (REST, SOAP, webhook).
            ~2-3 semanas de integração por parceiro. 1 adapter/semana é meta saudável.</p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>3. Compliance Bacen</strong>
            <p className="mt-1 text-xs text-zinc-400">A loja vai operar como{" "}
              <em>plataforma de indicação</em> ou registrar como{" "}
              <em>correspondente bancário</em>. Define escopo do que pode oferecer.</p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>4. Análise de crédito</strong>
            <p className="mt-1 text-xs text-zinc-400">Cliente passa por análise antes de aprovar.
            Integração com bureaus (Serasa/Boa Vista) — APIs pagas (~R$ 5-15/consulta).</p>
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          ETA realista: <strong>3-6 meses</strong> pra primeiros 3 parceiros piloto + integração + due diligence.
          Por isso esta tela é cadastro de parceiros futuros — não disparo real.
        </p>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-700/30 bg-emerald-950/10 p-5">
        <div>
          <h2 className="font-semibold">🧮 Simulador de proposta</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Estima taxa a.a. baseado em dados RFB + compliance do cliente. Sem precisar contrato com FIDC ainda.
          </p>
        </div>
        <Link
          href="/loja/credito/simular"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          Simular agora →
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Parceiros financeiros cadastrados</h2>
        {parceiros.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Nenhum parceiro cadastrado ainda. Cadastro será feito pelo super-admin
              quando houver contratos assinados.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {parceiros.map((p) => {
              const t = TIPO_LABEL[p.tipo] ?? { label: p.tipo, emoji: "🏢" };
              return (
                <li key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <header className="flex items-start justify-between">
                    <div>
                      <span className="text-2xl">{t.emoji}</span>
                      <h3 className="mt-1 font-medium">{p.nome}</h3>
                      <p className="text-xs text-zinc-500">{t.label}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </header>
                  <div className="mt-3 space-y-1 text-xs text-zinc-400">
                    <div>Taxa: {fmtPct(p.taxa_minima_aa)} – {fmtPct(p.taxa_maxima_aa)}</div>
                    <div>Ticket máx: {fmtBrl(p.ticket_max)}</div>
                    <div className="text-amber-300">
                      Comissão loja: {p.comissao_loja_pct != null ? `${p.comissao_loja_pct}%` : "—"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-base font-semibold">Modelo de receita estimado por loja</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Estim label="Mensalidade SaaS" valor="R$ 199 – 499" obs="fixo" />
          <Estim label="Comissão crédito/FIDC" valor="R$ 1.000 – 2.500" obs="0,3–1% × ticket × volume" />
          <Estim label="Total esperado / mês" valor="R$ 2.000 – 4.000" obs="por loja ativa" />
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    avaliacao: "bg-zinc-700/40 text-zinc-300",
    contrato_pendente: "bg-amber-500/20 text-amber-300",
    integrando: "bg-blue-500/20 text-blue-300",
    ativo: "bg-emerald-500/20 text-emerald-300",
    pausado: "bg-orange-500/20 text-orange-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${map[status] || "bg-zinc-700/40 text-zinc-300"}`}>
      {status}
    </span>
  );
}

function Estim({ label, valor, obs }: { label: string; valor: string; obs: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-amber-300">{valor}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{obs}</div>
    </div>
  );
}
