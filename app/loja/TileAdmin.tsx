"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TileAdmin() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/abrir-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setAberto(false);
      router.push("/admin");
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setAberto(true); setSenha(""); setErro(null); }}
        type="button"
        className="flex items-center justify-between rounded-lg border border-rose-700/40 bg-rose-950/20 px-4 py-3 text-left transition hover:border-rose-500/60 hover:bg-rose-950/40"
      >
        <span className="text-sm">🔐 Parceiros — Admin</span>
        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
          restrito
        </span>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Acesso administrativo</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Digite a senha de super-admin para acessar o módulo Parceiros.
            </p>
            <form onSubmit={entrar} className="mt-5 space-y-3">
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha admin"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
              />
              {erro && (
                <div className="rounded-md border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
                  {erro}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={carregando || !senha}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {carregando ? "..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
