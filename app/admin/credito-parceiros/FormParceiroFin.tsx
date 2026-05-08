"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIPOS = ["fidc","banco","fintech","factoring","cooperativa","cartao"];
const STATUS = ["ativo","avaliacao","contrato_pendente","integrando","pausado"];

export default function FormParceiroFin() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      nome: fd.get("nome"),
      tipo: fd.get("tipo"),
      cnpj: fd.get("cnpj") || null,
      taxa_minima_aa: numOrNull(fd.get("taxa_minima_aa")),
      taxa_maxima_aa: numOrNull(fd.get("taxa_maxima_aa")),
      prazo_min_dias: intOrNull(fd.get("prazo_min_dias")),
      prazo_max_dias: intOrNull(fd.get("prazo_max_dias")),
      ticket_min: numOrNull(fd.get("ticket_min")),
      ticket_max: numOrNull(fd.get("ticket_max")),
      comissao_loja_pct: numOrNull(fd.get("comissao_loja_pct")),
      status: fd.get("status"),
      adapter_codigo: fd.get("adapter_codigo") || null,
      observacoes: fd.get("observacoes") || null,
    };
    try {
      const r = await fetch("/api/admin/credito-parceiros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
      setAberto(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
      >
        + Novo parceiro financeiro
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Novo parceiro financeiro</h3>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
          cancelar
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nome *" full>
          <input name="nome" required className={inputCls} placeholder="FIDC Construa+" />
        </Field>
        <Field label="Tipo *">
          <select name="tipo" required className={inputCls}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="avaliacao" className={inputCls}>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="CNPJ">
          <input name="cnpj" className={inputCls} placeholder="só dígitos" />
        </Field>
        <Field label="Taxa min (% a.a.)">
          <input name="taxa_minima_aa" type="number" step="0.01" className={inputCls} placeholder="18" />
        </Field>
        <Field label="Taxa max (% a.a.)">
          <input name="taxa_maxima_aa" type="number" step="0.01" className={inputCls} placeholder="36" />
        </Field>
        <Field label="Prazo min (dias)">
          <input name="prazo_min_dias" type="number" className={inputCls} placeholder="30" />
        </Field>
        <Field label="Prazo max (dias)">
          <input name="prazo_max_dias" type="number" className={inputCls} placeholder="360" />
        </Field>
        <Field label="Ticket min (R$)">
          <input name="ticket_min" type="number" className={inputCls} placeholder="500" />
        </Field>
        <Field label="Ticket max (R$)">
          <input name="ticket_max" type="number" className={inputCls} placeholder="500000" />
        </Field>
        <Field label="Comissão loja (%)">
          <input name="comissao_loja_pct" type="number" step="0.01" className={inputCls} placeholder="1.5" />
        </Field>
        <Field label="Adapter (chave)">
          <input name="adapter_codigo" className={inputCls} placeholder="banco_xpto_v1" />
        </Field>
        <Field label="Observações" full>
          <textarea name="observacoes" rows={2} className={inputCls} />
        </Field>
      </div>
      {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={salvando}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
          {salvando ? "..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-3" : ""}`}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
}

const inputCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none";
