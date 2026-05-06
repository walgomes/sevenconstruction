"use client";

import { useEffect, useState, useCallback } from "react";

type Produto = {
  id: number; codigo: string | null; nome: string;
  categoria: string | null; marca: string | null; ncm: string | null; unidade: string;
  preco_custo: number; preco_venda: number;
  estoque_atual: number; estoque_minimo: number;
};

const CATEGORIAS = [
  "cimento", "areia_brita", "blocos", "ferragens", "tintas",
  "eletrica", "hidraulica", "ferramentas", "acessorios", "outros",
];

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estoqueBaixo, setEstoqueBaixo] = useState(false);
  const [modal, setModal] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca.trim()) params.set("busca", busca.trim());
    if (categoria) params.set("categoria", categoria);
    if (estoqueBaixo) params.set("estoque_baixo", "1");
    const r = await fetch(`/api/sistema/produtos?${params}`);
    const j = await r.json();
    if (j.ok) setProdutos(j.produtos);
    setCarregando(false);
  }, [busca, categoria, estoqueBaixo]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Sistema Loja · Produtos</p>
          <h1 className="mt-1 text-3xl font-semibold">📦 Produtos & Estoque</h1>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          + Novo produto
        </button>
      </header>

      <div className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 nome, código, marca"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={estoqueBaixo} onChange={(e) => setEstoqueBaixo(e.target.checked)} className="accent-amber-500" />
          Só estoque baixo
        </label>
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-zinc-500">Carregando...</p>
      ) : produtos.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhum produto. <button onClick={() => setModal(true)} className="text-amber-400 hover:underline">Cadastre o primeiro</button>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Custo</th>
                <th className="px-3 py-2 text-right">Venda</th>
                <th className="px-3 py-2 text-right">Margem</th>
                <th className="px-3 py-2 text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const margem = p.preco_custo > 0 ? ((p.preco_venda - p.preco_custo) / p.preco_custo) * 100 : 0;
                const estoqueBaixo = p.estoque_atual <= p.estoque_minimo;
                return (
                  <tr key={p.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{p.codigo || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.nome}</div>
                      {p.marca && <div className="text-xs text-zinc-500">{p.marca}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{p.categoria || "—"}</td>
                    <td className="px-3 py-2 text-right">{fmtBrl(p.preco_custo)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtBrl(p.preco_venda)}</td>
                    <td className={`px-3 py-2 text-right ${margem < 20 ? "text-red-300" : "text-emerald-300"}`}>
                      {margem.toFixed(0)}%
                    </td>
                    <td className={`px-3 py-2 text-right ${estoqueBaixo ? "text-red-300" : ""}`}>
                      {p.estoque_atual.toFixed(p.estoque_atual % 1 === 0 ? 0 : 2)} {p.unidade}
                      {estoqueBaixo && <span className="ml-1 text-xs">⚠️</span>}
                    </td>
                  </tr>
                );
              })}
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
    codigo: "", nome: "", categoria: "cimento", marca: "", ncm: "", unidade: "un",
    preco_custo: "", preco_venda: "", estoque_atual: "0", estoque_minimo: "0",
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
      const r = await fetch("/api/sistema/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          preco_custo: parseFloat(form.preco_custo) || 0,
          preco_venda: parseFloat(form.preco_venda) || 0,
          estoque_atual: parseFloat(form.estoque_atual) || 0,
          estoque_minimo: parseFloat(form.estoque_minimo) || 0,
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
          <h2 className="text-lg font-semibold">Novo produto</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Nome" value={form.nome} onChange={(v) => set("nome", v)} required />
          <Field label="Código (SKU)" value={form.codigo} onChange={(v) => set("codigo", v)} />
          <div>
            <label className="text-xs text-zinc-400">Categoria</label>
            <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Field label="Marca" value={form.marca} onChange={(v) => set("marca", v)} />
          <Field label="NCM (8 dígitos)" value={form.ncm} onChange={(v) => set("ncm", v)} />
          <Field label="Unidade (un, saco, kg, m3...)" value={form.unidade} onChange={(v) => set("unidade", v)} />
          <Field label="Preço de custo (R$)" value={form.preco_custo} onChange={(v) => set("preco_custo", v)} type="number" />
          <Field label="Preço de venda (R$)" value={form.preco_venda} onChange={(v) => set("preco_venda", v)} type="number" />
          <Field label="Estoque atual" value={form.estoque_atual} onChange={(v) => set("estoque_atual", v)} type="number" />
          <Field label="Estoque mínimo (alerta)" value={form.estoque_minimo} onChange={(v) => set("estoque_minimo", v)} type="number" />
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

function Field({ label, value, onChange, required, type }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        required={required} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
      />
    </div>
  );
}
