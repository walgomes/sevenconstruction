import { redirect } from "next/navigation";
import { lerSessaoCliente } from "@/lib/cliente-auth";
import { lerSaldo, listarMovimento, listarIndicacoes, PONTO_VALOR_REAIS } from "@/lib/fidelizacao";
import pool from "@/lib/db";
import FormIndicarCliente from "./FormIndicarCliente";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  resgate: "Resgate",
  indicacao_origem: "Indicação",
  indicacao_destino: "Boas-vindas",
  ajuste: "Ajuste",
  expiracao: "Expiração",
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

export default async function PainelCliente() {
  const sessao = await lerSessaoCliente();
  if (!sessao) redirect("/cliente");

  const cli = await pool.query<{ nome_razao: string; loja_nome: string }>(
    `SELECT c.nome_razao, l.nome_fantasia AS loja_nome
       FROM sevenconstruction.loja_clientes c
       JOIN sevenconstruction.lojas l ON l.id = c.loja_id
      WHERE c.id = $1`,
    [sessao.cliente_id],
  );
  if (!cli.rows[0]) redirect("/cliente?erro=token_invalido");
  const cliente = cli.rows[0];

  const [saldo, movimento, indicacoes] = await Promise.all([
    lerSaldo(sessao.cliente_id),
    listarMovimento(sessao.cliente_id, 30),
    listarIndicacoes(sessao.cliente_id),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">{cliente.loja_nome}</p>
        <h1 className="mt-1 text-xl font-bold text-zinc-100">Olá, {cliente.nome_razao}</h1>
      </header>

      <section className="mt-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-zinc-900 p-5">
        <p className="text-[10px] uppercase tracking-wider text-amber-400">Seu saldo</p>
        <p className="mt-1 text-5xl font-black text-amber-300">{saldo.saldo.toLocaleString("pt-BR")}</p>
        <p className="mt-1 text-sm text-zinc-400">pontos · vale {fmtBrl(saldo.saldo * PONTO_VALOR_REAIS)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
          <div><dt>Total ganho</dt><dd className="text-base font-semibold text-zinc-100">{saldo.total_ganho.toLocaleString("pt-BR")}</dd></div>
          <div><dt>Já resgatado</dt><dd className="text-base font-semibold text-zinc-300">{saldo.total_resgatado.toLocaleString("pt-BR")}</dd></div>
        </dl>
      </section>

      <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-violet-300">👥 Indique e ganhe 50 pts</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Você ganha <strong className="text-amber-300">50 pts</strong> e seu amigo também
          quando ele fizer a primeira compra de R$ 50+.
        </p>
        <FormIndicarCliente />

        {indicacoes.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-800 text-xs">
            {indicacoes.slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2">
                <span className="text-zinc-300">{i.nome_indicado}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                  i.status === "pago" ? "bg-emerald-500/15 text-emerald-300"
                  : i.status === "comprou" ? "bg-amber-500/15 text-amber-300"
                  : i.status === "cadastrado" ? "bg-blue-500/15 text-blue-300"
                  : "bg-zinc-500/15 text-zinc-400"
                }`}>{i.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Últimos movimentos</h2>
        {movimento.length === 0 ? (
          <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/30 p-4 text-center text-sm text-zinc-500">
            Sem movimentos ainda. Sua próxima compra na loja já vai render pontos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
            {movimento.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-100">{TIPO_LABEL[m.tipo] ?? m.tipo}</p>
                  <p className="truncate text-[10px] text-zinc-500">
                    {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                    {m.descricao && ` · ${m.descricao}`}
                  </p>
                </div>
                <span className={`font-mono text-sm font-bold ${m.pontos > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {m.pontos > 0 ? "+" : ""}{m.pontos.toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-8 flex items-center justify-between text-xs text-zinc-600">
        <span>SevenConstruction · Meu clube</span>
        <form action="/api/cliente/auth/logout" method="POST">
          <button className="hover:text-zinc-400">sair</button>
        </form>
      </footer>
    </main>
  );
}
