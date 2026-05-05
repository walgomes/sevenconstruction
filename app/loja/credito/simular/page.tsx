"use client";

import { useState } from "react";
import Link from "next/link";

type Resp = {
  ok: boolean;
  motivo?: string;
  taxa_aa_estimada?: number;
  taxa_mensal?: number;
  parcela_estimada?: number;
  total_a_pagar?: number;
  rating?: "verde" | "amarelo" | "vermelho";
  rating_motivo?: string;
  proposta_id?: number;
};

function fmtBrl(v: number | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ratingCor(r?: string) {
  switch (r) {
    case "verde": return "bg-emerald-500/10 text-emerald-300 border-emerald-700/40";
    case "amarelo": return "bg-amber-500/10 text-amber-300 border-amber-700/40";
    case "vermelho": return "bg-red-500/10 text-red-300 border-red-700/40";
    default: return "bg-zinc-500/10 text-zinc-300 border-zinc-700";
  }
}

export default function SimuladorPage() {
  const [cnpj, setCnpj] = useState("");
  const [valor, setValor] = useState("10000");
  const [prazo, setPrazo] = useState("90");
  const [resultado, setResultado] = useState<Resp | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await fetch("/api/credito/simular", {
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
      setResultado(j);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Crédito</p>
        <h1 className="mt-1 text-3xl font-semibold">Simulador de proposta</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Simulação baseada em <strong>dados RFB + compliance</strong> (CADIN, PGFN). Não é aprovação —
          é estimativa pra orientar o cliente.
        </p>
      </header>

      <form
        onSubmit={simular}
        className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-3"
      >
        <div className="md:col-span-3">
          <label className="text-xs text-zinc-400">CNPJ do cliente</label>
          <input
            required
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Valor solicitado (R$)</label>
          <input
            required
            type="number"
            min="100"
            max="1000000"
            step="100"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Prazo (dias)</label>
          <select
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="30">30 dias (1×)</option>
            <option value="60">60 dias (2×)</option>
            <option value="90">90 dias (3×)</option>
            <option value="180">180 dias (6×)</option>
            <option value="360">360 dias (12×)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Simulando..." : "Simular"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {resultado && (
        <section className="mt-6 space-y-4">
          <div className={`rounded-xl border-2 ${ratingCor(resultado.rating)} p-5`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold uppercase">Rating: {resultado.rating}</h2>
              <span className="text-3xl font-bold">{resultado.taxa_aa_estimada}% a.a.</span>
            </div>
            <p className="mt-2 text-sm">{resultado.rating_motivo}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Taxa mensal</div>
              <div className="mt-1 text-2xl font-semibold">{resultado.taxa_mensal}%</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Parcela estimada</div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">{fmtBrl(resultado.parcela_estimada)}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Total a pagar</div>
              <div className="mt-1 text-2xl font-semibold">{fmtBrl(resultado.total_a_pagar)}</div>
            </div>
          </div>

          <div className="rounded-md border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">
            ⚠️ Esta é uma estimativa interna. Aprovação real exige análise por parceiro
            financeiro (FIDC/banco). Proposta #{resultado.proposta_id} salva no histórico.
          </div>

          <Link
            href="/loja/credito"
            className="inline-block rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Crédito
          </Link>
        </section>
      )}
    </main>
  );
}
