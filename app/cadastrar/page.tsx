"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function CadastrarPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome_fantasia: "", razao_social: "", cnpj: "",
    cidade: "", uf: "SP",
    nome_dono: "", email: "", senha: "", telefone: "",
    aceite_termos: false,
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.aceite_termos) {
      setErro("Aceite os termos para continuar");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      router.push("/loja");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">← voltar</Link>

      <header className="mt-6">
        <p className="text-xs uppercase tracking-wider text-amber-400">Nova loja</p>
        <h1 className="mt-1 text-3xl font-semibold">Crie sua conta grátis</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          14 dias de teste no plano <strong className="text-amber-300">Pro</strong> sem cartão de crédito.
          Cancele quando quiser. Após o trial, escolha entre Starter (R$ 99/mês), Pro (R$ 299) ou Enterprise (R$ 999).
        </p>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-amber-400">Dados da loja</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nome fantasia *" full>
              <input required value={form.nome_fantasia}
                onChange={(e) => set("nome_fantasia", e.target.value)}
                placeholder="Material Center Ltda" className={inputCls} />
            </Field>
            <Field label="Razão social">
              <input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} className={inputCls} />
            </Field>
            <Field label="CNPJ (opcional)">
              <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" className={inputCls} />
            </Field>
            <Field label="Cidade *">
              <input required value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={inputCls} />
            </Field>
            <Field label="UF *">
              <select required value={form.uf} onChange={(e) => set("uf", e.target.value)} className={inputCls}>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-amber-400">Conta do dono</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Seu nome *" full>
              <input required value={form.nome_dono} onChange={(e) => set("nome_dono", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email *">
              <input required type="email" value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Telefone/WhatsApp">
              <input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" className={inputCls} />
            </Field>
            <Field label="Senha *" full>
              <input required type="password" value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
                autoComplete="new-password" minLength={8}
                className={inputCls} />
              <p className="mt-1 text-xs text-zinc-500">Min 8 caracteres com letras e números</p>
            </Field>
          </div>
        </section>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={form.aceite_termos}
            onChange={(e) => set("aceite_termos", e.target.checked)}
            className="mt-0.5 accent-amber-500" />
          <span>
            Aceito os{" "}
            <Link href="/termos" target="_blank" className="text-amber-400 hover:underline">
              Termos de Uso e Política de Privacidade
            </Link>
            . Concordo que meus dados sejam tratados conforme LGPD pra entrega da plataforma.
          </span>
        </label>

        {erro && (
          <div className="rounded-md border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
            ⚠️ {erro}
          </div>
        )}

        <button type="submit" disabled={carregando || !form.aceite_termos}
          className="w-full rounded-md bg-amber-500 px-4 py-3 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
          {carregando ? "Criando sua loja…" : "🚀 Criar loja e começar trial 14d"}
        </button>

        <p className="text-center text-xs text-zinc-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-amber-400 hover:underline">Entrar</Link>
        </p>
      </form>
    </main>
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

const inputCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
