"use client";

import { useEffect, useState, useCallback } from "react";

type Nota = {
  id: number; fornecedor_nome: string | null;
  numero: string; serie: string | null;
  data_emissao: string | null; data_entrada: string;
  valor_total: number; status: string; qtd_itens: number;
};

type Fornecedor = { id: number; razao_social: string };

function fmtBrl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtData(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR");
}
function statusCor(s: string) {
  if (s === "lancada") return "bg-emerald-500/10 text-emerald-300";
  if (s === "conferida") return "bg-blue-500/10 text-blue-300";
  if (s === "cancelada") return "bg-zinc-700/40 text-zinc-400";
  return "bg-amber-500/10 text-amber-300";
}

export default function NotaEntradaPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch(`/api/sistema/nota-entrada`);
    const j = await r.json();
    if (j.ok) setNotas(j.notas);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const totalMes = notas
    .filter((n) => new Date(n.data_entrada) >= new Date(Date.now() - 30 * 86400000))
    .reduce((s, n) => s + n.valor_total, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Sistema Loja · Notas de Entrada</p>
          <h1 className="mt-1 text-3xl font-semibold">📥 Notas de Entrada</h1>
          <p className="mt-1 text-xs text-zinc-500">NF-e recebidas do fornecedor (lançamento manual; parser XML virá depois)</p>
        </div>
        <button onClick={() => setModal(true)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400">
          + Nova nota
        </button>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Notas (todas)</div>
          <div className="mt-2 text-3xl font-semibold">{notas.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Últimos 30 dias</div>
          <div className="mt-2 text-3xl font-semibold">{notas.filter((n) => new Date(n.data_entrada) >= new Date(Date.now() - 30 * 86400000)).length}</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-amber-300">Compras 30d</div>
          <div className="mt-2 text-3xl font-semibold text-amber-200">{fmtBrl(totalMes)}</div>
        </div>
      </section>

      {carregando ? (
        <p className="mt-6 text-sm text-zinc-500">Carregando...</p>
      ) : notas.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhuma nota lançada. <button onClick={() => setModal(true)} className="text-amber-400 hover:underline">Lance a primeira</button>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Entrada</th>
                <th className="px-3 py-2">Nº / Série</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">Emissão</th>
                <th className="px-3 py-2 text-right">Itens</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtData(n.data_entrada)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {n.numero}{n.serie ? `/${n.serie}` : ""}
                  </td>
                  <td className="px-3 py-2">{n.fornecedor_nome || "—"}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{fmtData(n.data_emissao)}</td>
                  <td className="px-3 py-2 text-right text-xs text-zinc-400">{n.qtd_itens}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtBrl(n.valor_total)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusCor(n.status)}`}>{n.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ModalNovo onClose={() => setModal(false)} onSaved={carregar} />}
    </main>
  );
}

function ModalNovo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    fornecedor_id: "",
    numero: "", serie: "1",
    data_emissao: new Date().toISOString().slice(0, 10),
    data_entrada: new Date().toISOString().slice(0, 10),
    valor_produtos: "", valor_frete: "0", valor_desconto: "0",
  });
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sistema/fornecedores").then((r) => r.json()).then((j) => { if (j.ok) setFornecedores(j.fornecedores); });
  }, []);

  const total =
    (parseFloat(form.valor_produtos) || 0) +
    (parseFloat(form.valor_frete) || 0) -
    (parseFloat(form.valor_desconto) || 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/sistema/nota-entrada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fornecedor_id: form.fornecedor_id ? parseInt(form.fornecedor_id, 10) : undefined,
          valor_produtos: parseFloat(form.valor_produtos) || 0,
          valor_frete: parseFloat(form.valor_frete) || 0,
          valor_desconto: parseFloat(form.valor_desconto) || 0,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErro(j.motivo || "Falha"); return; }
      onSaved(); onClose();
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={salvar} className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova nota de entrada</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Fornecedor</label>
            <select value={form.fornecedor_id} onChange={(e) => setForm((p) => ({ ...p, fornecedor_id: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">— Não cadastrado / informar nome solto —</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
            </select>
          </div>
          <Field label="Nº NF-e *" v={form.numero} on={(v) => setForm((p) => ({ ...p, numero: v }))} required />
          <Field label="Série" v={form.serie} on={(v) => setForm((p) => ({ ...p, serie: v }))} />
          <Field label="Emissão" v={form.data_emissao} on={(v) => setForm((p) => ({ ...p, data_emissao: v }))} type="date" />
          <Field label="Entrada *" v={form.data_entrada} on={(v) => setForm((p) => ({ ...p, data_entrada: v }))} type="date" required />
          <Field label="Valor produtos (R$) *" v={form.valor_produtos} on={(v) => setForm((p) => ({ ...p, valor_produtos: v }))} type="number" required />
          <Field label="Frete (R$)" v={form.valor_frete} on={(v) => setForm((p) => ({ ...p, valor_frete: v }))} type="number" />
          <Field label="Desconto (R$)" v={form.valor_desconto} on={(v) => setForm((p) => ({ ...p, valor_desconto: v }))} type="number" />
          <div className="rounded-md border border-amber-700/40 bg-amber-950/20 p-3">
            <div className="text-xs uppercase text-amber-300">Total</div>
            <div className="mt-1 text-xl font-semibold text-amber-100">{fmtBrl(total)}</div>
          </div>
        </div>
        {erro && <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-700 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={salvando} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, v, on, type, required }: {
  label: string; v: string; on: (v: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} type={type} required={required}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
    </div>
  );
}
