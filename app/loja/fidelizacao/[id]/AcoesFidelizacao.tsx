"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcoesFidelizacao({ clienteId, saldoAtual }: { clienteId: number; saldoAtual: number }) {
  const router = useRouter();
  const [aba, setAba] = useState<"compra" | "resgate" | "indicar">("compra");
  const [valor, setValor] = useState("");
  const [pontos, setPontos] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nomeIndic, setNomeIndic] = useState("");
  const [contatoIndic, setContatoIndic] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function lancarCompra(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null); setOk(null);
    try {
      const r = await fetch("/api/loja/fidelizacao/compra", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, valor_brl: parseFloat(valor), descricao: descricao || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setOk(`+${j.movimento.pontos} pts creditados`);
      setValor(""); setDescricao("");
      router.refresh();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setEnviando(false); }
  }

  async function lancarResgate(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null); setOk(null);
    try {
      const r = await fetch("/api/loja/fidelizacao/resgate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, pontos: parseInt(pontos, 10), descricao: descricao || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setOk(`-${Math.abs(j.movimento.pontos)} pts resgatados`);
      setPontos(""); setDescricao("");
      router.refresh();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setEnviando(false); }
  }

  async function lancarIndicacao(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null); setOk(null);
    try {
      const r = await fetch("/api/loja/fidelizacao/indicacao", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cliente_origem: clienteId,
          nome_indicado: nomeIndic,
          contato_indicado: contatoIndic,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setOk(`Indicação #${j.indicacao.id} registrada (50 pts liberam quando indicado comprar R$ 50+)`);
      setNomeIndic(""); setContatoIndic("");
      router.refresh();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setEnviando(false); }
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center gap-1 border-b border-zinc-800">
        <Tab atual={aba} v="compra" set={setAba}>💰 Lançar compra</Tab>
        <Tab atual={aba} v="resgate" set={setAba}>🎁 Resgatar</Tab>
        <Tab atual={aba} v="indicar" set={setAba}>👥 Indicar amigo</Tab>
      </div>

      {aba === "compra" && (
        <form onSubmit={lancarCompra} className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor da compra (R$) *">
            <input type="number" min="1" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="350.00" className={inputCls} />
          </Field>
          <Field label="Descrição (opcional)" full>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Cimento + argamassa, NF 1234" className={inputCls} />
          </Field>
          <div className="flex items-end sm:col-span-3">
            <button type="submit" disabled={enviando || !valor}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {enviando ? "..." : `Creditar ${Math.floor(parseFloat(valor || "0"))} pts`}
            </button>
          </div>
        </form>
      )}

      {aba === "resgate" && (
        <form onSubmit={lancarResgate} className="grid gap-3 sm:grid-cols-3">
          <Field label={`Pontos a resgatar (saldo: ${saldoAtual.toLocaleString("pt-BR")})*`}>
            <input type="number" min="1" max={saldoAtual} step="1" required value={pontos} onChange={(e) => setPontos(e.target.value)}
              placeholder="100" className={inputCls} />
          </Field>
          <Field label="Descrição (opcional)" full>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Resgate em desconto NF 5678" className={inputCls} />
          </Field>
          <div className="flex items-end sm:col-span-3">
            <button type="submit" disabled={enviando || !pontos || parseInt(pontos, 10) > saldoAtual}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
              {enviando ? "..." : `Resgatar ${pontos || 0} pts (R$ ${(parseInt(pontos || "0", 10) * 0.01).toFixed(2)})`}
            </button>
          </div>
        </form>
      )}

      {aba === "indicar" && (
        <form onSubmit={lancarIndicacao} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do indicado *">
            <input required value={nomeIndic} onChange={(e) => setNomeIndic(e.target.value)} className={inputCls} placeholder="Ex: João Silva" />
          </Field>
          <Field label="Email ou telefone *">
            <input required value={contatoIndic} onChange={(e) => setContatoIndic(e.target.value)} className={inputCls} placeholder="joao@empresa.com ou (11) 99999-9999" />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" disabled={enviando || !nomeIndic || !contatoIndic}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
              {enviando ? "..." : "Registrar indicação (+50 pts cada lado quando comprar)"}
            </button>
          </div>
        </form>
      )}

      {erro && <p className="mt-3 rounded-md border border-rose-700/40 bg-rose-950/30 p-2 text-xs text-rose-300">⚠️ {erro}</p>}
      {ok && <p className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-950/30 p-2 text-xs text-emerald-300">✓ {ok}</p>}
    </section>
  );
}

function Tab({ atual, v, set, children }: { atual: string; v: "compra" | "resgate" | "indicar"; set: (x: "compra" | "resgate" | "indicar") => void; children: React.ReactNode }) {
  const ativo = atual === v;
  return (
    <button
      type="button"
      onClick={() => set(v)}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
        ativo ? "border-amber-500 text-amber-300" : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2 md:col-span-3" : ""}`}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
