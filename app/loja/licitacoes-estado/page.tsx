"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Licitacao = {
  id_licitacao: string;
  numero_licitacao: string | null;
  modalidade: string | null;
  objeto: string | null;
  data_resultado: string | null;
  valor_licitacao: number | null;
  nome_orgao: string | null;
  uf: string | null;
  municipio: string | null;
  vencedor_cnpj: string | null;
  vencedor_nome: string | null;
  vencedor_valor: number | null;
  vencedor_telefone: string | null;
  vencedor_email: string | null;
};

function fmtBrl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}

function formatCnpj(cnpj: string | null) {
  if (!cnpj || cnpj.length !== 14) return cnpj || "";
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export default function LicitacoesEstadoPage() {
  const [uf, setUf] = useState("BA");
  const [dias, setDias] = useState(30);
  const [termo, setTermo] = useState("");
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaBusca, setUltimaBusca] = useState<{ uf: string; total: number; desde: string; fonte?: string; cache_idade_h?: number | null } | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({
        uf,
        dias: String(dias),
        limite: "200",
      });
      if (termo.trim()) params.set("termo", termo.trim());
      const r = await fetch(`/api/licitacoes-estado?${params}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha ao buscar");
        setLicitacoes([]);
        return;
      }
      setLicitacoes(j.licitacoes);
      setUltimaBusca({ uf: j.uf, total: j.total, desde: j.desde, fonte: j.fonte, cache_idade_h: j.cache_idade_h });
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }, [uf, dias, termo]);

  // Busca inicial
  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">B2G</p>
          <h1 className="mt-1 text-3xl font-semibold">Licitações no meu Estado</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Licitações abertas no <strong>seu Estado</strong> — independente de onde o vencedor está.
            Cada vencedor é um construtor que vai precisar de material aqui.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); buscar(); }}
        className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-5"
      >
        <div>
          <label className="text-xs text-zinc-400">UF da obra</label>
          <input
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            required
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Janela (dias)</label>
          <select
            value={dias}
            onChange={(e) => setDias(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 180 dias</option>
            <option value={365}>Último 1 ano</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">Filtrar por termo (objeto da licitação)</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Ex: pavimentação, escola, ginásio"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Buscando..." : "Atualizar"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {ultimaBusca && !carregando && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xs text-zinc-500">
            {ultimaBusca.total} licitações em <strong>{ultimaBusca.uf}</strong> desde{" "}
            {fmtData(ultimaBusca.desde)}
          </p>
          {ultimaBusca.fonte === "cache_fallback" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              ⚠️ Supabase lento — exibindo cache local{" "}
              {ultimaBusca.cache_idade_h != null
                ? `de ${Math.round(ultimaBusca.cache_idade_h)}h atrás`
                : ""}
            </span>
          )}
          {ultimaBusca.fonte === "supabase" && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
              ✓ Dados ao vivo
            </span>
          )}
        </div>
      )}

      <section className="mt-4 space-y-3">
        {licitacoes.map((l) => (
          <article
            key={l.id_licitacao}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[60%]">
                <p className="text-xs uppercase tracking-wider text-amber-400">
                  {l.modalidade || "Licitação"} · {l.municipio || l.uf}
                </p>
                <h3 className="mt-1 text-base font-medium">
                  {l.objeto || "Objeto não informado"}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {l.nome_orgao} · Resultado em {fmtData(l.data_resultado)}
                  {l.numero_licitacao ? ` · Nº ${l.numero_licitacao}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Valor da licitação</p>
                <p className="text-lg font-semibold text-amber-300">
                  {fmtBrl(l.valor_licitacao)}
                </p>
              </div>
            </header>

            {l.vencedor_cnpj && (
              <div className="mt-4 grid gap-3 rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-300">
                    Vencedor (lead pra você)
                  </p>
                  <p className="mt-1 font-medium">{l.vencedor_nome || "—"}</p>
                  <p className="text-xs text-zinc-400">{formatCnpj(l.vencedor_cnpj)}</p>
                  {l.vencedor_valor != null && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Proposta vencedora: <strong className="text-zinc-200">{fmtBrl(l.vencedor_valor)}</strong>
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Contato</p>
                  <p className="mt-1 text-sm">
                    📞 {l.vencedor_telefone || <span className="text-zinc-500">—</span>}
                  </p>
                  <p className="text-sm">
                    ✉️ {l.vencedor_email || <span className="text-zinc-500">—</span>}
                  </p>
                </div>
              </div>
            )}
          </article>
        ))}

        {!carregando && licitacoes.length === 0 && (
          <p className="text-center text-sm text-zinc-500 py-12">
            Nenhuma licitação vencida no período. Aumenta a janela ou tenta outra UF.
          </p>
        )}
      </section>
    </main>
  );
}
