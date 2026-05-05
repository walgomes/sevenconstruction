"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Template = {
  id: number;
  nome: string;
  canal: string;
  assunto: string | null;
  corpo: string;
  ativo: boolean;
  criado_em: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState<string>("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroCanal) params.set("canal", filtroCanal);
    const r = await fetch(`/api/disparo/templates?${params}`);
    const j = await r.json();
    if (j.ok) setTemplates(j.templates);
    setCarregando(false);
  }, [filtroCanal]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Disparo</p>
          <h1 className="mt-1 text-3xl font-semibold">Templates de mensagem</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Modelos reutilizáveis. Variáveis suportadas: <code className="rounded bg-zinc-800 px-1">{"{{nome}}"}</code>{" "}
            <code className="rounded bg-zinc-800 px-1">{"{{empresa}}"}</code>{" "}
            <code className="rounded bg-zinc-800 px-1">{"{{cidade}}"}</code>{" "}
            <code className="rounded bg-zinc-800 px-1">{"{{loja_nome}}"}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Novo template
          </button>
          <Link
            href="/loja/disparo"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            ← Disparo
          </Link>
        </div>
      </header>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setFiltroCanal("")}
          className={`rounded-full px-3 py-1 text-xs ${filtroCanal === "" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFiltroCanal("email")}
          className={`rounded-full px-3 py-1 text-xs ${filtroCanal === "email" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
        >
          📧 Email
        </button>
        <button
          onClick={() => setFiltroCanal("whatsapp")}
          className={`rounded-full px-3 py-1 text-xs ${filtroCanal === "whatsapp" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
        >
          💬 WhatsApp
        </button>
      </div>

      {carregando ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando...</p>
      ) : templates.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhum template. <button onClick={() => setModalAberto(true)} className="text-amber-400 hover:underline">Crie o primeiro</button>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <header className="flex items-center justify-between">
                <div>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                    {t.canal === "email" ? "📧 Email" : "💬 WhatsApp"}
                  </span>
                  <h3 className="mt-2 font-medium">{t.nome}</h3>
                  {t.assunto && <p className="mt-0.5 text-xs text-zinc-500">Assunto: {t.assunto}</p>}
                </div>
              </header>
              <pre className="mt-3 whitespace-pre-wrap rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                {t.corpo.length > 300 ? `${t.corpo.slice(0, 300)}...` : t.corpo}
              </pre>
            </li>
          ))}
        </ul>
      )}

      {modalAberto && <ModalNovo onClose={() => setModalAberto(false)} onSaved={carregar} />}
    </main>
  );
}

function ModalNovo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: "",
    canal: "whatsapp" as "email" | "whatsapp",
    assunto: "",
    corpo: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/disparo/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const exemplo =
    form.canal === "email"
      ? "Olá {{nome}}, vimos que sua empresa {{empresa}} está em {{cidade}}.\n\nA {{loja_nome}} oferece..."
      : "Olá {{nome}}! Aqui é da {{loja_nome}}. Vimos que sua empresa {{empresa}} fica em {{cidade}}. Posso te enviar uma proposta?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo template</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set("canal", "whatsapp")}
              className={`flex-1 rounded-md py-2 text-sm ${form.canal === "whatsapp" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              💬 WhatsApp
            </button>
            <button
              type="button"
              onClick={() => set("canal", "email")}
              className={`flex-1 rounded-md py-2 text-sm ${form.canal === "email" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              📧 Email
            </button>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Nome interno (você identifica)</label>
            <input
              required
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Apresentação inicial v1"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          {form.canal === "email" && (
            <div>
              <label className="text-xs text-zinc-400">Assunto</label>
              <input
                required
                value={form.assunto}
                onChange={(e) => set("assunto", e.target.value)}
                placeholder="Ex: Material de construção {{cidade}} — proposta"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-400">Corpo da mensagem</label>
            <textarea
              required
              rows={form.canal === "email" ? 8 : 5}
              value={form.corpo}
              onChange={(e) => set("corpo", e.target.value)}
              placeholder={exemplo}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 font-mono"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Variáveis: {"{{nome}}"} {"{{empresa}}"} {"{{cidade}}"} {"{{loja_nome}}"}
            </p>
          </div>
        </div>

        {erro && (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-700 px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Criar"}
          </button>
        </div>
      </form>
    </div>
  );
}
