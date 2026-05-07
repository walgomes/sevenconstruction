"use client";

import { useState } from "react";
import type { Sku } from "@/lib/skus";

const UNIDADES_COMUNS = ["", "saco 50kg", "saco 25kg", "kg", "ton", "m³", "m²", "m", "un", "pç", "litro", "barra"];

export default function SkusParceiro({ id, skusIniciais }: { id: number; skusIniciais: Sku[] }) {
  const [skus, setSkus] = useState(skusIniciais);
  const [ncm, setNcm] = useState("");
  const [sku, setSku] = useState("");
  const [descricao, setDescricao] = useState("");
  const [marca, setMarca] = useState("");
  const [unidade, setUnidade] = useState("");
  const [norma, setNorma] = useState("");
  const [preco, setPreco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}/skus`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ncm: ncm || null,
          sku: sku || null,
          descricao,
          marca: marca || null,
          unidade: unidade || null,
          norma_abnt: norma || null,
          preco_referencia: preco ? parseFloat(preco.replace(",", ".")) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setSkus((p) => [j.sku, ...p]);
      setNcm(""); setSku(""); setDescricao(""); setMarca(""); setUnidade(""); setNorma(""); setPreco("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(skuId: number) {
    if (!confirm("Remover SKU?")) return;
    const r = await fetch(`/api/admin/parceiros/${id}/skus/${skuId}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) setSkus((p) => p.filter((s) => s.id !== skuId));
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Catálogo de SKUs <span className="text-zinc-600">(diferencial #2 — match por NCM/produto)</span>
      </h2>

      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <form onSubmit={adicionar} className="grid gap-2 sm:grid-cols-12">
          <input
            value={ncm}
            onChange={(e) => setNcm(e.target.value.replace(/\D+/g, "").slice(0, 8))}
            placeholder="NCM (8 dígitos)"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-2"
          />
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-2"
          />
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (ex: Cimento CP-II-Z-32 saco 50kg) *"
            required
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-4"
          />
          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-2"
          />
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-2"
          >
            {UNIDADES_COMUNS.map((u) => <option key={u} value={u}>{u || "Unidade..."}</option>)}
          </select>
          <input
            value={norma}
            onChange={(e) => setNorma(e.target.value)}
            placeholder="Norma ABNT (NBR 11578)"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-3"
          />
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Preço ref"
            type="text"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs sm:col-span-2"
          />
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500 disabled:opacity-50 sm:col-span-7"
          >
            {salvando ? "..." : "+ Adicionar SKU"}
          </button>
        </form>
        {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}

        {skus.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nenhum SKU cadastrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2 text-left">NCM</th>
                  <th className="px-2 py-2 text-left">Descrição</th>
                  <th className="px-2 py-2 text-left">Marca</th>
                  <th className="px-2 py-2 text-left">Unidade</th>
                  <th className="px-2 py-2 text-left">Norma</th>
                  <th className="px-2 py-2 text-right">Preço ref</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {skus.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-900/40">
                    <td className="px-2 py-1.5 font-mono text-zinc-400">{s.ncm ?? "—"}</td>
                    <td className="px-2 py-1.5 font-medium text-zinc-100">
                      {s.descricao}
                      {s.sku && <span className="ml-2 text-[10px] font-normal text-zinc-500">SKU: {s.sku}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-400">{s.marca ?? "—"}</td>
                    <td className="px-2 py-1.5 text-zinc-400">{s.unidade ?? "—"}</td>
                    <td className="px-2 py-1.5 text-zinc-400">{s.norma_abnt ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">
                      {s.preco_referencia != null
                        ? `R$ ${Number(s.preco_referencia).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => remover(s.id)}
                        className="text-[10px] text-zinc-500 hover:text-rose-300"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
