import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

type Revendedor = {
  id: number;
  nome: string;
  codigo: string;
  nivel: number;
  ativo: boolean;
  upline_id: number | null;
  downlines_diretos: number;
  total_comissao: number;
  comissao_mes: number;
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function RevendedoresPage() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const r = await pool.query(
    `SELECT id, nome, codigo, nivel, ativo, upline_id, downlines_diretos,
            total_comissao, comissao_mes
       FROM sevenconstruction.v_revendedor_arvore
      WHERE loja_id = $1
      ORDER BY nivel, total_comissao DESC
      LIMIT 200`,
    [sessao.loja_id],
  );
  const revendedores = r.rows as Revendedor[];

  const totalAtivos = revendedores.filter((r) => r.ativo).length;
  const totalComissaoMes = revendedores.reduce((s, r) => s + Number(r.comissao_mes), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Revendedores</p>
          <h1 className="mt-1 text-3xl font-semibold">Rede de revendedores (multi-nível)</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Cliente vira revendedor → tem código próprio → indica vendas → ganha comissão.
            Pode ter sua própria árvore de revendedores (até 3 níveis).
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 rounded-xl border border-red-700/40 bg-red-950/20 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-red-300">
          ⚠️ Compliance legal — leia antes de ativar
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          MLM no Brasil é <strong>lícito</strong> apenas se atender Lei 1.521/51:
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>1. Produto real com valor próprio</strong>{" "}
            <span className="text-emerald-400 ml-1">✅</span>
            <p className="mt-1 text-xs text-zinc-400">
              Os serviços digitais (certidões, consultas, clube) são reais e têm valor independente
              do recrutamento.
            </p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>2. Remuneração da venda, não do recrutamento</strong>{" "}
            <span className="text-emerald-400 ml-1">✅</span>
            <p className="mt-1 text-xs text-zinc-400">
              Comissão é % da venda real. Sem bônus por simplesmente "cadastrar gente".
            </p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>3. Sem fee de entrada</strong>{" "}
            <span className="text-emerald-400 ml-1">✅</span>
            <p className="mt-1 text-xs text-zinc-400">
              Cadastro como revendedor é grátis. Não cobra "kit inicial".
            </p>
          </li>
          <li className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <strong>4. Limite de níveis (3 max)</strong>{" "}
            <span className="text-emerald-400 ml-1">✅</span>
            <p className="mt-1 text-xs text-zinc-400">
              N1 5%, N2 2%, N3 1%. Sem promessa de "renda passiva infinita".
            </p>
          </li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          ⚠️ Antes de ativar em produção: revisão jurídica + termo aceito por cada revendedor (LGPD).
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <KPI label="Revendedores ativos" valor={totalAtivos} />
        <KPI label="Comissões pendentes (mês)" valor={fmtBrl(totalComissaoMes)} cor="amber" />
        <KPI label="Níveis em uso" valor={Math.max(...revendedores.map((r) => r.nivel), 0)} />
      </section>

      {revendedores.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">
            Nenhum revendedor cadastrado. Cadastro vai vir após revisão jurídica + termo LGPD.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {revendedores.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <header className="flex items-start justify-between">
                <div>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                    Nível {r.nivel}
                  </span>
                  <h3 className="mt-1 font-medium">{r.nome}</h3>
                  <p className="mt-0.5 text-xs font-mono text-amber-300">{r.codigo}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Comissão (mês)</div>
                  <div className="text-lg font-bold text-amber-300">{fmtBrl(r.comissao_mes)}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {r.downlines_diretos} downlines · total {fmtBrl(r.total_comissao)}
                  </div>
                </div>
              </header>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function KPI({ label, valor, cor }: { label: string; valor: number | string; cor?: "amber" }) {
  return (
    <div className={`rounded-xl border p-5 ${cor === "amber" ? "border-amber-700/40 bg-amber-950/20" : "border-zinc-800 bg-zinc-900"}`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${cor === "amber" ? "text-amber-300" : ""}`}>{valor}</div>
    </div>
  );
}
