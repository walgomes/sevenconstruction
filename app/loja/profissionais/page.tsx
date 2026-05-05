"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Profissional = {
  id: number;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  categoria: string;
  especialidade: string | null;
  anos_experiencia: number | null;
  codigo_indicacao: string;
  comissao_pct: number;
  comissao_fixa: number | null;
  ativo: boolean;
  destaque: boolean;
  qtd_indicacoes: number;
  total_comissao: number;
  comissao_mes: number;
};

type Resumo = {
  total: number;
  ativos: number;
  com_indicacao: number;
  comissao_mes_pendente: number;
};

const CATEGORIAS = [
  { v: "arquiteto", label: "Arquiteto", emoji: "📐" },
  { v: "engenheiro", label: "Engenheiro", emoji: "🏗️" },
  { v: "mestre_obras", label: "Mestre de obras", emoji: "👷" },
  { v: "pedreiro", label: "Pedreiro", emoji: "🧱" },
  { v: "ajudante", label: "Ajudante", emoji: "🤝" },
  { v: "carpinteiro", label: "Carpinteiro", emoji: "🪚" },
  { v: "eletricista", label: "Eletricista", emoji: "⚡" },
  { v: "encanador", label: "Encanador", emoji: "🔧" },
  { v: "pintor", label: "Pintor", emoji: "🎨" },
  { v: "serralheiro", label: "Serralheiro", emoji: "🔨" },
  { v: "corretor_imovel", label: "Corretor imóvel", emoji: "🏘️" },
  { v: "designer", label: "Designer interiores", emoji: "🛋️" },
  { v: "paisagista", label: "Paisagista", emoji: "🌿" },
  { v: "outros", label: "Outros", emoji: "🛠️" },
];

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function categoriaInfo(v: string) {
  return CATEGORIAS.find((c) => c.v === v) ?? { v, label: v, emoji: "🛠️" };
}

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [modalNovo, setModalNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (categoriaFiltro) params.set("categoria", categoriaFiltro);
      if (busca.trim()) params.set("busca", busca.trim());
      const r = await fetch(`/api/profissionais?${params}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setProfissionais(j.profissionais);
      setResumo(j.resumo);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }, [categoriaFiltro, busca]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Diretório</p>
          <h1 className="mt-1 text-3xl font-semibold">Time de profissionais</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Cada profissional cadastrado tem código único.{" "}
            <strong className="text-zinc-200">Quando ele indica um cliente, você paga comissão pelo app</strong>{" "}
            — viral, transparente, controlado.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalNovo(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Cadastrar profissional
          </button>
          <Link
            href="/loja"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Painel
          </Link>
        </div>
      </header>

      {resumo && (
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Profissionais</div>
            <div className="mt-2 text-3xl font-semibold">{resumo.ativos}</div>
            <div className="mt-1 text-xs text-zinc-400">de {resumo.total} cadastrados</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Já trouxeram venda</div>
            <div className="mt-2 text-3xl font-semibold">{resumo.com_indicacao}</div>
          </div>
          <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
            <div className="text-xs uppercase tracking-wider text-emerald-300">Comissão a pagar (mês)</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-200">
              {fmtBrl(resumo.comissao_mes_pendente)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-5">
            <div className="text-xs uppercase tracking-wider text-amber-300">Modelo</div>
            <p className="mt-2 text-sm text-zinc-200">
              Cliente vem por indicação → loja vende → profissional ganha %.{" "}
              <strong>Todo mundo ganha.</strong>
            </p>
          </div>
        </section>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); carregar(); }}
        className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-5"
      >
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">Buscar por nome / especialidade</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex: João, Reforma, Hidráulica"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">Categoria</label>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c.v} value={c.v}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Filtrando..." : "Filtrar"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {!carregando && profissionais.length === 0 && (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhum profissional cadastrado.{" "}
          <button onClick={() => setModalNovo(true)} className="text-amber-400 hover:underline">
            Cadastre o primeiro
          </button>{" "}
          — pedreiro, eletricista, mestre de obra, arquiteto.
        </p>
      )}

      {profissionais.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profissionais.map((p) => {
            const cat = categoriaInfo(p.categoria);
            return (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/40"
              >
                <header className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji}</span>
                      <h3 className="font-medium">{p.nome}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {cat.label}{p.especialidade ? ` · ${p.especialidade}` : ""}
                    </p>
                  </div>
                  {p.destaque && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      ⭐ Destaque
                    </span>
                  )}
                </header>

                <div className="mt-3 space-y-1 text-xs text-zinc-400">
                  {p.cidade && <div>📍 {p.cidade}{p.uf ? `/${p.uf}` : ""}</div>}
                  {p.whatsapp && <div>📱 {p.whatsapp}</div>}
                  {p.email && <div className="truncate">✉️ {p.email}</div>}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-zinc-950/50 p-2">
                    <div className="text-zinc-500">Indicações</div>
                    <div className="mt-0.5 font-bold">{p.qtd_indicacoes}</div>
                  </div>
                  <div className="rounded-md bg-zinc-950/50 p-2">
                    <div className="text-zinc-500">Comissão (mês)</div>
                    <div className="mt-0.5 font-bold text-amber-300">{fmtBrl(p.comissao_mes)}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
                  <div className="text-amber-300">Código de indicação</div>
                  <div className="mt-0.5 font-mono font-bold tracking-wide">{p.codigo_indicacao}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    Comissão: {p.comissao_fixa != null ? fmtBrl(p.comissao_fixa) + " fixo" : `${p.comissao_pct}% da venda`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalNovo && <ModalNovo onClose={() => setModalNovo(false)} onSaved={carregar} />}
    </main>
  );
}

function ModalNovo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: "",
    categoria: "pedreiro",
    telefone: "",
    whatsapp: "",
    email: "",
    cidade: "",
    uf: "BA",
    especialidade: "",
    comissao_pct: "5",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/profissionais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          whatsapp: form.whatsapp || form.telefone,
          comissao_pct: parseFloat(form.comissao_pct) || 5,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErro("Erro de rede");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cadastrar profissional</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">✕</button>
        </header>
        <p className="mt-1 text-sm text-zinc-400">
          Quando ele indicar venda, ganha comissão automática pelo código.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Nome</label>
            <input
              required
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Categoria</label>
            <select
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.v} value={c.v}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Especialidade (opcional)</label>
            <input
              value={form.especialidade}
              onChange={(e) => set("especialidade", e.target.value)}
              placeholder="Ex: Reforma residencial"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(71) 9 9999-9999"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">WhatsApp (se diferente)</label>
            <input
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Cidade</label>
            <input
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">UF</label>
            <input
              value={form.uf}
              maxLength={2}
              onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Email (opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="md:col-span-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
            <label className="text-xs text-amber-300">Comissão por indicação (% da venda)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={form.comissao_pct}
              onChange={(e) => set("comissao_pct", e.target.value)}
              className="mt-1 w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            <span className="ml-2 text-xs text-zinc-400">% (típico 3-10%)</span>
          </div>
        </div>

        {erro && (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
