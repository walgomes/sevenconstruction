import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerSaldo, listarMovimento, listarIndicacoes, PONTO_VALOR_REAIS } from "@/lib/fidelizacao";
import pool from "@/lib/db";
import AcoesFidelizacao from "./AcoesFidelizacao";

export const dynamic = "force-dynamic";

interface ClienteRow {
  id: number;
  loja_id: number;
  nome_razao: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
}

const TIPO_LABEL: Record<string, { label: string; cor: string }> = {
  compra:            { label: "Compra",            cor: "text-emerald-300" },
  resgate:           { label: "Resgate",           cor: "text-rose-300" },
  indicacao_origem:  { label: "Indicação (origem)", cor: "text-violet-300" },
  indicacao_destino: { label: "Indicação (boas-vindas)", cor: "text-violet-300" },
  ajuste:            { label: "Ajuste manual",     cor: "text-amber-300" },
  expiracao:         { label: "Expiração",         cor: "text-zinc-500" },
};

const STATUS_INDIC: Record<string, string> = {
  pendente:   "bg-zinc-500/10 text-zinc-300",
  cadastrado: "bg-blue-500/10 text-blue-300",
  comprou:    "bg-amber-500/10 text-amber-300",
  pago:       "bg-emerald-500/10 text-emerald-300",
  expirado:   "bg-zinc-500/10 text-zinc-500",
  cancelado:  "bg-red-500/10 text-red-300",
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

export default async function ClienteFidelizacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isFinite(clienteId)) notFound();

  let lojaId: number;
  if (sessao.role === "loja_user" && sessao.loja_id) lojaId = sessao.loja_id;
  else if (sessao.role === "super") {
    const lr = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    if (!lr.rows[0]) redirect("/login");
    lojaId = lr.rows[0].id;
  } else redirect("/login");

  const cli = await pool.query<ClienteRow>(
    `SELECT id, loja_id, nome_razao, nome_fantasia, cnpj, cpf, email, telefone
       FROM sevenconstruction.loja_clientes WHERE id = $1 AND loja_id = $2`,
    [clienteId, lojaId],
  );
  if (!cli.rows[0]) notFound();
  const cliente = cli.rows[0];

  const [saldo, movimento, indicacoes] = await Promise.all([
    lerSaldo(clienteId),
    listarMovimento(clienteId, 100),
    listarIndicacoes(clienteId),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">
          <Link href="/loja/fidelizacao" className="hover:text-amber-300">← Fidelização</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{cliente.nome_razao}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {cliente.cnpj ? `CNPJ ${cliente.cnpj}` : cliente.cpf ? `CPF ${cliente.cpf}` : "—"}
          {cliente.email && ` · ${cliente.email}`}
          {cliente.telefone && ` · ${cliente.telefone}`}
        </p>
      </header>

      <section className="mt-6 grid gap-2 sm:grid-cols-4">
        <Kpi label="Saldo atual" valor={saldo.saldo.toLocaleString("pt-BR")} cor="text-amber-300" />
        <Kpi label="Resgatável (R$)" valor={fmtBrl(saldo.saldo * PONTO_VALOR_REAIS)} cor="text-emerald-300" />
        <Kpi label="Total ganho" valor={saldo.total_ganho.toLocaleString("pt-BR")} cor="text-zinc-200" />
        <Kpi label="Total resgatado" valor={saldo.total_resgatado.toLocaleString("pt-BR")} cor="text-rose-300" />
      </section>

      <AcoesFidelizacao clienteId={cliente.id} saldoAtual={saldo.saldo} />

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Extrato (últimos 100)</h2>
        {movimento.length === 0 ? (
          <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
            Nenhum movimento ainda.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Pontos</th>
                  <th className="px-3 py-2 text-right">Valor R$</th>
                  <th className="px-3 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {movimento.map((m) => {
                  const t = TIPO_LABEL[m.tipo] ?? { label: m.tipo, cor: "text-zinc-300" };
                  return (
                    <tr key={m.id} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {new Date(m.criado_em).toLocaleString("pt-BR")}
                      </td>
                      <td className={`px-3 py-2 text-xs uppercase tracking-wider ${t.cor}`}>{t.label}</td>
                      <td className={`px-3 py-2 text-right font-mono ${m.pontos > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {m.pontos > 0 ? "+" : ""}{m.pontos.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-zinc-400">
                        {m.valor_referencia != null ? fmtBrl(m.valor_referencia) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-300">{m.descricao || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {indicacoes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Indicações deste cliente ({indicacoes.length})
          </h2>
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
            {indicacoes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <div className="flex-1">
                  <p className="text-zinc-100">{i.nome_indicado}</p>
                  <p className="text-xs text-zinc-500">{i.contato_indicado}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_INDIC[i.status] ?? "bg-zinc-500/10 text-zinc-300"}`}>
                    {i.status}
                  </span>
                  <span className="font-mono text-xs text-amber-300">+{i.recompensa_pontos} pts</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
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
