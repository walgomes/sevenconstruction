"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FASES_HOMOLOG,
  TIPOS_PARCEIRO,
  type FaseHomolog,
  type Parceiro,
} from "@/lib/parceiros-tipos";

type Props = {
  parceiros: Parceiro[];
  kpisSrm: Record<string, number | null>;
};

export default function KanbanView({ parceiros: inicial, kpisSrm }: Props) {
  const [parceiros, setParceiros] = useState(inicial);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [over, setOver] = useState<FaseHomolog | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const m: Record<FaseHomolog, Parceiro[]> = {
      solicitacao: [], pre_check: [], analises: [], consolidacao: [],
      decisao: [], homologado: [], reprovado: [],
    };
    for (const p of parceiros) m[p.fase_homolog].push(p);
    return m;
  }, [parceiros]);

  async function mover(parceiro_id: number, novaFase: FaseHomolog) {
    const p = parceiros.find((x) => x.id === parceiro_id);
    if (!p || p.fase_homolog === novaFase) return;
    setMovendo(true);
    setErro(null);
    // optimistic
    setParceiros((prev) => prev.map((x) => (x.id === parceiro_id ? { ...x, fase_homolog: novaFase } : x)));
    try {
      const r = await fetch(`/api/admin/parceiros/${parceiro_id}/mover-fase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fase: novaFase }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.motivo || `status ${r.status}`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      // revert
      setParceiros((prev) => prev.map((x) => (x.id === parceiro_id ? { ...x, fase_homolog: p.fase_homolog } : x)));
    } finally {
      setMovendo(false);
    }
  }

  return (
    <section className="mt-5">
      {erro && (
        <div className="mb-3 rounded-md border border-rose-700/40 bg-rose-950/30 p-2 text-sm text-rose-300">
          {erro}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {FASES_HOMOLOG.map((f) => (
          <div key={f.valor} className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
            <p className="truncate text-[10px] uppercase tracking-wider text-zinc-500">{f.rotulo}</p>
            <p className="mt-0.5 text-base font-semibold text-zinc-100">
              {Number(kpisSrm[f.valor] ?? grupos[f.valor].length)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {FASES_HOMOLOG.map((f) => (
          <Coluna
            key={f.valor}
            fase={f.valor}
            rotulo={f.rotulo}
            cor={f.cor}
            cards={grupos[f.valor]}
            highlightOver={over === f.valor}
            onDragOver={(e) => { e.preventDefault(); setOver(f.valor); }}
            onDragLeave={() => setOver((x) => (x === f.valor ? null : x))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = Number(e.dataTransfer.getData("text/parceiro-id"));
              if (Number.isFinite(id)) mover(id, f.valor);
            }}
            onCardDragStart={(id) => setArrastando(id)}
            onCardDragEnd={() => setArrastando(null)}
            arrastando={arrastando}
            movendo={movendo}
            onCliqueMover={mover}
          />
        ))}
      </div>
    </section>
  );
}

function Coluna({
  fase, rotulo, cor, cards, highlightOver,
  onDragOver, onDragLeave, onDrop,
  onCardDragStart, onCardDragEnd, arrastando, movendo, onCliqueMover,
}: {
  fase: FaseHomolog;
  rotulo: string;
  cor: string;
  cards: Parceiro[];
  highlightOver: boolean;
  onDragOver: React.DragEventHandler<HTMLDivElement>;
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
  onDrop: React.DragEventHandler<HTMLDivElement>;
  onCardDragStart: (id: number) => void;
  onCardDragEnd: () => void;
  arrastando: number | null;
  movendo: boolean;
  onCliqueMover: (id: number, fase: FaseHomolog) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex w-72 shrink-0 flex-col rounded-xl border ${
        highlightOver ? "border-rose-500 bg-rose-950/10" : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cor}`}>
          {rotulo}
        </span>
        <span className="text-xs text-zinc-500">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-600">— vazia —</p>
        ) : (
          cards.slice(0, 50).map((p) => (
            <Card
              key={p.id}
              p={p}
              fase={fase}
              arrastando={arrastando === p.id}
              movendo={movendo}
              onDragStart={() => onCardDragStart(p.id)}
              onDragEnd={onCardDragEnd}
              onCliqueMover={onCliqueMover}
            />
          ))
        )}
        {cards.length > 50 && (
          <p className="px-2 py-1 text-center text-[10px] text-zinc-500">+{cards.length - 50} ocultos</p>
        )}
      </div>
    </div>
  );
}

function Card({
  p, fase, arrastando, movendo, onDragStart, onDragEnd, onCliqueMover,
}: {
  p: Parceiro;
  fase: FaseHomolog;
  arrastando: boolean;
  movendo: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCliqueMover: (id: number, fase: FaseHomolog) => void;
}) {
  const tipoMeta = TIPOS_PARCEIRO.find((t) => t.valor === p.tipo);
  const idxFase = FASES_HOMOLOG.findIndex((f) => f.valor === fase);
  const proxima = FASES_HOMOLOG[idxFase + 1]?.valor;
  const anterior = idxFase > 0 ? FASES_HOMOLOG[idxFase - 1].valor : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/parceiro-id", String(p.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-md border bg-zinc-900 p-2 text-left text-xs transition ${
        arrastando ? "opacity-40" : "hover:border-rose-700/60"
      } border-zinc-800`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/parceiros/${p.id}`} className="line-clamp-2 flex-1 font-semibold text-zinc-100 hover:text-rose-300">
          {p.nome_fantasia}
        </Link>
        <span className="shrink-0 font-mono text-[10px] text-zinc-500">#{p.codigo}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${tipoMeta?.cor ?? ""}`}>
          {tipoMeta?.rotulo ?? p.tipo}
        </span>
        {p.uf && <span className="text-[10px] text-zinc-500">{p.uf}</span>}
        {p.trust_score != null && <ChipScore score={p.trust_score} />}
        {p.risco_inicial && <ChipRisco risco={p.risco_inicial} />}
      </div>
      {p.recomendacao_ia && (
        <p className="mt-1.5 line-clamp-2 text-[10px] text-zinc-400">
          🤖 {p.recomendacao_ia.toUpperCase()}: {p.recomendacao_motivo ?? "—"}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100">
        {anterior ? (
          <button
            disabled={movendo}
            onClick={() => onCliqueMover(p.id, anterior)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 disabled:opacity-30"
            title="Voltar fase"
          >
            ←
          </button>
        ) : <span />}
        {proxima && (
          <button
            disabled={movendo}
            onClick={() => onCliqueMover(p.id, proxima)}
            className="rounded border border-rose-700/50 bg-rose-950/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-900/40 disabled:opacity-30"
            title="Avançar"
          >
            avançar →
          </button>
        )}
      </div>
    </div>
  );
}

function ChipScore({ score }: { score: number }) {
  const cor = score >= 70 ? "bg-emerald-900/40 text-emerald-300"
            : score >= 40 ? "bg-amber-900/40 text-amber-300"
            : "bg-rose-900/40 text-rose-300";
  return <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${cor}`}>{score}</span>;
}
function ChipRisco({ risco }: { risco: "baixo"|"medio"|"alto" }) {
  const cor = risco === "alto" ? "text-rose-400" : risco === "medio" ? "text-amber-400" : "text-emerald-400";
  return <span className={`text-[9px] uppercase ${cor}`}>{risco}</span>;
}
