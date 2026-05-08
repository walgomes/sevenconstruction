"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") || "";

  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== conf) { setErro("As senhas não conferem"); return; }
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      router.push("/login?redefinida=1");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/login" className="mb-8 text-sm text-zinc-400 hover:text-zinc-100">← login</Link>

      <h1 className="text-2xl font-semibold">Redefinir senha</h1>
      <p className="mt-1 text-sm text-zinc-400">Escolha uma nova senha (mín. 8 caracteres com letras e números).</p>

      {!token ? (
        <div className="mt-8 rounded-md border border-rose-700/40 bg-rose-950/30 px-4 py-4 text-sm text-rose-200">
          Token não encontrado na URL. Solicite um novo link em <Link href="/esqueci-senha" className="text-amber-400 hover:underline">/esqueci-senha</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-300">Nova senha</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-300">Confirmar nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-500"
            />
          </label>

          {erro && (
            <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando || !senha || senha !== conf}
            className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}
    </main>
  );
}
