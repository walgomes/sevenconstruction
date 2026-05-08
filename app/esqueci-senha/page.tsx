"use client";

import { useState } from "react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/login" className="mb-8 text-sm text-zinc-400 hover:text-zinc-100">← voltar pro login</Link>

      <h1 className="text-2xl font-semibold">Esqueci minha senha</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Digite o email cadastrado. Enviaremos um link válido por 60 minutos pra redefinir.
      </p>

      {enviado ? (
        <div className="mt-8 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-4 py-4 text-sm text-emerald-200">
          ✓ Se este email estiver cadastrado, você receberá o link em alguns minutos.
          Verifique também a caixa de spam.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-300">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            disabled={carregando || !email}
            className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Enviando..." : "Enviar link de redefinição"}
          </button>
        </form>
      )}
    </main>
  );
}
