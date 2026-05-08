"use client";

import { useState } from "react";
import Link from "next/link";

type Avaliacao = {
  rating: "verde" | "amarelo" | "vermelho";
  motivos: string[];
  fator_taxa: number;
};

type Oferta = {
  parceiro: { id: number; nome: string; tipo: string; comissao_loja_pct: number };
  apto: boolean;
  motivo_inapto?: string;
  taxa_aa: number;
  taxa_mensal: number;
  parcela_estimada: number;
  total_a_pagar: number;
  custo_total_juros: number;
  comissao_loja_estimada: number;
  proposta_id: number | null;
};

type Resp = {
  ok: boolean;
  motivo?: string;
  avaliacao?: Avaliacao;
  ofertas?: Oferta[];
  cnpj_consultado?: string;
};

const TIPO_EMOJI: Record<string, string> = {
  fidc: "🏦", banco: "🏛️", fintech: "💸", factoring: "📑", cooperativa: "🤝", cartao: "💳",
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function ratingCor(r: string) {
  switch (r) {
    case "verde":    return "border-emerald-700/40 bg-emerald-500/10 text-emerald-300";
    case "amarelo":  return "border-amber-700/40 bg-amber-500/10 text-amber-300";
    case "vermelho": return "border-red-700/40 bg-red-500/10 text-red-300";
    default:         return "border-zinc-700 bg-zinc-500/10 text-zinc-300";
  }
}

export default function SimuladorPage() {
  const [cnpj, setCnpj] = useState("");
  const [valor, setValor] = useState("10000");
  const [prazo, setPrazo] = useState("90");
  const [resp, setResp] = useState<Resp | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setResp(null);
    try {
      const r = await fetch("/api/credito/ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: cnpj.replace(/\D/g, ""),
          valor_solicitado: parseFloat(valor),
          prazo_dias: parseInt(prazo, 10),
        }),
      });
      const j = (await r.json()) as Resp;
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setResp(j);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  const ofertasAptas = resp?.ofertas?.filter((o) => o.apto) ?? [];
  const ofertasInaptas = resp?.ofertas?.filter((o) => !o.apto) ?? [];
  const melhor = ofertasAptas[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">
          <Link href="/loja/credito" className="hover:text-amber-300">← Crédito</Link> · Simulação
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Simulador comparativo</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Avaliamos o CNPJ via <strong>RFB + CADIN + PGFN</strong> e comparamos as taxas de
          todos os parceiros financeiros ativos. Aprovação real depende do parceiro.
        </p>
      </header>

      <form onSubmit={simular}
        className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="text-xs text-zinc-400">CNPJ do cliente</label>
          <input required value={cnpj} onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Valor solicitado (R$)</label>
          <input required type="number" min="100" max="1000000" step="100"
            value={valor} onChange={(e) => setValor(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Prazo (dias)</label>
          <select value={prazo} onChange={(e) => setPrazo(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500">
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
            <option value="180">180 dias</option>
            <option value="360">360 dias</option>
            <option value="720">720 dias</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={carregando}
            className="w-full rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {carregando ? "Comparando..." : "Comparar parceiros"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {resp?.avaliacao && (
        <section className={`mt-6 rounded-xl border-2 p-5 ${ratingCor(resp.avaliacao.rating)}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold uppercase">Rating: {resp.avaliacao.rating}</h2>
            <span className="text-xs uppercase tracking-wider opacity-80">
              fator_taxa: {(resp.avaliacao.fator_taxa * 100).toFixed(0)}%
            </span>
          </div>
          {resp.avaliacao.motivos.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {resp.avaliacao.motivos.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </section>
      )}

      {ofertasAptas.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {ofertasAptas.length} oferta(s) aprovada(s) · ordenada(s) por menor taxa
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ofertasAptas.map((o, idx) => (
              <article key={o.parceiro.id}
                className={`rounded-xl border p-4 ${
                  idx === 0 ? "border-amber-500/60 bg-amber-950/15" : "border-zinc-800 bg-zinc-900/40"
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl">{TIPO_EMOJI[o.parceiro.tipo] ?? "💰"}</span>
                  {idx === 0 && (
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950">
                      Melhor oferta
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-zinc-100">{o.parceiro.nome}</h3>
                <p className="mt-3 text-3xl font-black text-amber-300">{o.taxa_aa.toFixed(2)}<span className="text-base font-normal text-zinc-400"> % a.a.</span></p>
                <dl className="mt-3 space-y-1 text-xs text-zinc-400">
                  <div className="flex justify-between"><dt>Parcela</dt><dd className="text-zinc-100">{fmtBrl(o.parcela_estimada)}</dd></div>
                  <div className="flex justify-between"><dt>Total a pagar</dt><dd className="text-zinc-100">{fmtBrl(o.total_a_pagar)}</dd></div>
                  <div className="flex justify-between"><dt>Juros</dt><dd className="text-zinc-300">{fmtBrl(o.custo_total_juros)}</dd></div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
                    <dt className="text-emerald-400">Comissão loja</dt>
                    <dd className="text-emerald-200 font-semibold">{fmtBrl(o.comissao_loja_estimada)}</dd>
                  </div>
                </dl>
                {o.proposta_id && (
                  <p className="mt-2 text-[10px] text-zinc-600">Proposta #{o.proposta_id}</p>
                )}
              </article>
            ))}
          </div>

          {melhor && (
            <div className="mt-5 rounded-md border border-emerald-700/40 bg-emerald-950/15 p-4 text-sm text-emerald-200">
              ✅ Melhor oferta: <strong>{melhor.parceiro.nome}</strong> a <strong>{melhor.taxa_aa.toFixed(2)}% a.a.</strong>
              · parcela {fmtBrl(melhor.parcela_estimada)} · comissão estimada {fmtBrl(melhor.comissao_loja_estimada)}
            </div>
          )}
        </section>
      )}

      {ofertasInaptas.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {ofertasInaptas.length} parceiro(s) não atende(m)
          </h2>
          <ul className="mt-3 space-y-2">
            {ofertasInaptas.map((o) => (
              <li key={o.parceiro.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm">
                <span className="text-zinc-300">
                  <span className="mr-2">{TIPO_EMOJI[o.parceiro.tipo] ?? "💰"}</span>
                  {o.parceiro.nome}
                </span>
                <span className="text-xs text-zinc-500">{o.motivo_inapto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resp?.ok && ofertasAptas.length === 0 && (
        <div className="mt-6 rounded-md border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
          ⚠️ Nenhum parceiro aprovou esta operação. Tente ajustar valor/prazo ou cadastrar mais parceiros.
        </div>
      )}
    </main>
  );
}
