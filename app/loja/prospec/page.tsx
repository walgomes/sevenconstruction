"use client";

import { useState } from "react";
import Link from "next/link";

type Empresa = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  municipio: string | null;
  uf: string | null;
  bairro: string | null;
  porte: number | null;
  capital_social: number | null;
  data_abertura: string | null;
  ddd1: string | null;
  telefone1: string | null;
  email: string | null;
};

const CNAE_PRESETS: { label: string; cnaes: string[] }[] = [
  { label: "Qualquer CNAE", cnaes: [] },
  { label: "Construção (F-41+42+43)", cnaes: ["41", "42", "43"] },
  { label: "Construtoras (F-41)", cnaes: ["41"] },
  { label: "Obras de infraestrutura (F-42)", cnaes: ["42"] },
  { label: "Serviços especializados (F-43)", cnaes: ["43"] },
  { label: "Instaladores elétricos", cnaes: ["4321"] },
  { label: "Instaladores hidráulicos", cnaes: ["4322"] },
  { label: "Pintura/acabamento", cnaes: ["4330"] },
  { label: "Marceneiros/serralheiros", cnaes: ["1622", "2542"] },
];

const PORTE_OPCOES = [
  { v: "", label: "Qualquer porte" },
  { v: "2", label: "ME" },
  { v: "3", label: "EPP" },
  { v: "5", label: "Médio/Grande" },
];

function formatCnpj(cnpj: string) {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function porteLabel(p: number | null) {
  switch (p) {
    case 2: return "ME";
    case 3: return "EPP";
    case 5: return "Médio/Grande";
    default: return "—";
  }
}

export default function ProspecPage() {
  const [uf, setUf] = useState("BA");
  const [municipio, setMunicipio] = useState("");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [presetIdx, setPresetIdx] = useState(1); // default: Construção (F-41+42+43)
  const [porte, setPorte] = useState("");
  const [resultados, setResultados] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [nomeLista, setNomeLista] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    setSelecionados(new Set());
    try {
      const cnaes = CNAE_PRESETS[presetIdx].cnaes;
      const r = await fetch("/api/prospec/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uf: uf || undefined,
          municipio: municipio || undefined,
          nome: nome.trim() || undefined,
          cnpj: cnpj.trim() || undefined,
          cnaes_alvo: cnaes.length ? cnaes : undefined,
          porte_min: porte ? parseInt(porte, 10) : undefined,
          porte_max: porte ? parseInt(porte, 10) : undefined,
          limite: 200,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha na busca");
        setResultados([]);
        return;
      }
      setResultados(j.empresas);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  function toggle(cnpj: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(cnpj)) next.delete(cnpj);
      else next.add(cnpj);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === resultados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(resultados.map((e) => e.cnpj)));
    }
  }

  async function salvar() {
    if (!nomeLista.trim()) {
      setErro("Dê um nome à lista");
      return;
    }
    if (selecionados.size === 0) {
      setErro("Selecione ao menos 1 empresa");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const itens = resultados.filter((e) => selecionados.has(e.cnpj));
      const r = await fetch("/api/prospec/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeLista,
          uf,
          cidade: municipio || undefined,
          cnaes_alvo: CNAE_PRESETS[presetIdx].cnaes,
          itens,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha ao salvar");
        return;
      }
      window.location.href = `/loja/prospec/listas/${j.lista_id}`;
    } catch {
      setErro("Erro de rede ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Prospecção</p>
          <h1 className="mt-1 text-3xl font-semibold">Prospecção de bairro</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Lista construtoras e instaladores ativos por UF/cidade e CNAE.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/loja/prospec/listas"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Listas salvas
          </Link>
          <Link
            href="/loja"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Painel
          </Link>
        </div>
      </header>

      <form
        onSubmit={buscar}
        className="mt-8 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-6"
      >
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">Nome / Razão social</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Construtora ABC"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">CNPJ (opcional)</label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">UF</label>
          <input
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Município</label>
          <input
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Ex: Salvador"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-zinc-400">Preset de CNAE (opcional)</label>
          <select
            value={presetIdx}
            onChange={(e) => setPresetIdx(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            {CNAE_PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="text-xs text-zinc-400">Porte</label>
          <select
            value={porte}
            onChange={(e) => setPorte(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            {PORTE_OPCOES.map((p) => (
              <option key={p.v} value={p.v}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Combine quantos filtros quiser. Limite 200 · Empresas ativas (situação=2).
          </p>
          <button
            type="submit"
            disabled={carregando}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {resultados.length > 0 && (
        <section className="mt-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {resultados.length} empresas encontradas
              </h2>
              <button
                type="button"
                onClick={toggleTodos}
                className="mt-1 text-xs text-amber-400 hover:underline"
              >
                {selecionados.size === resultados.length ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-zinc-400">Nome da lista</label>
                <input
                  value={nomeLista}
                  onChange={(e) => setNomeLista(e.target.value)}
                  placeholder="Ex: Construtoras Salvador F-41"
                  className="mt-1 w-72 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || selecionados.size === 0}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : `Salvar ${selecionados.size} como lista`}
              </button>
            </div>
          </header>

          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">CNPJ / Razão social</th>
                  <th className="px-3 py-2">CNAE</th>
                  <th className="px-3 py-2">Cidade/UF</th>
                  <th className="px-3 py-2">Porte</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((e) => (
                  <tr
                    key={e.cnpj}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selecionados.has(e.cnpj)}
                        onChange={() => toggle(e.cnpj)}
                        className="accent-amber-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {e.razao_social || <span className="text-zinc-500">—</span>}
                      </div>
                      <div className="text-xs text-zinc-500">{formatCnpj(e.cnpj)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{e.cnae_fiscal}</div>
                      <div className="text-xs text-zinc-500 line-clamp-1">{e.cnae_descricao}</div>
                    </td>
                    <td className="px-3 py-2">
                      {e.municipio ? `${e.municipio}/${e.uf}` : (e.uf || "—")}
                    </td>
                    <td className="px-3 py-2">{porteLabel(e.porte)}</td>
                    <td className="px-3 py-2">
                      {e.telefone1 ? `(${e.ddd1 || ""}) ${e.telefone1}` : <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate">
                      {e.email || <span className="text-zinc-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!carregando && resultados.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          Configure os filtros acima e clique em <strong>Buscar</strong>.
        </p>
      )}
    </main>
  );
}
