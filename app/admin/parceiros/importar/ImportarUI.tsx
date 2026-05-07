"use client";

import { useEffect, useMemo, useState } from "react";
import { TIPOS_PARCEIRO, type TipoParceiro } from "@/lib/parceiros-tipos";

type Item = { url: string; slug: string; ja_importado: boolean };
type ResultadoLote = {
  url: string;
  ok: boolean;
  motivo?: string;
  parceiro_id?: number;
  codigo?: number;
};

const LOTE_MAX = 50;

export default function ImportarUI() {
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarImportados, setMostrarImportados] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<TipoParceiro>("fabrica");
  const [importando, setImportando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoLote[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/parceiros/importar/sitemap")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.motivo || `status ${r.status}`);
        setItens(j.itens);
      })
      .catch((e) => setErroLista(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (!mostrarImportados && i.ja_importado) return false;
      if (!q) return true;
      return i.slug.includes(q);
    });
  }, [itens, busca, mostrarImportados]);

  function toggle(url: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(url)) n.delete(url); else n.add(url);
      return n;
    });
  }

  function selecionarTodos() {
    const atual = new Set(selecionados);
    for (const i of filtrados.slice(0, LOTE_MAX)) {
      if (!i.ja_importado) atual.add(i.url);
    }
    setSelecionados(atual);
  }

  function limpar() { setSelecionados(new Set()); }

  async function importar() {
    if (selecionados.size === 0) return;
    setImportando(true);
    setResultados(null);
    try {
      const r = await fetch("/api/admin/parceiros/importar/lote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, urls: [...selecionados] }),
      });
      const j = await r.json();
      setResultados(j.resultados ?? []);
      // Marcar como ja_importado no estado local
      const sucessos = new Set<string>(
        (j.resultados ?? []).filter((x: ResultadoLote) => x.ok).map((x: ResultadoLote) => x.url),
      );
      setItens((prev) => prev.map((i) => (sucessos.has(i.url) ? { ...i, ja_importado: true } : i)));
      setSelecionados(new Set());
    } catch (e) {
      setResultados([{ url: "", ok: false, motivo: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setImportando(false);
    }
  }

  if (carregando) return <p className="mt-6 text-sm text-zinc-500">Carregando sitemap...</p>;
  if (erroLista) return (
    <p className="mt-6 rounded-md border border-rose-700/40 bg-rose-950/30 p-3 text-sm text-rose-300">
      Falha ao carregar sitemap: {erroLista}
    </p>
  );

  const importadosCount = itens.filter((i) => i.ja_importado).length;

  return (
    <>
      <section className="mt-6 grid grid-cols-3 gap-2">
        <Stat label="Total no sitemap" valor={itens.length} />
        <Stat label="Já importados" valor={importadosCount} cor="text-emerald-300" />
        <Stat label="Selecionados" valor={selecionados.size} cor="text-rose-300" />
      </section>

      <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por slug (parte do nome)"
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-sm placeholder:text-zinc-600 focus:border-rose-600 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={mostrarImportados}
              onChange={(e) => setMostrarImportados(e.target.checked)}
              className="accent-rose-600"
            />
            Mostrar já importados
          </label>
          <button
            onClick={selecionarTodos}
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs hover:border-zinc-500"
          >
            Selecionar até {LOTE_MAX}
          </button>
          {selecionados.size > 0 && (
            <button
              onClick={limpar}
              type="button"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100"
            >
              Limpar seleção
            </button>
          )}
        </div>

        <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-md border border-zinc-800">
          <ul className="divide-y divide-zinc-800">
            {filtrados.slice(0, 200).map((i) => {
              const selecionado = selecionados.has(i.url);
              return (
                <li key={i.url} className={`flex items-center gap-3 px-3 py-2 text-sm ${i.ja_importado ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selecionado}
                    disabled={i.ja_importado}
                    onChange={() => toggle(i.url)}
                    className="accent-rose-600"
                  />
                  <span className="flex-1 truncate font-mono text-xs text-zinc-300">{i.slug}</span>
                  {i.ja_importado && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400">já</span>
                  )}
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-zinc-500 hover:text-rose-300"
                  >
                    abrir
                  </a>
                </li>
              );
            })}
            {filtrados.length > 200 && (
              <li className="px-3 py-2 text-center text-xs text-zinc-500">
                +{filtrados.length - 200} ocultos — refine a busca pra ver mais
              </li>
            )}
            {filtrados.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-zinc-500">Nenhum resultado.</li>
            )}
          </ul>
        </div>
      </section>

      {selecionados.size > 0 && (
        <section className="sticky bottom-2 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-700/40 bg-zinc-950 p-4 shadow-xl">
          <div className="flex items-center gap-3 text-sm">
            <strong className="text-rose-300">{selecionados.size}</strong>
            <span className="text-zinc-400">URLs selecionadas — aplicar tipo:</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoParceiro)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            >
              {TIPOS_PARCEIRO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.rotulo}</option>
              ))}
            </select>
          </div>
          <button
            disabled={importando}
            onClick={importar}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {importando ? "Importando..." : `Importar ${selecionados.size}`}
          </button>
        </section>
      )}

      {resultados && (
        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Resultado da última importação</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {resultados.filter((r) => r.ok).length} OK · {resultados.filter((r) => !r.ok).length} falhas
          </p>
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
            {resultados.map((r, idx) => (
              <li key={idx} className={r.ok ? "text-emerald-300" : "text-amber-300"}>
                {r.ok ? "✓" : "✗"} {r.url.replace(/^https?:\/\/[^/]+/, "")} {r.codigo ? ` → #${r.codigo}` : ""} {r.motivo ? ` (${r.motivo})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, valor, cor }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${cor ?? "text-zinc-100"}`}>{valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}
