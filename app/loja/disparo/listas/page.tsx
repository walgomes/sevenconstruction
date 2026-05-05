"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Lista = {
  id: number;
  nome: string;
  descricao: string | null;
  origem: string;
  total_contatos: number;
  ativo: boolean;
  criado_em: string;
};

type ProspecLista = { id: number; nome: string; total_itens: number; criado_em: string };

export default function ListasDisparoPage() {
  const [listas, setListas] = useState<Lista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch("/api/disparo/listas");
    const j = await r.json();
    if (j.ok) setListas(j.listas);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Disparo</p>
          <h1 className="mt-1 text-3xl font-semibold">Listas (audiência)</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crie uma lista a partir da prospecção ou da base de clientes — depois usa em campanhas.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Nova lista
          </button>
          <Link
            href="/loja/disparo"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            ← Disparo
          </Link>
        </div>
      </header>

      {carregando ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando...</p>
      ) : listas.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhuma lista. <button onClick={() => setModalAberto(true)} className="text-amber-400 hover:underline">Crie a primeira</button>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {listas.map((l) => (
            <li key={l.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{l.nome}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Origem: {l.origem} · Criada em {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                  {l.descricao && <p className="mt-1 text-sm text-zinc-400">{l.descricao}</p>}
                </div>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                  {l.total_contatos} contatos
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalAberto && <ModalNova onClose={() => setModalAberto(false)} onSaved={carregar} />}
    </main>
  );
}

function ModalNova({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prospecListas, setProspecListas] = useState<ProspecLista[]>([]);
  const [prospecListaId, setProspecListaId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prospec/listas").then((r) => r.json()).then((j) => setProspecListas(j.listas || []));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/disparo/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          descricao: descricao || undefined,
          prospec_lista_id: prospecListaId ?? undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      if (j.importados !== undefined) {
        setResultado(`Lista criada com ${j.importados} contatos importados`);
      } else {
        setResultado("Lista criada");
      }
      onSaved();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova lista</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400">Nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Descrição (opcional)</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Importar de uma lista de prospecção (opcional)</label>
            <select
              value={prospecListaId ?? ""}
              onChange={(e) => setProspecListaId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="">— Lista vazia (adicionar contatos depois) —</option>
              {prospecListas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.total_itens} empresas)
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro && (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}
        {resultado && (
          <div className="mt-3 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {resultado}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm"
          >
            Fechar
          </button>
          {!resultado && (
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Criar"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
