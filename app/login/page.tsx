"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!aceiteTermos) {
      setErro("Aceite os termos para continuar");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha, aceite_termos: true }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha no login");
        return;
      }
      const dest =
        params.get("redirect") ||
        (j.role === "super" ? "/admin" : "/loja");
      router.push(dest);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-zinc-400 hover:text-zinc-100">
        ← voltar
      </Link>
      <h1 className="text-2xl font-semibold">Entrar na sua loja</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Acesso para usuários da loja (dono, gerente, vendedor).
      </p>

      <form onSubmit={entrar} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-zinc-300">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-300">Senha</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-500"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={aceiteTermos}
            onChange={(e) => setAceiteTermos(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <span>
            Aceito os{" "}
            <Link href="/termos" target="_blank" className="text-amber-400 hover:underline">
              Termos de Uso e Política de Privacidade
            </Link>
          </span>
        </label>

        {erro && (
          <div className="rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={carregando || !aceiteTermos}
          className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-xs text-zinc-500">
        Não tem conta? Fale com o administrador da plataforma para cadastrar
        sua loja.
      </p>
    </main>
  );
}
