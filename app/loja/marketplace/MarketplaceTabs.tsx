"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Oferta, Demanda, Transacao, OfertaMatch } from "@/lib/marketplace";

const CATEGORIAS = ["cimento", "areia", "brita", "blocos", "ferragens", "madeira",
  "tintas", "ceramica", "louça", "metais", "eletrica", "hidraulica", "outros"];

const STATUS_TX: Record<string, { label: string; cor: string }> = {
  pendente:   { label: "Pendente",    cor: "bg-zinc-500/10 text-zinc-300" },
  aceita:     { label: "Aceita",      cor: "bg-blue-500/10 text-blue-300" },
  em_transito:{ label: "Em trânsito", cor: "bg-amber-500/10 text-amber-300" },
  entregue:   { label: "Entregue",    cor: "bg-emerald-500/10 text-emerald-300" },
  cancelada:  { label: "Cancelada",   cor: "bg-red-500/10 text-red-300" },
};

function fmtBrl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MarketplaceTabs({
  ofertasIniciais, demandasIniciais, transacoesIniciais,
}: {
  ofertasIniciais: Oferta[];
  demandasIniciais: Demanda[];
  transacoesIniciais: Transacao[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"ofertas" | "demandas" | "match" | "transacoes">("match");
  const [ofertas, setOfertas] = useState(ofertasIniciais);
  const [demandas, setDemandas] = useState(demandasIniciais);
  const [transacoes, setTransacoes] = useState(transacoesIniciais);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800">
        <Tab atual={aba} v="match" set={setAba}>🔍 Descobrir (match)</Tab>
        <Tab atual={aba} v="ofertas" set={setAba}>📤 Minhas ofertas ({ofertas.length})</Tab>
        <Tab atual={aba} v="demandas" set={setAba}>📥 Minhas demandas ({demandas.length})</Tab>
        <Tab atual={aba} v="transacoes" set={setAba}>💱 Transações ({transacoes.length})</Tab>
      </div>

      <div className="mt-4">
        {aba === "match" && <AbaMatch onTransacaoCriada={() => router.refresh()} />}
        {aba === "ofertas" && <AbaOfertas lista={ofertas} setLista={setOfertas} />}
        {aba === "demandas" && <AbaDemandas lista={demandas} setLista={setDemandas} />}
        {aba === "transacoes" && <AbaTransacoes lista={transacoes} setLista={setTransacoes} />}
      </div>
    </section>
  );
}

function Tab<T extends string>({ atual, v, set, children }: { atual: T; v: T; set: (x: T) => void; children: React.ReactNode }) {
  const ativo = atual === v;
  return (
    <button
      onClick={() => set(v)}
      type="button"
      className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
        ativo ? "border-amber-500 text-amber-300" : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// ABA: MATCH (descobrir ofertas de outras lojas)
// ============================================================================
function AbaMatch({ onTransacaoCriada }: { onTransacaoCriada: () => void }) {
  const [produto, setProduto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [prazoMax, setPrazoMax] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [matches, setMatches] = useState<OfertaMatch[]>([]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    try {
      const sp = new URLSearchParams();
      if (produto) sp.set("produto", produto);
      if (categoria) sp.set("categoria", categoria);
      if (precoMax) sp.set("preco_max", precoMax);
      if (prazoMax) sp.set("prazo_max_dias", prazoMax);
      const r = await fetch(`/api/loja/marketplace/match?${sp}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setMatches(j.ofertas || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setCarregando(false); }
  }

  async function comprar(oferta: OfertaMatch, qtd: number) {
    if (qtd <= 0) return;
    try {
      const r = await fetch("/api/loja/marketplace/transacoes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ oferta_id: oferta.id, quantidade: qtd }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      alert(`Transação #${j.transacao.id} criada — fornecedor vai receber pra aceitar`);
      onTransacaoCriada();
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div>
      <form onSubmit={buscar} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-5">
        <Field label="Produto (palavra)">
          <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="cimento" className={inputCls} />
        </Field>
        <Field label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Preço máx (R$)">
          <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="50" className={inputCls} />
        </Field>
        <Field label="Prazo máx (dias)">
          <input type="number" value={prazoMax} onChange={(e) => setPrazoMax(e.target.value)} placeholder="3" className={inputCls} />
        </Field>
        <div className="flex items-end">
          <button type="submit" disabled={carregando}
            className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {carregando ? "..." : "🔍 Buscar"}
          </button>
        </div>
      </form>

      {erro && <p className="mt-3 rounded-md border border-rose-700/40 bg-rose-950/30 p-2 text-xs text-rose-300">⚠️ {erro}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m, idx) => (
          <article key={m.id} className={`rounded-xl border p-4 ${idx === 0 ? "border-amber-500/60 bg-amber-950/15" : "border-zinc-800 bg-zinc-900/40"}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                {m.categoria || "geral"}
              </span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                m.score >= 80 ? "bg-emerald-500/20 text-emerald-300"
                : m.score >= 60 ? "bg-amber-500/20 text-amber-300"
                : "bg-zinc-500/20 text-zinc-400"
              }`}>{m.score}</span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-zinc-100">{m.produto}</h3>
            <p className="text-[10px] text-zinc-500">
              {m.loja_nome}{m.loja_uf && ` · ${m.loja_uf}`}{m.distancia_km != null && ` · ${m.distancia_km}km`}
            </p>
            <p className="mt-2 text-2xl font-black text-amber-300">{fmtBrl(m.preco_atacado)}<span className="text-xs font-normal text-zinc-400"> /{m.unidade}</span></p>
            <p className="text-[10px] text-zinc-400">Entrega em {m.prazo_entrega_dias}d · raio {m.raio_entrega_km}km</p>
            <p className="mt-1 text-[10px] text-zinc-500">{m.motivo}</p>
            <FormCompra oferta={m} onComprar={(q) => comprar(m, q)} />
          </article>
        ))}
        {matches.length === 0 && !carregando && (
          <p className="col-span-full text-center text-sm text-zinc-500 py-6">Use o filtro acima pra buscar ofertas de outras lojas.</p>
        )}
      </div>
    </div>
  );
}

function FormCompra({ oferta, onComprar }: { oferta: OfertaMatch; onComprar: (q: number) => void }) {
  const [qtd, setQtd] = useState("1");
  const total = (Number(qtd) || 0) * (oferta.preco_atacado || 0);
  return (
    <div className="mt-3 flex items-end gap-2 border-t border-zinc-800 pt-2">
      <label className="flex-1 text-[10px] text-zinc-500">
        Qtd ({oferta.unidade})
        <input value={qtd} onChange={(e) => setQtd(e.target.value)} type="number" min="1" className={inputCls + " mt-0.5"} />
      </label>
      <button onClick={() => onComprar(Number(qtd) || 0)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
        Comprar {fmtBrl(total)}
      </button>
    </div>
  );
}

// ============================================================================
// ABA: OFERTAS (minhas)
// ============================================================================
function AbaOfertas({ lista, setLista }: { lista: Oferta[]; setLista: (l: Oferta[]) => void }) {
  const [form, setForm] = useState({ produto: "", categoria: "outros", unidade: "un", preco: "", prazo: "1", raio: "30" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/loja/marketplace/ofertas", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          produto: form.produto, categoria: form.categoria, unidade: form.unidade,
          preco_atacado: form.preco ? Number(form.preco) : undefined,
          prazo_entrega_dias: Number(form.prazo) || 1,
          raio_entrega_km: Number(form.raio) || 30,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setLista([j.oferta, ...lista]);
      setForm({ produto: "", categoria: "outros", unidade: "un", preco: "", prazo: "1", raio: "30" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setSalvando(false); }
  }

  async function alternar(id: number) {
    const r = await fetch("/api/loja/marketplace/ofertas", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();
    if (j.ok) setLista(lista.map((o) => o.id === id ? { ...o, ativo: !o.ativo } : o));
  }

  return (
    <div>
      <form onSubmit={adicionar} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-3">
        <Field label="Produto *" full>
          <input required value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })}
            placeholder="Cimento CP-II 50kg Votoran" className={inputCls} />
        </Field>
        <Field label="Categoria">
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Unidade">
          <input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un|saco|m³" className={inputCls} />
        </Field>
        <Field label="Preço atacado (R$)">
          <input value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} type="number" step="0.01" className={inputCls} />
        </Field>
        <Field label="Prazo (dias)">
          <input value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} type="number" min="1" className={inputCls} />
        </Field>
        <Field label="Raio entrega (km)">
          <input value={form.raio} onChange={(e) => setForm({ ...form, raio: e.target.value })} type="number" min="1" className={inputCls} />
        </Field>
        <div className="flex items-end sm:col-span-3">
          <button type="submit" disabled={salvando || !form.produto}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {salvando ? "..." : "+ Adicionar oferta"}
          </button>
        </div>
      </form>

      {erro && <p className="mt-3 text-xs text-rose-300">⚠️ {erro}</p>}

      <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
        {lista.length === 0 ? (
          <li className="p-6 text-center text-sm text-zinc-500">Nenhuma oferta cadastrada — adicione acima.</li>
        ) : lista.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-100">{o.produto}</p>
              <p className="text-[10px] text-zinc-500">
                {o.categoria || "geral"} · {fmtBrl(o.preco_atacado)}/{o.unidade} · {o.prazo_entrega_dias}d · raio {o.raio_entrega_km}km
              </p>
            </div>
            <button onClick={() => alternar(o.id)}
              className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                o.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"
              }`}>
              {o.ativo ? "ativa" : "pausada"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// ABA: DEMANDAS (minhas)
// ============================================================================
function AbaDemandas({ lista, setLista }: { lista: Demanda[]; setLista: (l: Demanda[]) => void }) {
  const [form, setForm] = useState({ produto: "", categoria: "outros", quantidade: "", unidade: "un", prazo: "", precoMax: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/loja/marketplace/demandas", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          produto: form.produto, categoria: form.categoria,
          quantidade: form.quantidade ? Number(form.quantidade) : undefined,
          unidade: form.unidade,
          prazo_max_dias: form.prazo ? Number(form.prazo) : undefined,
          preco_max_un: form.precoMax ? Number(form.precoMax) : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setLista([j.demanda, ...lista]);
      setForm({ produto: "", categoria: "outros", quantidade: "", unidade: "un", prazo: "", precoMax: "" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setSalvando(false); }
  }

  return (
    <div>
      <form onSubmit={adicionar} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-3">
        <Field label="Produto *" full>
          <input required value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })}
            placeholder="Areia média lavada" className={inputCls} />
        </Field>
        <Field label="Categoria">
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Quantidade">
          <input value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} type="number" step="0.01" className={inputCls} />
        </Field>
        <Field label="Unidade">
          <input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Prazo máx (dias)">
          <input value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} type="number" className={inputCls} />
        </Field>
        <Field label="Preço máx un (R$)">
          <input value={form.precoMax} onChange={(e) => setForm({ ...form, precoMax: e.target.value })} type="number" step="0.01" className={inputCls} />
        </Field>
        <div className="flex items-end sm:col-span-3">
          <button type="submit" disabled={salvando || !form.produto}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
            {salvando ? "..." : "+ Registrar demanda"}
          </button>
        </div>
      </form>

      {erro && <p className="mt-3 text-xs text-rose-300">⚠️ {erro}</p>}

      <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
        {lista.length === 0 ? (
          <li className="p-6 text-center text-sm text-zinc-500">Nenhuma demanda registrada.</li>
        ) : lista.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-100">{d.produto}</p>
              <p className="text-[10px] text-zinc-500">
                {d.categoria || "geral"}
                {d.quantidade && ` · ${d.quantidade} ${d.unidade ?? ""}`}
                {d.prazo_max_dias && ` · até ${d.prazo_max_dias}d`}
                {d.preco_max_un != null && ` · máx ${fmtBrl(d.preco_max_un)}`}
              </p>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              d.status === "aberta" ? "bg-amber-500/15 text-amber-300"
              : d.status === "matched" ? "bg-blue-500/15 text-blue-300"
              : "bg-zinc-500/15 text-zinc-400"
            }`}>{d.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// ABA: TRANSACOES
// ============================================================================
function AbaTransacoes({ lista, setLista }: { lista: Transacao[]; setLista: (l: Transacao[]) => void }) {
  async function avancar(t: Transacao, novoStatus: string) {
    if (!confirm(`Mover transação #${t.id} para ${novoStatus}?`)) return;
    const r = await fetch(`/api/loja/marketplace/transacoes/${t.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    const j = await r.json();
    if (j.ok) setLista(lista.map((x) => x.id === t.id ? { ...x, status: novoStatus } : x));
  }

  if (lista.length === 0) {
    return <p className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">Nenhuma transação ainda. Use a aba <strong>Descobrir</strong> pra começar.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Compradora ↔ Fornecedora</th>
            <th className="px-3 py-2 text-right">Qtd</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Comissão SC</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {lista.map((t) => {
            const sm = STATUS_TX[t.status] ?? { label: t.status, cor: "bg-zinc-500/10 text-zinc-300" };
            const proximaTransicao =
              t.status === "pendente" ? "aceita" :
              t.status === "aceita" ? "em_transito" :
              t.status === "em_transito" ? "entregue" : null;
            return (
              <tr key={t.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-mono text-zinc-500">{t.id}</td>
                <td className="px-3 py-2 text-zinc-100">{t.produto_snapshot}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {t.loja_compradora_nome} ↔ {t.loja_fornecedora_nome}
                </td>
                <td className="px-3 py-2 text-right font-mono">{t.quantidade}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-100">{fmtBrl(t.valor_total)}</td>
                <td className="px-3 py-2 text-right font-mono text-rose-300">{fmtBrl(t.comissao_plataforma)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sm.cor}`}>
                    {sm.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {proximaTransicao && (
                    <button onClick={() => avancar(t, proximaTransicao)}
                      className="text-xs text-amber-400 hover:text-amber-300">
                      → {proximaTransicao}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-3" : ""}`}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
