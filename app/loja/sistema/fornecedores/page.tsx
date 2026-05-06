"use client";

import { useEffect, useState, useCallback } from "react";

type Fornecedor = {
  id: number; cnpj: string | null; razao_social: string;
  nome_fantasia: string | null; email: string | null; telefone: string | null;
  cidade: string | null; uf: string | null;
  prazo_pagamento_dias: number; condicao_pagamento: string | null;
};

function fmtCnpj(s: string | null) {
  if (!s || s.length !== 14) return s || "—";
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca.trim()) params.set("busca", busca.trim());
    const r = await fetch(`/api/sistema/fornecedores?${params}`);
    const j = await r.json();
    if (j.ok) setFornecedores(j.fornecedores);
    setCarregando(false);
  }, [busca]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Sistema Loja · Fornecedores</p>
          <h1 className="mt-1 text-3xl font-semibold">🏭 Fornecedores</h1>
        </div>
        <button onClick={() => setModal(true)} className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400">
          + Novo fornecedor
        </button>
      </header>

      <div className="mt-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Razão social, fantasia ou CNPJ..."
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-zinc-500">Carregando...</p>
      ) : fornecedores.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhum fornecedor. <button onClick={() => setModal(true)} className="text-amber-400 hover:underline">Cadastre o primeiro</button>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">CNPJ</th>
                <th className="px-3 py-2">Cidade/UF</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">Prazo pgto</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.razao_social}</div>
                    {f.nome_fantasia && <div className="text-xs text-zinc-500">{f.nome_fantasia}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">{fmtCnpj(f.cnpj)}</td>
                  <td className="px-3 py-2">{f.cidade ? `${f.cidade}/${f.uf}` : f.uf || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {f.telefone || "—"}
                    {f.email && <div className="text-zinc-500">{f.email}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {f.prazo_pagamento_dias > 0 ? `${f.prazo_pagamento_dias} dias` : "À vista"}
                    {f.condicao_pagamento && <div className="text-zinc-500">{f.condicao_pagamento}</div>}
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
    cnpj: "", razao_social: "", nome_fantasia: "",
    email: "", telefone: "", whatsapp: "",
    cidade: "", uf: "BA",
    prazo_pagamento_dias: "30", condicao_pagamento: "", pix_chave: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/sistema/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          prazo_pagamento_dias: parseInt(form.prazo_pagamento_dias, 10) || 0,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErro(j.motivo || "Falha"); return; }
      onSaved(); onClose();
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={salvar} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo fornecedor</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Razão social *</label>
            <input required value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
          <Field label="Nome fantasia" v={form.nome_fantasia} on={(v) => set("nome_fantasia", v)} />
          <Field label="CNPJ" v={form.cnpj} on={(v) => set("cnpj", v)} placeholder="00.000.000/0000-00" />
          <Field label="Email" v={form.email} on={(v) => set("email", v)} type="email" />
          <Field label="Telefone" v={form.telefone} on={(v) => set("telefone", v)} />
          <Field label="WhatsApp" v={form.whatsapp} on={(v) => set("whatsapp", v)} />
          <Field label="Chave Pix" v={form.pix_chave} on={(v) => set("pix_chave", v)} />
          <Field label="Cidade" v={form.cidade} on={(v) => set("cidade", v)} />
          <Field label="UF" v={form.uf} on={(v) => set("uf", v.toUpperCase().slice(0, 2))} maxLength={2} />
          <Field label="Prazo pgto (dias)" v={form.prazo_pagamento_dias} on={(v) => set("prazo_pagamento_dias", v)} type="number" />
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Condição de pagamento</label>
            <input value={form.condicao_pagamento} onChange={(e) => set("condicao_pagamento", e.target.value)} placeholder="Ex: 30/60/90 dias, à vista 5% desc" className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
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

function Field({ label, v, on, type, placeholder, maxLength }: {
  label: string; v: string; on: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} type={type} placeholder={placeholder} maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
    </div>
  );
}
