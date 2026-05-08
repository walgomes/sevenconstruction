"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FormIndicarCliente() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setErro(null); setOk(false);
    try {
      // Cliente final usa endpoint dedicado que infere cliente_origem da sessao
      const r = await fetch("/api/cliente/indicar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome_indicado: nome, contato_indicado: contato }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setOk(true);
      setNome(""); setContato("");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do amigo"
        required
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      <input
        value={contato}
        onChange={(e) => setContato(e.target.value)}
        placeholder="Email ou WhatsApp dele"
        required
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={carregando || !nome || !contato}
        className="w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {carregando ? "..." : "Indicar amigo"}
      </button>
      {erro && <p className="text-xs text-rose-300">⚠️ {erro}</p>}
      {ok && <p className="text-xs text-emerald-300">✓ Indicação enviada — você ganha 50 pts quando seu amigo comprar.</p>}
    </form>
  );
}
