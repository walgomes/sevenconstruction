"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AceitarConvitePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

interface ConviteInfo {
  loja_nome: string;
  email: string;
  papel: string;
  expira_em: string;
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") || "";

  const [info, setInfo] = useState<ConviteInfo | null>(null);
  const [carregandoInfo, setCarregandoInfo] = useState(true);
  const [erroInfo, setErroInfo] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setCarregandoInfo(false); setErroInfo("token ausente"); return; }
    fetch(`/api/auth/aceitar-convite?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setInfo(j.convite);
        else setErroInfo(j.motivo || "Convite inválido");
      })
      .finally(() => setCarregandoInfo(false));
  }, [token]);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== conf) { setErro("Senhas não conferem"); return; }
    setEnviando(true); setErro(null);
    try {
      const r = await fetch("/api/auth/aceitar-convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nome, senha, telefone: telefone || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      router.push("/loja");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setEnviando(false); }
  }

  if (carregandoInfo) {
    return <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6"><p className="text-zinc-400">Validando convite…</p></main>;
  }

  if (!info) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <span className="text-5xl">⚠️</span>
        <h1 className="mt-4 text-xl font-semibold">Convite inválido</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {erroInfo || "Este convite não é válido ou já expirou. Peça pra loja gerar um novo."}
        </p>
        <Link href="/login" className="mt-6 text-sm text-amber-400 hover:underline">Já tenho conta · Login</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 text-center">
        <span className="text-3xl">🎉</span>
        <h1 className="mt-2 text-xl font-bold text-zinc-100">
          Você foi convidado pra {info.loja_nome}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          como <strong className="text-amber-300">{info.papel}</strong>
        </p>
        <p className="mt-1 text-xs text-zinc-500">{info.email}</p>
      </div>

      <form onSubmit={aceitar} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-xs text-zinc-400">Seu nome *</span>
          <input required value={nome} onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Telefone/WhatsApp (opcional)</span>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Crie sua senha (8+ chars com letras e números) *</span>
          <input type="password" required minLength={8} autoComplete="new-password"
            value={senha} onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Confirmar senha *</span>
          <input type="password" required minLength={8}
            value={conf} onChange={(e) => setConf(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
        </label>

        {erro && (
          <div className="rounded-md border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">⚠️ {erro}</div>
        )}

        <button type="submit" disabled={enviando || !nome || senha !== conf || senha.length < 8}
          className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
          {enviando ? "Criando conta..." : "Aceitar convite e entrar"}
        </button>
      </form>
    </main>
  );
}
