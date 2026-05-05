"use client";

import { useEffect, useState, useCallback } from "react";

type Servico = {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  modo: string | null;
  emissor: string | null;
  link_emissor: string | null;
  prerequisito: string | null;
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

const CATEGORIAS: Record<string, { label: string; emoji: string; descricao: string }> = {
  certidao_federal:    { label: "Certidões Federais",       emoji: "🏛️", descricao: "Receita Federal, PGFN, INSS — pré-requisito de licitações federais" },
  certidao_trab:       { label: "Trabalhista / FGTS",        emoji: "👷", descricao: "CRF (Caixa) e CNDT (TST) — toda licitação pede" },
  certidao_justica:    { label: "Justiça",                   emoji: "⚖️", descricao: "JF, TJ Estadual, Eleitoral — habilitação licitatória" },
  certidao_estadual:   { label: "Estaduais (Sefaz)",         emoji: "🏢", descricao: "CND e IE estaduais — vender pra órgão estadual" },
  certidao_municipal:  { label: "Municipais (Prefeitura)",   emoji: "🏪", descricao: "CND, ISS, alvará — todo município pede" },
  junta_comercial:     { label: "Junta Comercial",           emoji: "📜", descricao: "Simplificada e Inteiro Teor — para banco e M&A" },
  documentos:          { label: "Documentos da Empresa",     emoji: "📋", descricao: "Contrato Social, Balanço, DRE, Atestado — habilitação econômica" },
  certidao_socio:      { label: "Pessoais dos Sócios",       emoji: "👥", descricao: "Antecedentes federais/estaduais, CPF, eleitoral" },
  cert_digital:        { label: "Certificado Digital",       emoji: "🔐", descricao: "A1 e A3 — emissão NFe, e-Social, Sped" },
  consultas:           { label: "Consultas",                 emoji: "🔍", descricao: "RFB, sócios, score, protesto — qualifica lead" },
  credito:             { label: "Crédito",                   emoji: "💳", descricao: "Simulação FIDC, antecipação de recebível" },
  clube:               { label: "Clube de Vantagens",        emoji: "🎁", descricao: "3000+ empresas com desconto pra cliente final" },
  outros:              { label: "Outros",                    emoji: "⚡", descricao: "Diversos" },
};

const ORDEM_CATEGORIAS = [
  "certidao_federal", "certidao_trab", "certidao_justica",
  "certidao_estadual", "certidao_municipal", "junta_comercial",
  "documentos", "certidao_socio", "cert_digital",
  "consultas", "credito", "clube", "outros",
];

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function badgeModo(modo: string | null) {
  switch (modo) {
    case "automatica":
      return { label: "🚀 Automática", cor: "bg-emerald-500/10 text-emerald-300 border-emerald-700/40" };
    case "concierge":
      return { label: "🤝 Concierge", cor: "bg-amber-500/10 text-amber-300 border-amber-700/40" };
    case "paga":
      return { label: "💰 API paga", cor: "bg-violet-500/10 text-violet-300 border-violet-700/40" };
    default:
      return { label: modo || "—", cor: "bg-zinc-700/40 text-zinc-300 border-zinc-700" };
  }
}

export default function CatalogoServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [filtroModo, setFiltroModo] = useState<string>("");
  const [busca, setBusca] = useState("");

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

  // Filtros
  const servicosFiltrados = servicos.filter((s) => {
    if (filtroModo && s.modo !== filtroModo) return false;
    if (busca.trim()) {
      const t = busca.toLowerCase();
      return (
        s.nome.toLowerCase().includes(t) ||
        (s.pitch_curto || "").toLowerCase().includes(t) ||
        (s.emissor || "").toLowerCase().includes(t) ||
        s.codigo.toLowerCase().includes(t)
      );
    }
    return true;
  });

  // Agrupa por categoria
  const grupos = servicosFiltrados.reduce<Record<string, Servico[]>>((acc, s) => {
    (acc[s.categoria] ||= []).push(s);
    return acc;
  }, {});

  const ativos = servicos.filter((s) => s.ativo_na_loja);
  const margemAcumulada = ativos.reduce((sum, s) => sum + s.margem_loja, 0);
  const projecaoMensal = margemAcumulada * 5;
  const automaticas = servicos.filter((s) => s.modo === "automatica").length;
  const concierge = servicos.filter((s) => s.modo === "concierge").length;
  const pagas = servicos.filter((s) => s.modo === "paga").length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Catálogo</p>
        <h1 className="mt-1 text-3xl font-semibold">Serviços digitais pra vender ao seu cliente</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          {servicos.length} serviços catalogados em 13 categorias. Cada cartão tem pitch, casos de uso e roteiro de venda.
          Sua loja vende cimento; <strong className="text-zinc-200">esses serviços ao mesmo cliente são pura comissão.</strong>
        </p>
      </header>

      {/* KPIs */}
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <KPI label="Serviços ativos" valor={`${ativos.length} / ${servicos.length}`} />
        <KPI label="Margem média / venda" valor={fmtBrl(ativos.length ? margemAcumulada / ativos.length : 0)} />
        <KPI label="Potencial mensal" valor={fmtBrl(projecaoMensal)} cor="emerald" sub="com 5 vendas/serviço/mês" />
        <KPI label="Investimento" valor="R$ 0" sub="paga só quando vende" />
      </section>

      {/* Modos */}
      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <ModoCard
          ativo={filtroModo === "automatica"}
          onClick={() => setFiltroModo(filtroModo === "automatica" ? "" : "automatica")}
          label="🚀 Automáticas"
          desc="Cliente emite sozinho via link. Você ganha 100% da margem."
          count={automaticas}
        />
        <ModoCard
          ativo={filtroModo === "concierge"}
          onClick={() => setFiltroModo(filtroModo === "concierge" ? "" : "concierge")}
          label="🤝 Concierge"
          desc="Loja faz pelo cliente. Comissão menor mas valor agregado alto."
          count={concierge}
        />
        <ModoCard
          ativo={filtroModo === "paga"}
          onClick={() => setFiltroModo(filtroModo === "paga" ? "" : "paga")}
          label="💰 API paga"
          desc="API externa (Serasa, AC, Allya). Loja revende com margem."
          count={pagas}
        />
      </section>

      {/* Busca */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar por nome, pitch ou emissor..."
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        {filtroModo && (
          <button
            onClick={() => setFiltroModo("")}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {/* Grupos por categoria */}
      {carregando ? (
        <p className="mt-8 text-sm text-zinc-500">Carregando catálogo...</p>
      ) : (
        ORDEM_CATEGORIAS
          .filter((cat) => grupos[cat]?.length > 0)
          .map((cat) => {
            const meta = CATEGORIAS[cat] || CATEGORIAS.outros;
            const items = grupos[cat];
            return (
              <section key={cat} className="mt-10">
                <header>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-amber-400">
                    <span className="text-xl">{meta.emoji}</span>
                    <span className="uppercase tracking-wider">{meta.label}</span>
                    <span className="text-xs font-normal text-zinc-500">
                      — {items.length} {items.length === 1 ? "serviço" : "serviços"}
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{meta.descricao}</p>
                </header>
                <ul className="mt-4 grid gap-4 lg:grid-cols-2">
                  {items.map((s) => (
                    <ServicoCard
                      key={s.id}
                      s={s}
                      expandido={expandidoId === s.id}
                      onToggleExpand={() =>
                        setExpandidoId(expandidoId === s.id ? null : s.id)
                      }
                      onToggle={() => toggle(s)}
                      salvando={salvandoId === s.id}
                    />
                  ))}
                </ul>
              </section>
            );
          })
      )}
    </main>
  );
}

function KPI({ label, valor, cor, sub }: { label: string; valor: string; cor?: "emerald"; sub?: string }) {
  const cls = cor === "emerald" ? "border-emerald-700/30 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900";
  const valCls = cor === "emerald" ? "text-emerald-200" : "";
  return (
    <div className={`rounded-xl border ${cls} p-5`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${valCls}`}>{valor}</div>
      {sub && <div className="mt-1 text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

function ModoCard({
  ativo, onClick, label, desc, count,
}: {
  ativo: boolean; onClick: () => void; label: string; desc: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        ativo
          ? "border-amber-500 bg-amber-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-amber-500/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">{count}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">{desc}</p>
    </button>
  );
}

function ServicoCard({
  s, expandido, onToggleExpand, onToggle, salvando,
}: {
  s: Servico;
  expandido: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  salvando: boolean;
}) {
  const modo = badgeModo(s.modo);
  return (
    <li
      className={`rounded-xl border p-5 transition ${
        s.ativo_na_loja
          ? "border-emerald-700/40 bg-emerald-950/10"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${modo.cor}`}>
              {modo.label}
            </span>
            {s.emissor && (
              <span className="text-[10px] text-zinc-500">{s.emissor}</span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold">{s.nome}</h3>
          {s.pitch_curto && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{s.pitch_curto}</p>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={salvando}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            s.ativo_na_loja
              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
          }`}
        >
          {s.ativo_na_loja ? "✓" : "+"}
        </button>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-zinc-950/50 p-2 text-xs">
        <div>
          <div className="text-zinc-500">Custo</div>
          <div className="mt-0.5 font-medium">{fmtBrl(s.preco_custo)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Venda</div>
          <div className="mt-0.5 font-medium">{fmtBrl(s.preco_efetivo)}</div>
        </div>
        <div>
          <div className="text-amber-300">Comissão</div>
          <div className="mt-0.5 font-bold text-amber-300">{fmtBrl(s.margem_loja)}</div>
        </div>
      </div>

      {s.prazo_entrega && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
          <span>⚡</span>
          <span><strong className="text-zinc-200">{s.prazo_entrega}</strong></span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onToggleExpand}
          className="text-xs text-amber-400 hover:underline"
        >
          {expandido ? "Esconder ↑" : "Ver pitch + casos de uso ↓"}
        </button>
        {s.link_emissor && (
          <a
            href={s.link_emissor}
            target="_blank"
            rel="noopener"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            🔗 emissor
          </a>
        )}
      </div>

      {expandido && (
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs">
          {s.para_quem && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pra quem oferecer</div>
              <p className="mt-0.5 text-zinc-300">{s.para_quem}</p>
            </div>
          )}
          {s.casos_uso && s.casos_uso.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Casos de uso reais</div>
              <ul className="mt-1 space-y-0.5 text-zinc-300">
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
            <div className="rounded-md border-l-2 border-amber-500 bg-amber-500/5 p-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-300">📣 Roteiro</div>
              <p className="mt-0.5 italic text-zinc-200">{s.como_vender}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
