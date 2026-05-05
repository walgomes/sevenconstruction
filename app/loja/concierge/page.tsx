"use client";

import { useEffect, useState } from "react";

type Cliente = {
  id: number;
  nome_razao: string;
  cnpj: string | null;
  cpf: string | null;
};

type Resp = {
  ok: boolean;
  motivo?: string;
  evento_id?: number;
  protocolo?: string;
  url_pdf?: string;
  mensagem?: string;
};

const SERVICOS = [
  { codigo: "CRT_FED", nome: "Certidão Negativa Federal", emoji: "🏛️", cor: "border-blue-700/40 bg-blue-950/20", preco: 25 },
  { codigo: "CRT_EST", nome: "Certidão Negativa Estadual", emoji: "🏢", cor: "border-blue-700/40 bg-blue-950/20", preco: 30 },
  { codigo: "CRT_TRB", nome: "Certidão Trabalhista (CNDT)", emoji: "👷", cor: "border-blue-700/40 bg-blue-950/20", preco: 20 },
  { codigo: "CRT_FAL", nome: "Certidão Falência/Concordata", emoji: "⚖️", cor: "border-blue-700/40 bg-blue-950/20", preco: 35 },
  { codigo: "CRT_DIG", nome: "Certificado Digital A1", emoji: "🔐", cor: "border-purple-700/40 bg-purple-950/20", preco: 200 },
];

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ConciergePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [cnpjAvulso, setCnpjAvulso] = useState("");
  const [servico, setServico] = useState<string | null>(null);
  const [codigoIndicacao, setCodigoIndicacao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clientes-base")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setClientes(j.clientes); });
  }, []);

  async function emitir() {
    if (!servico) { setErro("Escolha um serviço"); return; }
    if (!clienteId && !cnpjAvulso) { setErro("Escolha cliente ou informe CNPJ"); return; }
    setEmitindo(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await fetch("/api/concierge/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId ?? undefined,
          cnpj: cnpjAvulso || undefined,
          servico_codigo: servico,
          codigo_indicacao: codigoIndicacao || undefined,
          observacoes: observacoes || undefined,
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
      setEmitindo(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Concierge</p>
        <h1 className="mt-1 text-3xl font-semibold">Emissão de certidões</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Emita certidões pra seu cliente em poucos cliques. Cada emissão registra
          automaticamente a comissão da loja no ledger.
        </p>
      </header>

      <section className="mt-6 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-xs text-amber-200">
        ⚠️ <strong>Mock provider ativo:</strong> emissão real precisa contrato com emissora
        (Receita Federal/SEFAZ/TST/TJ APIs ou portal de certidões). Este worker registra a
        operação no ledger e retorna PDF placeholder.
      </section>

      <h2 className="mt-8 text-lg font-semibold">1. Cliente</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <label className="text-xs text-zinc-400">Cliente da base</label>
          <select
            value={clienteId ?? ""}
            onChange={(e) => {
              setClienteId(e.target.value ? parseInt(e.target.value, 10) : null);
              if (e.target.value) setCnpjAvulso("");
            }}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">— Escolha —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_razao} — {c.cnpj || c.cpf || "(sem doc)"}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <label className="text-xs text-zinc-400">OU CNPJ avulso (não-cadastrado)</label>
          <input
            value={cnpjAvulso}
            onChange={(e) => {
              setCnpjAvulso(e.target.value);
              if (e.target.value) setClienteId(null);
            }}
            placeholder="00.000.000/0000-00"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">2. Serviço</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SERVICOS.map((s) => (
          <li key={s.codigo}>
            <button
              type="button"
              onClick={() => setServico(s.codigo)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                servico === s.codigo
                  ? "border-amber-500 bg-amber-500/10"
                  : `${s.cor} hover:border-amber-500/40`
              }`}
            >
              <div className="text-2xl">{s.emoji}</div>
              <h3 className="mt-2 font-medium">{s.nome}</h3>
              <p className="mt-1 text-xs text-zinc-500">Cliente paga {fmtBrl(s.preco)}</p>
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">3. Detalhes (opcional)</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs text-zinc-400">Código de indicação</label>
          <input
            value={codigoIndicacao}
            onChange={(e) => setCodigoIndicacao(e.target.value)}
            placeholder="Ex: PEDREIRO-1-AB12 (paga comissão pra ele)"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Observações</label>
          <input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Para licitação 042/2026"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={emitir}
          disabled={emitindo || !servico}
          className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {emitindo ? "Emitindo..." : "Emitir certidão"}
        </button>
      </div>

      {resultado?.ok && (
        <section className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <h2 className="text-lg font-semibold text-emerald-300">✓ Emitido</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Protocolo: <code className="rounded bg-zinc-800 px-1 font-mono">{resultado.protocolo}</code>
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Comissão registrada no evento #{resultado.evento_id}.{" "}
            <a href={resultado.url_pdf} className="text-amber-400 hover:underline" target="_blank" rel="noopener">
              Baixar PDF mock →
            </a>
          </p>
          <p className="mt-2 text-xs text-zinc-500">{resultado.mensagem}</p>
        </section>
      )}
    </main>
  );
}
