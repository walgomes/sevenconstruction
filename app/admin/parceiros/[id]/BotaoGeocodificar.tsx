"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BotaoGeocodificar({
  id, temCep, temCoords,
}: { id: number; temCep: boolean; temCoords: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function rodar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}/geocodificar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  if (!temCep) return <span className="text-xs text-zinc-600">sem CEP cadastrado</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={rodar}
        disabled={carregando}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:border-zinc-500 disabled:opacity-50"
      >
        {carregando ? "..." : temCoords ? "📍 Re-geocodificar" : "📍 Geocodificar CEP"}
      </button>
      {erro && <span className="text-xs text-rose-300">{erro}</span>}
    </div>
  );
}
