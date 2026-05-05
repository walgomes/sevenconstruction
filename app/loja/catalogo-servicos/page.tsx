"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Servico = {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  preco_custo: number;
  preco_venda_sugerido: number;
  comissao_loja_pct: number;
  descricao: string | null;
  ativo_na_loja: boolean;
  preco_venda_custom: number | null;
  preco_efetivo: number;
  margem_loja: number;
};

const CATEGORIA_LABELS: Record<string, string> = {
  certidoes: "Certidões",
  cert_digital: "Certificado Digital",
  consultas: "Consultas",
  clube: "Clube",
  credito: "Crédito",
  outros: "Outros",
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CatalogoServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/catalogo-servicos");
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha ao carregar");
        return;
      }
      setServicos(j.servicos);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function toggle(s: Servico) {
    setSalvandoId(s.id);
    setErro(null);
    try {
      const r = await fetch("/api/catalogo-servicos/ativar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servico_id: s.id,
          ativo: !s.ativo_na_loja,
          preco_venda_custom: s.preco_venda_custom,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      // Atualiza state local
      setServicos((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, ativo_na_loja: !x.ativo_na_loja } : x)),
      );
    } finally {
      setSalvandoId(null);
    }
  }

  async function salvarPreco(s: Servico, novo: number | null) {
    setSalvandoId(s.id);
    setErro(null);
    try {
      const r = await fetch("/api/catalogo-servicos/ativar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servico_id: s.id,
          ativo: s.ativo_na_loja,
          preco_venda_custom: novo,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      await carregar();
    } finally {
      setSalvandoId(null);
    }
  }

  // Agrupa por categoria
  const grupos = servicos.reduce<Record<string, Servico[]>>((acc, s) => {
    (acc[s.categoria] ||= []).push(s);
    return acc;
  }, {});

  const totalAtivos = servicos.filter((s) => s.ativo_na_loja).length;
  const margemMedia = servicos
    .filter((s) => s.ativo_na_loja)
    .reduce((sum, s) => sum + s.margem_loja, 0) / Math.max(totalAtivos, 1);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Catálogo</p>
          <h1 className="mt-1 text-3xl font-semibold">Serviços digitais</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ative os serviços que você quer oferecer aos seus clientes. Você ganha comissão em cada venda.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Serviços ativos</div>
          <div className="mt-2 text-3xl font-semibold">{totalAtivos} <span className="text-base text-zinc-500">/ {servicos.length}</span></div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Margem média / serviço</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{fmtBrl(margemMedia)}</div>
        </div>
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">Modelo</div>
          <p className="mt-2 text-sm text-zinc-300">
            Você não paga nada. Vende ao cliente, plataforma cobra do parceiro, você fica com sua %.
          </p>
        </div>
      </section>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {carregando ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando catálogo...</p>
      ) : (
        Object.entries(grupos).map(([cat, items]) => (
          <section key={cat} className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              {CATEGORIA_LABELS[cat] || cat}
            </h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {items.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border p-5 transition ${
                    s.ativo_na_loja
                      ? "border-emerald-700/40 bg-emerald-950/10"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{s.nome}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{s.descricao}</p>
                    </div>
                    <button
                      onClick={() => toggle(s)}
                      disabled={salvandoId === s.id}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        s.ativo_na_loja
                          ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                    >
                      {s.ativo_na_loja ? "✓ Ativo" : "Ativar"}
                    </button>
                  </header>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-zinc-500">Custo</div>
                      <div className="mt-0.5 font-medium">{fmtBrl(s.preco_custo)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Venda</div>
                      <div className="mt-0.5">
                        <PrecoEditor
                          servico={s}
                          salvando={salvandoId === s.id}
                          onSalvar={(v) => salvarPreco(s, v)}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Sua comissão</div>
                      <div className="mt-0.5 font-medium text-amber-300">{fmtBrl(s.margem_loja)}</div>
                      <div className="text-[10px] text-zinc-500">{s.comissao_loja_pct}% da margem</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

function PrecoEditor({
  servico,
  salvando,
  onSalvar,
}: {
  servico: Servico;
  salvando: boolean;
  onSalvar: (v: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(servico.preco_efetivo));

  if (!editando) {
    return (
      <button
        onClick={() => {
          setValor(String(servico.preco_efetivo));
          setEditando(true);
        }}
        className="font-medium hover:text-amber-300"
        disabled={salvando}
      >
        {fmtBrl(servico.preco_efetivo)}
        {servico.preco_venda_custom != null && (
          <span className="ml-1 text-[10px] text-amber-400">custom</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        autoFocus
        className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs"
      />
      <button
        onClick={() => {
          const n = parseFloat(valor);
          if (Number.isFinite(n) && n >= 0) {
            onSalvar(n === servico.preco_venda_sugerido ? null : n);
          }
          setEditando(false);
        }}
        className="text-emerald-400 hover:text-emerald-300"
      >
        ✓
      </button>
      <button onClick={() => setEditando(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
    </div>
  );
}
