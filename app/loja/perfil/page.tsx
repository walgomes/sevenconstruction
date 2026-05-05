"use client";

import { useEffect, useState } from "react";

type Loja = {
  id: number;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  email_contato: string;
  telefone: string | null;
  whatsapp: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  raio_atuacao_km: number;
  plano: string;
};

export default function PerfilLojaPage() {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/loja/perfil")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setLoja(j.loja); })
      .finally(() => setCarregando(false));
  }, []);

  function set<K extends keyof Loja>(k: K, v: Loja[K]) {
    if (!loja) return;
    setLoja({ ...loja, [k]: v });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!loja) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      const r = await fetch("/api/loja/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loja),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha ao salvar");
        return;
      }
      setMsg("✓ Perfil atualizado");
    } catch {
      setErro("Erro de rede");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <main className="mx-auto max-w-3xl px-6 py-8"><p className="text-zinc-500">Carregando...</p></main>;
  if (!loja) return <main className="mx-auto max-w-3xl px-6 py-8"><p className="text-red-300">Loja não encontrada</p></main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Perfil</p>
        <h1 className="mt-1 text-3xl font-semibold">Editar dados da loja</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plano atual: <span className="text-amber-300">{loja.plano}</span>
        </p>
      </header>

      <form onSubmit={salvar} className="mt-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome fantasia" valor={loja.nome_fantasia} onChange={(v) => set("nome_fantasia", v)} required />
          <Field label="Razão social" valor={loja.razao_social ?? ""} onChange={(v) => set("razao_social", v)} />
          <Field label="CNPJ" valor={loja.cnpj ?? ""} onChange={(v) => set("cnpj", v)} placeholder="00.000.000/0000-00" />
          <Field label="Email de contato" valor={loja.email_contato} onChange={(v) => set("email_contato", v)} required type="email" />
          <Field label="Telefone" valor={loja.telefone ?? ""} onChange={(v) => set("telefone", v)} />
          <Field label="WhatsApp" valor={loja.whatsapp ?? ""} onChange={(v) => set("whatsapp", v)} />
        </div>

        <hr className="border-zinc-800" />

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="CEP" valor={loja.cep ?? ""} onChange={(v) => set("cep", v)} />
          <div className="md:col-span-2">
            <Field label="Endereço" valor={loja.endereco ?? ""} onChange={(v) => set("endereco", v)} />
          </div>
          <Field label="Número" valor={loja.numero ?? ""} onChange={(v) => set("numero", v)} />
          <Field label="Bairro" valor={loja.bairro ?? ""} onChange={(v) => set("bairro", v)} />
          <Field label="Cidade" valor={loja.cidade ?? ""} onChange={(v) => set("cidade", v)} />
          <Field label="UF" valor={loja.uf ?? ""} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} maxLength={2} />
          <div>
            <label className="text-xs text-zinc-400">Raio atuação (km)</label>
            <input
              type="number"
              min="1"
              max="500"
              value={loja.raio_atuacao_km}
              onChange={(e) => set("raio_atuacao_km", parseInt(e.target.value, 10) || 10)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {erro && (
          <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</div>
        )}
        {msg && (
          <div className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{msg}</div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label, valor, onChange, required, type, placeholder, maxLength,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        required={required}
        type={type}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
      />
    </div>
  );
}
