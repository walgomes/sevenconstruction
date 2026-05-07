"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIPOS_PARCEIRO } from "@/lib/parceiros-tipos";

export default function FormNovoParceiro() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const produtosRaw = String(fd.get("produtos_csv") ?? "");
    const produtos = produtosRaw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      tipo:           fd.get("tipo"),
      nome_fantasia:  fd.get("nome_fantasia"),
      razao_social:   fd.get("razao_social"),
      cnpj:           fd.get("cnpj"),
      cnae_principal: fd.get("cnae_principal"),
      uf:             fd.get("uf"),
      cidade:         fd.get("cidade"),
      endereco:       fd.get("endereco"),
      cep:            fd.get("cep"),
      telefone:       fd.get("telefone"),
      whatsapp:       fd.get("whatsapp"),
      email:          fd.get("email"),
      site:           fd.get("site"),
      logo_url:       fd.get("logo_url"),
      notas:          fd.get("notas"),
      produtos,
    };

    try {
      const r = await fetch("/api/admin/parceiros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha ao salvar");
        setSalvando(false);
        return;
      }
      router.push(`/admin/parceiros/${j.parceiro.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo *">
          <select name="tipo" required className={selectCls}>
            {TIPOS_PARCEIRO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
        </Field>
        <Field label="Nome fantasia *">
          <input name="nome_fantasia" required className={inputCls} placeholder="Ex: Vedacit" />
        </Field>
        <Field label="Razão social">
          <input name="razao_social" className={inputCls} />
        </Field>
        <Field label="CNPJ">
          <input name="cnpj" className={inputCls} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="CNAE principal">
          <input name="cnae_principal" className={inputCls} placeholder="0000-0/00" />
        </Field>
        <Field label="UF">
          <input name="uf" maxLength={2} className={inputCls} placeholder="SP" />
        </Field>
        <Field label="Cidade">
          <input name="cidade" className={inputCls} />
        </Field>
        <Field label="CEP">
          <input name="cep" className={inputCls} placeholder="00000-000" />
        </Field>
        <Field label="Endereço" full>
          <input name="endereco" className={inputCls} />
        </Field>
        <Field label="Telefone">
          <input name="telefone" className={inputCls} />
        </Field>
        <Field label="WhatsApp">
          <input name="whatsapp" className={inputCls} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className={inputCls} />
        </Field>
        <Field label="Site">
          <input name="site" className={inputCls} placeholder="https://..." />
        </Field>
        <Field label="Logo (URL)" full>
          <input name="logo_url" className={inputCls} placeholder="https://..." />
        </Field>
        <Field label="Produtos (vírgula ou enter)" full>
          <textarea
            name="produtos_csv"
            rows={3}
            className={inputCls}
            placeholder="Cimento, Argamassa, Aditivo impermeabilizante"
          />
        </Field>
        <Field label="Notas internas" full>
          <textarea name="notas" rows={3} className={inputCls} />
        </Field>
      </div>

      {erro && (
        <p className="rounded-md border border-rose-700/40 bg-rose-950/30 p-2 text-sm text-rose-300">
          {erro}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar parceiro"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none";

const selectCls = inputCls;
