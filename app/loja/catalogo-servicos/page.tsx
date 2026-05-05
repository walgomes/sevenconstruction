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
  pitch_curto: string | null;
  para_quem: string | null;
  casos_uso: string[] | null;
  prazo_entrega: string | null;
  como_vender: string | null;
  ativo_na_loja: boolean;
  preco_venda_custom: number | null;
  preco_efetivo: number;
  margem_loja: number;
};

const CATEGORIA_LABELS: Record<string, { label: string; emoji: string; cor: string }> = {
  certidoes:    { label: "Certidões",         emoji: "📄", cor: "border-blue-700/30 bg-blue-950/10" },
  cert_digital: { label: "Certificado Digital", emoji: "🔐", cor: "border-purple-700/30 bg-purple-950/10" },
  consultas:    { label: "Consultas",         emoji: "🔍", cor: "border-cyan-700/30 bg-cyan-950/10" },
  clube:        { label: "Clube de Vantagens", emoji: "🎁", cor: "border-pink-700/30 bg-pink-950/10" },
  credito:      { label: "Crédito",           emoji: "💳", cor: "border-emerald-700/30 bg-emerald-950/10" },
  outros:       { label: "Outros",            emoji: "⚡", cor: "border-zinc-700/30 bg-zinc-950/10" },
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CatalogoServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

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
      await fetch("/api/catalogo-servicos/ativar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servico_id: s.id,
          ativo: !s.ativo_na_loja,
          preco_venda_custom: s.preco_venda_custom,
        }),
      });
      setServicos((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, ativo_na_loja: !x.ativo_na_loja } : x)),
      );
    } finally {
      setSalvandoId(null);
    }
  }

  const grupos = servicos.reduce<Record<string, Servico[]>>((acc, s) => {
    (acc[s.categoria] ||= []).push(s);
    return acc;
  }, {});

  const ativos = servicos.filter((s) => s.ativo_na_loja);
  const margemAcumulada = ativos.reduce((sum, s) => sum + s.margem_loja, 0);
  const projecaoMensal = margemAcumulada * 5; // estimativa: 5 vendas/mês por serviço

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Catálogo</p>
          <h1 className="mt-1 text-3xl font-semibold">Serviços digitais pra vender ao seu cliente</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-3xl">
            Sua loja vende cimento. <strong className="text-zinc-200">Esses serviços, ao mesmo cliente, são pura comissão.</strong>{" "}
            Cada cartão tem o pitch pronto, casos de uso e roteiro pra você vender em 30s.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Serviços ativos</div>
          <div className="mt-2 text-3xl font-semibold">{ativos.length} <span className="text-base text-zinc-500">/ {servicos.length}</span></div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Margem por venda (média)</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{fmtBrl(ativos.length ? margemAcumulada / ativos.length : 0)}</div>
        </div>
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">Potencial mensal</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">{fmtBrl(projecaoMensal)}</div>
          <div className="mt-1 text-xs text-zinc-400">com 5 vendas/serviço/mês</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Investimento da loja</div>
          <div className="mt-2 text-3xl font-semibold text-zinc-100">R$ 0</div>
          <div className="mt-1 text-xs text-zinc-400">paga só quando vende</div>
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
        Object.entries(grupos).map(([cat, items]) => {
          const meta = CATEGORIA_LABELS[cat] || CATEGORIA_LABELS.outros;
          return (
            <section key={cat} className="mt-10">
              <h2 className="flex items-center gap-2 text-base font-semibold text-amber-400">
                <span className="text-lg">{meta.emoji}</span>
                <span className="uppercase tracking-wider">{meta.label}</span>
                <span className="text-xs font-normal text-zinc-500">— {items.length} serviços</span>
              </h2>
              <ul className="mt-4 grid gap-4 lg:grid-cols-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className={`rounded-xl border p-5 transition ${
                      s.ativo_na_loja
                        ? "border-emerald-700/40 bg-emerald-950/10"
                        : `${meta.cor}`
                    }`}
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold leading-tight">{s.nome}</h3>
                        {s.pitch_curto && (
                          <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed">{s.pitch_curto}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggle(s)}
                        disabled={salvandoId === s.id}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          s.ativo_na_loja
                            ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                            : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        }`}
                      >
                        {s.ativo_na_loja ? "✓ Ativo" : "+ Ativar"}
                      </button>
                    </header>

                    <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-zinc-950/50 p-3 text-xs">
                      <div>
                        <div className="text-zinc-500">Você paga</div>
                        <div className="mt-0.5 font-medium">{fmtBrl(s.preco_custo)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Cliente paga</div>
                        <div className="mt-0.5 font-medium">{fmtBrl(s.preco_efetivo)}</div>
                      </div>
                      <div>
                        <div className="text-amber-300">Sua comissão</div>
                        <div className="mt-0.5 font-bold text-amber-300">{fmtBrl(s.margem_loja)}</div>
                      </div>
                    </div>

                    {s.prazo_entrega && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                        <span>⚡</span> <strong className="text-zinc-200">Entrega:</strong> {s.prazo_entrega}
                      </div>
                    )}

                    <button
                      onClick={() => setExpandidoId(expandidoId === s.id ? null : s.id)}
                      className="mt-3 text-xs text-amber-400 hover:underline"
                    >
                      {expandidoId === s.id ? "Esconder pitch ↑" : "Ver pitch + casos de uso ↓"}
                    </button>

                    {expandidoId === s.id && (
                      <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
                        {s.para_quem && (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-zinc-500">Pra quem oferecer</div>
                            <p className="mt-1 text-zinc-300">{s.para_quem}</p>
                          </div>
                        )}
                        {s.casos_uso && s.casos_uso.length > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-zinc-500">Casos de uso reais</div>
                            <ul className="mt-1 space-y-1 text-zinc-300">
                              {s.casos_uso.map((c, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-amber-400">•</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.como_vender && (
                          <div className="rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-3">
                            <div className="text-xs uppercase tracking-wider text-amber-300">📣 Roteiro de venda</div>
                            <p className="mt-1 italic text-zinc-200">{s.como_vender}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
