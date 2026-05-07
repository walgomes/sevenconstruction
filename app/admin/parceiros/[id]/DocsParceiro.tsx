"use client";

import { useState } from "react";

type Doc = { id: number; tipo_doc: string; nome: string; url: string; criado_em: string };

const TIPOS_DOC = [
  { v: "contrato_social", r: "Contrato social" },
  { v: "iso", r: "ISO/Certificação" },
  { v: "catalogo", r: "Catálogo" },
  { v: "tabela_preco", r: "Tabela de preço" },
  { v: "foto_fachada", r: "Foto fachada" },
  { v: "rg_socio", r: "RG sócio" },
  { v: "alvara", r: "Alvará" },
  { v: "certidao", r: "Certidão" },
  { v: "outro", r: "Outro" },
];

export default function DocsParceiro({ id, docsIniciais }: { id: number; docsIniciais: Doc[] }) {
  const [docs, setDocs] = useState(docsIniciais);
  const [tipoDoc, setTipoDoc] = useState("contrato_social");
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}/docs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo_doc: tipoDoc, nome, url }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setDocs((prev) => [j.doc, ...prev]);
      setNome("");
      setUrl("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(docId: number) {
    if (!confirm("Remover documento?")) return;
    const r = await fetch(`/api/admin/parceiros/${id}/docs?doc_id=${docId}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) setDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Documentos</h2>
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <form onSubmit={adicionar} className="grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]">
          <select
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {TIPOS_DOC.map((t) => <option key={t.v} value={t.v}>{t.r}</option>)}
          </select>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do documento"
            required
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm placeholder:text-zinc-600"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL pública (Drive, Dropbox, etc)"
            type="url"
            required
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {salvando ? "..." : "Adicionar"}
          </button>
        </form>
        {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}

        {docs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nenhum documento ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-800">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-zinc-100">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 mr-2">
                      {d.tipo_doc}
                    </span>
                    {d.nome}
                  </p>
                  <a href={d.url} target="_blank" rel="noreferrer noopener" className="text-xs text-rose-300 hover:underline">
                    {d.url.replace(/^https?:\/\//, "").slice(0, 80)}
                  </a>
                </div>
                <button
                  onClick={() => remover(d.id)}
                  className="text-xs text-zinc-500 hover:text-rose-300"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
