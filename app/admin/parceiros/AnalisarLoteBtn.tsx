"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnalisarLoteBtn() {
  const router = useRouter();
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function rodar() {
    if (!confirm("Analisar até 50 parceiros pendentes (fase=solicitação)? Pode levar 1-3 minutos.")) return;
    setAnalisando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/admin/parceiros/analisar-lote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fase: "solicitacao", limite: 50 }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
      setResultado(`${j.sucesso}/${j.processados} OK`);
      router.refresh();
    } catch (e) {
      setResultado(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <>
      <button
        onClick={rodar}
        disabled={analisando}
        className="rounded-lg border border-rose-700/40 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
      >
        {analisando ? "Analisando..." : "🤖 Analisar pendentes (lote)"}
      </button>
      {resultado && <span className="text-xs text-zinc-400">{resultado}</span>}
    </>
  );
}
