import Link from "next/link";
import { notFound } from "next/navigation";
import { lerParceiro, listarLog, lookalike } from "@/lib/parceiros";
import { TIPOS_PARCEIRO, FASES_HOMOLOG } from "@/lib/parceiros-tipos";
import pool from "@/lib/db";
import AcoesParceiro from "./AcoesParceiro";
import DocsParceiro from "./DocsParceiro";

export const dynamic = "force-dynamic";

export default async function ParceiroDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) notFound();

  const [p, log, docsRow, similares] = await Promise.all([
    lerParceiro(n),
    listarLog(n, 30),
    pool.query(`SELECT * FROM sevenconstruction.parceiros_docs WHERE parceiro_id = $1 ORDER BY criado_em DESC`, [n]),
    lookalike(n, 8),
  ]);
  if (!p) notFound();

  const tipoMeta = TIPOS_PARCEIRO.find((t) => t.valor === p.tipo);
  const faseMeta = FASES_HOMOLOG.find((f) => f.valor === p.fase_homolog);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin · Parceiros</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{p.nome_fantasia}</h1>
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tipoMeta?.cor ?? ""}`}>
              {tipoMeta?.rotulo ?? p.tipo}
            </span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${faseMeta?.cor ?? ""}`}>
              {faseMeta?.rotulo ?? p.fase_homolog}
            </span>
            <span className="font-mono text-sm text-zinc-500">#{p.codigo}</span>
            {p.trust_score != null && <ScorePill score={p.trust_score} />}
          </div>
          {p.razao_social && p.razao_social !== p.nome_fantasia && (
            <p className="mt-1 text-sm text-zinc-400">{p.razao_social}</p>
          )}
          {p.recomendacao_ia && (
            <p className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
              <span className="font-medium uppercase">{p.recomendacao_ia}:</span>{" "}
              <span className="text-zinc-300">{p.recomendacao_motivo ?? "—"}</span>
            </p>
          )}
        </div>
        <Link href="/admin/parceiros" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Voltar
        </Link>
      </header>

      <AcoesParceiro id={p.id} fase={p.fase_homolog} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Bloco titulo="Dados cadastrais">
          <Linha rotulo="CNPJ" valor={p.cnpj ? formatarCnpj(p.cnpj) : "—"} mono />
          <Linha rotulo="CNAE" valor={p.cnae_principal ? formatarCnae(p.cnae_principal) : "—"} mono />
          <Linha rotulo="Status" valor={p.ativo ? "Ativo" : "Inativo"} />
          <Linha rotulo="Risco inicial" valor={p.risco_inicial ?? "—"} />
          <Linha rotulo="Origem" valor={p.origem ?? "—"} />
          {p.origem_url && (
            <Linha rotulo="URL fonte" valor={
              <a href={p.origem_url} target="_blank" rel="noreferrer noopener" className="text-rose-300 hover:underline">
                {p.origem_url.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
            } />
          )}
        </Bloco>

        <Bloco titulo="Localização">
          <Linha rotulo="UF" valor={p.uf ?? "—"} />
          <Linha rotulo="Cidade" valor={p.cidade ?? "—"} />
          <Linha rotulo="Endereço" valor={p.endereco ?? "—"} />
          <Linha rotulo="CEP" valor={p.cep ? formatarCep(p.cep) : "—"} mono />
        </Bloco>

        <Bloco titulo="Contato">
          <Linha rotulo="Telefone" valor={p.telefone ?? "—"} />
          <Linha rotulo="WhatsApp" valor={p.whatsapp ?? "—"} />
          <Linha rotulo="Email" valor={p.email ?? "—"} />
          <Linha rotulo="Site" valor={
            p.site ? (
              <a href={p.site} target="_blank" rel="noreferrer noopener" className="text-rose-300 hover:underline">
                {p.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : "—"
          } />
        </Bloco>

        <Bloco titulo="Produtos cadastrados">
          {p.produtos && p.produtos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {p.produtos.map((pr) => (
                <Link
                  key={pr}
                  href={`/admin/parceiros?produto=${encodeURIComponent(pr)}`}
                  className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  {pr}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nenhum produto cadastrado.</p>
          )}
        </Bloco>
      </section>

      {/* Pareceres das IAs */}
      {(p.parecer_compliance || p.parecer_finance || p.parecer_operacional || p.parecer_legal) && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pareceres das IAs</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Parecer titulo="Compliance" cor="text-rose-300" json={p.parecer_compliance} />
            <Parecer titulo="Finance"    cor="text-emerald-300" json={p.parecer_finance} />
            <Parecer titulo="Operacional" cor="text-amber-300" json={p.parecer_operacional} />
            <Parecer titulo="Legal"      cor="text-sky-300" json={p.parecer_legal} />
          </div>
        </section>
      )}

      {/* Lookalike — diferencial SevenConstruction */}
      {similares.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Parceiros similares <span className="text-zinc-600">(mesmo tipo, UF e produtos)</span>
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {similares.map((s) => {
              const tipoMeta = TIPOS_PARCEIRO.find((t) => t.valor === s.tipo);
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/parceiros/${s.id}`}
                    className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm hover:border-rose-700/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1 font-medium text-zinc-100">{s.nome_fantasia}</span>
                      <span className="font-mono text-[10px] text-zinc-500">#{s.codigo}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${tipoMeta?.cor ?? ""}`}>
                        {tipoMeta?.rotulo}
                      </span>
                      {s.uf && <span className="text-[10px] text-zinc-500">{s.uf}</span>}
                      <span className="ml-auto text-[10px] font-bold text-rose-300">match {s.score_lookalike}</span>
                    </div>
                    {s.produtos_compartilhados.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-[10px] text-zinc-500">
                        {s.produtos_compartilhados.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Documentos */}
      <DocsParceiro id={p.id} docsIniciais={docsRow.rows as Doc[]} />

      {/* Auditoria */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Histórico de decisões</h2>
        {log.length === 0 ? (
          <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
            Sem transições registradas ainda.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
            {log.map((l: LogRow) => (
              <li key={l.id} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-zinc-500">{new Date(l.criado_em).toLocaleString("pt-BR")}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{l.ator_tipo}</span>
                  <span className="text-zinc-300">{l.ator_nome ?? `#${l.ator_id ?? "?"}`}</span>
                </div>
                <p className="mt-0.5 text-zinc-400">
                  {l.fase_de ? <><span className="text-zinc-600">{l.fase_de}</span> → </> : null}
                  <strong className="text-zinc-100">{l.fase_para}</strong>
                  {l.trust_score != null && <span className="ml-2 text-xs text-emerald-300">score {l.trust_score}</span>}
                </p>
                {l.motivo && <p className="text-xs text-zinc-500">{l.motivo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-zinc-600">
        Cadastrado em {new Date(p.criado_em).toLocaleString("pt-BR")} · atualizado em{" "}
        {new Date(p.atualizado_em).toLocaleString("pt-BR")}
        {p.ultima_analise_em && <> · última análise em {new Date(p.ultima_analise_em).toLocaleString("pt-BR")}</>}
      </p>
    </main>
  );
}

type Doc = { id: number; tipo_doc: string; nome: string; url: string; criado_em: string };
type LogRow = {
  id: number; criado_em: string; ator_tipo: string; ator_nome: string | null; ator_id: number | null;
  fase_de: string | null; fase_para: string; motivo: string | null; trust_score: number | null;
};

function ScorePill({ score }: { score: number }) {
  const cor = score >= 70 ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40"
            : score >= 40 ? "bg-amber-900/40 text-amber-300 border-amber-700/40"
            : "bg-rose-900/40 text-rose-300 border-rose-700/40";
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-bold ${cor}`}>
      {score}/100
    </span>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{titulo}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800/60 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <span className={`text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{valor}</span>
    </div>
  );
}

function Parecer({ titulo, cor, json }: { titulo: string; cor: string; json: Record<string, unknown> | null }) {
  if (!json) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <p className={`text-xs font-medium uppercase tracking-wider ${cor}`}>{titulo}</p>
      <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-950 p-2 text-[11px] leading-relaxed text-zinc-300">
        {JSON.stringify(json, null, 2)}
      </pre>
    </div>
  );
}

function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D+/g, "").padStart(14, "0");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}
function formatarCnae(cnae: string): string {
  const d = cnae.replace(/\D+/g, "").padStart(7, "0");
  return `${d.slice(0,4)}-${d.slice(4,5)}/${d.slice(5,7)}`;
}
function formatarCep(cep: string): string {
  const d = cep.replace(/\D+/g, "").padStart(8, "0");
  return `${d.slice(0,5)}-${d.slice(5,8)}`;
}
