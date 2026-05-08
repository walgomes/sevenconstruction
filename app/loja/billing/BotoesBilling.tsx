"use client";

import { useState } from "react";

export default function BotoesBilling({
  stripeConfigurado,
  planoAtualCodigo,
  alvoPlano,
}: {
  stripeConfigurado: boolean;
  planoAtualCodigo?: string | null;
  alvoPlano?: string;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function checkout(plano: string) {
    setCarregando(true); setErro(null);
    try {
      const r = await fetch("/api/loja/billing/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ plano_codigo: plano }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      window.location.href = j.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setCarregando(false); }
  }

  async function portal() {
    setCarregando(true); setErro(null);
    try {
      const r = await fetch("/api/loja/billing/portal", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      window.location.href = j.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setCarregando(false); }
  }

  if (alvoPlano) {
    return (
      <div>
        <button onClick={() => checkout(alvoPlano)} disabled={carregando || !stripeConfigurado}
          className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
          {carregando ? "..." : `Assinar ${alvoPlano}`}
        </button>
        {erro && <p className="mt-1 text-xs text-rose-300">⚠️ {erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {planoAtualCodigo && (
        <button onClick={portal} disabled={carregando}
          className="rounded-md border border-current/40 bg-current/10 px-4 py-2 text-sm font-medium hover:bg-current/20 disabled:opacity-50">
          {carregando ? "..." : "🔧 Gerenciar (cartão, NF, cancelar)"}
        </button>
      )}
      {erro && <p className="basis-full text-xs text-rose-300">⚠️ {erro}</p>}
    </div>
  );
}
