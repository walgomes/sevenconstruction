"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FASES_HOMOLOG, type FaseHomolog } from "@/lib/parceiros-tipos";

export default function AcoesParceiro({ id, fase }: { id: number; fase: FaseHomolog }) {
  const router = useRouter();
  const [analisando, setAnalisando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function analisar() {
    setAnalisando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}/analisar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalisando(false);
    }
  }

  async function moverPara(novaFase: FaseHomolog, motivoLabel: string) {
    if (!confirm(`Confirma ${motivoLabel}?`)) return;
    setMovendo(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}/mover-fase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fase: novaFase, motivo: motivoLabel }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setMovendo(false);
    }
  }

  const idx = FASES_HOMOLOG.findIndex((f) => f.valor === fase);
  const proxima = FASES_HOMOLOG[idx + 1]?.valor;
  const podeAprovar = fase === "decisao" || fase === "consolidacao";
  const podeReprovar = fase !== "homologado" && fase !== "reprovado";

  return (
    <section className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <button
        onClick={analisar}
        disabled={analisando || movendo}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {analisando ? "Analisando..." : "🤖 Disparar análise IA"}
      </button>

      {proxima && proxima !== "homologado" && proxima !== "reprovado" && (
        <button
          onClick={() => moverPara(proxima, `Avançar para ${proxima}`)}
          disabled={analisando || movendo}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
        >
          → Avançar fase
        </button>
      )}

      {podeAprovar && (
        <button
          onClick={() => moverPara("homologado", "Homologar parceiro")}
          disabled={analisando || movendo}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          ✓ Homologar
        </button>
      )}

      {podeReprovar && (
        <button
          onClick={() => moverPara("reprovado", "Reprovar parceiro")}
          disabled={analisando || movendo}
          className="rounded-lg border border-rose-700/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
        >
          ✗ Reprovar
        </button>
      )}

      {erro && (
        <p className="basis-full rounded-md border border-rose-700/40 bg-rose-950/30 p-2 text-xs text-rose-300">
          {erro}
        </p>
      )}
    </section>
  );
}
