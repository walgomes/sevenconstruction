import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { listar, contar } from "@/lib/notificacoes";
import pool from "@/lib/db";
import AcoesNotif from "./AcoesNotif";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  match_b2b: "Rede B2B",
  transacao_marketplace: "Marketplace",
  indicacao_paga: "Fidelização",
  fatura_vencida: "Cobrança",
  parceiro_homologado: "Parceiros",
  cliente_proximo_trial: "Trial",
  sistema: "Sistema",
};

const PRI_COR: Record<number, string> = {
  0: "bg-zinc-500/10 text-zinc-400",
  1: "bg-blue-500/10 text-blue-300",
  2: "bg-rose-500/10 text-rose-300",
};

type SearchParams = Promise<{ tipo?: string; nao_lidas?: string }>;

export default async function NotificacoesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  let lojaId: number;
  let userId: number | undefined;
  if (sessao.role === "loja_user" && sessao.loja_id) {
    lojaId = sessao.loja_id;
    userId = sessao.id;
  } else if (sessao.role === "super") {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    if (!r.rows[0]) redirect("/login");
    lojaId = r.rows[0].id;
  } else redirect("/login");

  const [notificacoes, kpis] = await Promise.all([
    listar({
      loja_id: lojaId,
      user_id: userId,
      apenas_nao_lidas: sp.nao_lidas === "1",
      tipo: sp.tipo,
      limite: 100,
    }),
    contar({ loja_id: lojaId, user_id: userId }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold">Notificações</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {kpis.nao_lidas} não lidas · {kpis.total} totais
          </p>
        </div>
        <AcoesNotif />
      </header>

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs">
        <FiltroLink href="/loja/notificacoes" label="Todas" ativo={!sp.nao_lidas && !sp.tipo} />
        <FiltroLink href="/loja/notificacoes?nao_lidas=1" label={`Não lidas (${kpis.nao_lidas})`} ativo={sp.nao_lidas === "1"} />
        {Object.entries(TIPO_LABEL).map(([t, l]) => (
          <FiltroLink key={t} href={`/loja/notificacoes?tipo=${t}`} label={l} ativo={sp.tipo === t} />
        ))}
      </nav>

      {notificacoes.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
          Nenhuma notificação{sp.nao_lidas === "1" ? " não lida" : ""}.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {notificacoes.map((n) => (
            <li key={n.id}
              className={`px-4 py-3 ${n.lida ? "bg-zinc-900/30" : "bg-zinc-900/60"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{n.icone}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${PRI_COR[n.prioridade] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                      {TIPO_LABEL[n.tipo] ?? n.tipo}
                    </span>
                    {!n.lida && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950">novo</span>}
                    <span className="text-[10px] text-zinc-500">{new Date(n.criado_em).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-1 font-medium text-zinc-100">{n.titulo}</p>
                  <p className="text-sm text-zinc-400">{n.mensagem}</p>
                  {n.link && (
                    <Link href={n.link} className="mt-1 inline-block text-xs text-amber-400 hover:text-amber-300">
                      abrir →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FiltroLink({ href, label, ativo }: { href: string; label: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-2 py-1 ${
        ativo ? "bg-amber-500 text-zinc-950 font-bold"
              : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}
