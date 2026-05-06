"use client";

import { useEffect, useState, useCallback } from "react";

type Conta = {
  id: number; cliente_nome: string | null;
  descricao: string; origem: string | null;
  valor: number; vencimento: string; status: string;
  recebido_em: string | null; valor_recebido: number | null;
  dias_vencido: number | null;
};

type Cliente = { id: number; nome_razao: string };

const ORIGENS = ["venda_balcao", "pedido", "servico", "outros"];

function fmtBrl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtData(s: string) { return new Date(s + "T00:00:00").toLocaleDateString("pt-BR"); }
function statusCor(s: string, dv: number | null) {
  if (s === "recebida") return "bg-emerald-500/10 text-emerald-300";
  if (s === "cancelada") return "bg-zinc-700/40 text-zinc-400";
  if (s === "protestada") return "bg-purple-500/10 text-purple-300";
  if (dv && dv > 0) return "bg-red-500/10 text-red-300";
  return "bg-amber-500/10 text-amber-300";
}

export default function ContaReceberPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [modal, setModal] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroStatus) params.set("status", filtroStatus);
    const r = await fetch(`/api/sistema/conta-receber?${params}`);
    const j = await r.json();
    if (j.ok) setContas(j.contas);
    setCarregando(false);
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  async function receber(c: Conta) {
    if (!confirm(`Marcar "${c.descricao}" como recebida (${fmtBrl(c.valor)})?`)) return;
    await fetch("/api/sistema/conta-receber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "receber", id: c.id }),
    });
    carregar();
  }

  const totalAberto = contas.filter((c) => c.status !== "recebida" && c.status !== "cancelada").reduce((s, c) => s + c.valor, 0);
  const atrasadas = contas.filter((c) => (c.dias_vencido ?? 0) > 0).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Sistema Loja · Contas a Receber</p>
          <h1 className="mt-1 text-3xl font-semibold">💰 Contas a Receber</h1>
        </div>
        <button onClick={() => setModal(true)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400">
          + Nova conta
        </button>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">Total em aberto</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">{fmtBrl(totalAberto)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Em aberto</div>
          <div className="mt-2 text-3xl font-semibold">{contas.filter((c) => c.status !== "recebida" && c.status !== "cancelada").length}</div>
        </div>
        <div className={`rounded-xl border p-5 ${atrasadas > 0 ? "border-red-700/40 bg-red-950/20" : "border-zinc-800 bg-zinc-900"}`}>
          <div className={`text-xs uppercase tracking-wider ${atrasadas > 0 ? "text-red-300" : "text-zinc-500"}`}>Atrasadas</div>
          <div className={`mt-2 text-3xl font-semibold ${atrasadas > 0 ? "text-red-200" : ""}`}>{atrasadas}</div>
        </div>
      </section>

      <div className="mt-4 flex gap-2">
        {["", "aberta", "atrasada", "recebida"].map((s) => (
          <button
            key={s || "todas"}
            onClick={() => setFiltroStatus(s)}
            className={`rounded-full px-3 py-1 text-xs ${filtroStatus === s ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
          >
            {s || "Todas"}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-zinc-500">Carregando...</p>
      ) : contas.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhuma conta. <button onClick={() => setModal(true)} className="text-amber-400 hover:underline">Cadastre a primeira</button>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fmtData(c.vencimento)}
                    {c.dias_vencido != null && c.dias_vencido > 0 && (
                      <div className="text-xs text-red-300">⚠️ {c.dias_vencido}d atraso</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{c.descricao}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{c.cliente_nome || "—"}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{c.origem || "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtBrl(c.valor)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusCor(c.status, c.dias_vencido)}`}>{c.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    {c.status === "aberta" || c.status === "atrasada" ? (
                      <button onClick={() => receber(c)} className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30">
                        ✓ Receber
                      </button>
                    ) : c.recebido_em ? (
                      <span className="text-xs text-zinc-500">{new Date(c.recebido_em).toLocaleDateString("pt-BR")}</span>
                    ) : null}
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
    descricao: "", origem: "venda_balcao",
    valor: "", vencimento: new Date().toISOString().slice(0, 10),
    cliente_id: "",
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clientes-base?limite=200").then((r) => r.json()).then((j) => { if (j.ok) setClientes(j.clientes); });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/sistema/conta-receber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor: parseFloat(form.valor) || 0,
          cliente_id: form.cliente_id ? parseInt(form.cliente_id, 10) : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErro(j.motivo || "Falha"); return; }
      onSaved(); onClose();
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={salvar} className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova conta a receber</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400">Descrição *</label>
            <input required value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Valor (R$) *</label>
              <input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Vencimento *</label>
              <input required type="date" value={form.vencimento} onChange={(e) => setForm((p) => ({ ...p, vencimento: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Cliente (opcional)</label>
            <select value={form.cliente_id} onChange={(e) => setForm((p) => ({ ...p, cliente_id: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">— Nenhum —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_razao}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Origem</label>
            <select value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              {ORIGENS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
