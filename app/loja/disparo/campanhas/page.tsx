"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Campanha = {
  id: number;
  nome: string;
  canal: string;
  status: string;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  agendada_para: string | null;
  criado_em: string;
};

type Lista = { id: number; nome: string; total_contatos: number };
type Template = { id: number; nome: string; canal: string };

const STATUS_COR: Record<string, string> = {
  rascunho: "bg-zinc-700/40 text-zinc-300",
  agendada: "bg-blue-500/20 text-blue-300",
  disparando: "bg-amber-500/20 text-amber-300",
  pausada: "bg-orange-500/20 text-orange-300",
  concluida: "bg-emerald-500/20 text-emerald-300",
  cancelada: "bg-red-500/20 text-red-300",
};

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch("/api/disparo/campanhas");
    const j = await r.json();
    if (j.ok) setCampanhas(j.campanhas);
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
          <h1 className="mt-1 text-3xl font-semibold">Campanhas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cada campanha = uma lista + um template + um canal. Disparo real depende do setup Cloud API/Resend.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Nova campanha
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
      ) : campanhas.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhuma campanha. <button onClick={() => setModalAberto(true)} className="text-amber-400 hover:underline">Crie a primeira</button>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {campanhas.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <header className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{c.canal === "email" ? "📧" : "💬"}</span>
                    <h3 className="font-medium">{c.nome}</h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Criada em {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COR[c.status] || "bg-zinc-700/40 text-zinc-300"}`}>
                  {c.status}
                </span>
              </header>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-zinc-500">Destinatários</div>
                  <div className="mt-0.5 font-bold">{c.total_destinatarios}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Enviados</div>
                  <div className="mt-0.5 font-bold text-emerald-300">{c.total_enviados}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Falhas</div>
                  <div className="mt-0.5 font-bold text-red-300">{c.total_falhas}</div>
                </div>
              </div>
              {c.status === "rascunho" && (
                <div className="mt-3 rounded-md border border-amber-700/40 bg-amber-950/20 p-2 text-xs text-amber-300">
                  ⚠️ Disparo real bloqueado: setup Cloud API Meta + Resend domain pendente.
                </div>
              )}
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
  const [canal, setCanal] = useState<"email" | "whatsapp">("whatsapp");
  const [listaId, setListaId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/disparo/listas").then((r) => r.json()).then((j) => setListas(j.listas || []));
  }, []);

  useEffect(() => {
    fetch(`/api/disparo/templates?canal=${canal}`).then((r) => r.json()).then((j) => setTemplates(j.templates || []));
  }, [canal]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!listaId) return setErro("Selecione uma lista");
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/disparo/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          canal,
          lista_id: listaId,
          template_id: templateId ?? undefined,
        }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={salvar} className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova campanha</h2>
          <button type="button" onClick={onClose} className="text-zinc-400">✕</button>
        </header>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400">Nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Promoção 1ª quinzena"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCanal("whatsapp")}
              className={`flex-1 rounded-md py-2 text-sm ${canal === "whatsapp" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              💬 WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setCanal("email")}
              className={`flex-1 rounded-md py-2 text-sm ${canal === "email" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              📧 Email
            </button>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Lista</label>
            <select
              required
              value={listaId ?? ""}
              onChange={(e) => setListaId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="">— Escolha uma lista —</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.total_contatos} contatos)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Template (opcional)</label>
            <select
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="">— Nenhum (configurar depois) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
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
            disabled={salvando || !listaId}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Criar (rascunho)"}
          </button>
        </div>
      </form>
    </div>
  );
}
