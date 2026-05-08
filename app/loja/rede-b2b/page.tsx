"use client";
/**
 * Rede B2B de Performance — copiada do projeto seven-empresas (consultTudo).
 * VIDA INDEPENDENTE: alterar aqui nao altera la.
 *
 * Nao e feed. Infraestrutura de match → conversa direta com decisor.
 * Cada CNPJ tem perfil declarado (o que vende, ICP, quem procura). Cruza:
 *   1. Lookalike classico   2. ICP declarado
 *   3. Intent Signals       4. Reciprocidade
 *
 * 4 abas: Meu perfil | Matches | Conversas | Trending
 */

import { useState, useEffect, useCallback } from "react";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const PORTES = ["ME","EPP","MEDIA","GRANDE"];

interface PerfilB2B {
  id?: number;
  cnpj: string;
  o_que_vende?: string | null;
  diferencial?: string | null;
  icp_cnaes?: string[] | null;
  icp_ufs?: string[] | null;
  icp_porte?: string[] | null;
  icp_faturamento_min?: number | null;
  icp_faturamento_max?: number | null;
  icp_descricao?: string | null;
  capacidade_atendimentos_mes?: number | null;
  ticket_medio_centavos?: number | null;
  modalidade?: string[] | null;
  visivel?: boolean;
  aberto_para_conversas?: boolean;
  procurando_clientes?: boolean;
  procurando_fornecedores?: boolean;
  procurando_parcerias?: boolean;
  verificado?: boolean;
}

interface Match {
  cnpj_alvo: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  uf: string;
  municipio: string | null;
  porte: number;
  capital_social: number;
  email: string | null;
  telefone: string | null;
  fit_score: number;
  fit_breakdown: Record<string, number>;
  motivo: string;
  signals: { recentes_30d: number; recentes_90d: number; tipos: string[]; resumo: string } | null;
  perfil_declarado: boolean;
  aberto_para_conversas: boolean;
}

interface Conversa {
  id: number;
  cnpj_origem: string;
  cnpj_alvo: string;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  status: string;
  iniciada_em: string;
  ultima_mensagem_em: string | null;
  nao_lidas: number;
  ultima_msg: string | null;
}

function fmtCnpj(s: string) {
  const d = (s || "").replace(/\D/g, "");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }

export default function RedeB2BPage() {
  const [aba, setAba] = useState<"perfil" | "matches" | "conversas" | "trending">("perfil");
  const [meuCnpj, setMeuCnpj] = useState("");

  return (
    <section className="mx-auto max-w-6xl px-6 pt-6 pb-12">
      <div className="text-center mb-6">
        <span className="inline-block text-[11px] uppercase tracking-widest bg-violet-500/15 border border-violet-500/30 text-violet-200 px-3 py-1 rounded-full mb-3">
          Beta · Rede B2B
        </span>
        <h1 className="text-3xl md:text-4xl font-black mb-3">
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            Rede B2B de Performance
          </span>
        </h1>
        <p className="text-zinc-400 max-w-3xl mx-auto leading-relaxed text-sm">
          Não é feed. É infraestrutura de <strong>match → conversa direta com decisor</strong>. Sua empresa entra,
          declara o que vende e o ICP, a IA gera lookalike automático com sinais de movimento e abre canal direto
          com quem realmente decide.
        </p>
      </div>

      <div className="bg-white/[0.02] border border-violet-500/30 rounded-2xl p-4 mb-5">
        <label className="block text-[10px] uppercase tracking-wider text-violet-400 font-bold mb-1">
          CNPJ da sua empresa (a que vai operar na rede)
        </label>
        <input
          type="text"
          value={meuCnpj}
          onChange={(e) => setMeuCnpj(formatarCnpjInput(e.target.value))}
          placeholder="00.000.000/0001-00"
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50 font-mono"
          maxLength={18}
        />
        <p className="text-[11px] text-white/40 mt-2">
          Sua empresa. Outras empresas conseguem te ver e iniciar conversa quando você publica o perfil.
        </p>
      </div>

      <div className="flex gap-1 border-b-2 border-white/10 mb-5 overflow-x-auto">
        {[
          { id: "perfil",    l: "🎯 Meu perfil B2B" },
          { id: "matches",   l: "🔥 Matches" },
          { id: "conversas", l: "💬 Conversas" },
          { id: "trending",  l: "📈 Trending" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id as typeof aba)}
            className={`px-5 py-3 font-bold whitespace-nowrap border-b-2 -mb-[2px] transition-colors ${
              aba === t.id ? "border-violet-500 text-white" : "border-transparent text-white/45 hover:text-white/80"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {!meuCnpj || meuCnpj.replace(/\D/g, "").length !== 14 ? (
        <div className="text-center py-10 text-white/45 text-sm">👆 Insira seu CNPJ acima pra começar.</div>
      ) : (
        <>
          {aba === "perfil"    && <AbaPerfil cnpj={meuCnpj} />}
          {aba === "matches"   && <AbaMatches cnpj={meuCnpj} />}
          {aba === "conversas" && <AbaConversas cnpj={meuCnpj} />}
          {aba === "trending"  && <AbaTrending cnpj={meuCnpj} />}
        </>
      )}
    </section>
  );
}

function formatarCnpjInput(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// ============================================================================
// ABA 1: PERFIL B2B
// ============================================================================
function AbaPerfil({ cnpj }: { cnpj: string }) {
  const [perfil, setPerfil] = useState<PerfilB2B>({ cnpj });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvouEm, setSalvouEm] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [iaCarregando, setIaCarregando] = useState(false);
  const [iaErro, setIaErro] = useState<string | null>(null);
  const [iaEvidencias, setIaEvidencias] = useState<string | null>(null);

  async function preencherComIa() {
    if (!siteUrl || siteUrl.length < 6) { setIaErro("Informe a URL do site"); return; }
    setIaCarregando(true);
    setIaErro(null);
    setIaEvidencias(null);
    try {
      const r = await fetch("/api/loja/rede-b2b/perfil/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, ""), site_url: siteUrl }),
      });
      const d = await r.json();
      if (!r.ok) setIaErro(d.mensagem || d.error || "Erro");
      else {
        setPerfil({ ...perfil, ...d.perfil_sugerido });
        setIaEvidencias(d.evidencias || null);
      }
    } finally { setIaCarregando(false); }
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/loja/rede-b2b/perfil?cnpj=${cnpj.replace(/\D/g, "")}`);
      const d = await r.json();
      setPerfil(d.perfil || { cnpj });
    } finally { setCarregando(false); }
  }, [cnpj]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/loja/rede-b2b/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, ""), dados: perfil }),
      });
      const d = await r.json();
      if (!r.ok) setErro(d.error || "Erro");
      else { setSalvouEm(new Date().toLocaleTimeString("pt-BR")); await carregar(); }
    } finally { setSalvando(false); }
  }

  if (carregando) return <div className="text-center py-8 text-white/45">Carregando…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="lg:col-span-2 bg-gradient-to-br from-violet-500/[0.10] to-fuchsia-500/[0.06] border-2 border-violet-500/40 rounded-2xl p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="text-3xl shrink-0">🤖</div>
          <div className="flex-1 min-w-[260px]">
            <h3 className="font-bold text-white text-base mb-1">Preencher tudo automaticamente lendo seu site</h3>
            <p className="text-xs text-white/65 leading-relaxed">
              Cole a URL do seu site → IA lê + analisa + preenche oferta, diferencial, ICP, CNAE-alvo, UFs, porte e ticket em ~30s. Você revisa antes de salvar.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <input
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://suaempresa.com.br"
                className="flex-1 min-w-[240px] bg-white/[0.04] border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400"
              />
              <button onClick={preencherComIa} disabled={iaCarregando || !siteUrl}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
                {iaCarregando ? "🧠 Lendo site…" : "🤖 Preencher com IA"}
              </button>
            </div>
            {iaErro && <div className="text-rose-300 text-xs mt-2">⚠️ {iaErro}</div>}
            {iaEvidencias && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-violet-300 hover:text-violet-200 font-semibold">📚 Por que a IA decidiu assim</summary>
                <div className="mt-2 bg-white/[0.03] border border-white/10 rounded p-3 text-white/70 leading-relaxed">{iaEvidencias}</div>
              </details>
            )}
          </div>
        </div>
      </div>

      <Card titulo="O que sua empresa vende">
        <Field label="Descrição da oferta">
          <textarea rows={3} value={perfil.o_que_vende || ""} onChange={(e) => setPerfil({ ...perfil, o_que_vende: e.target.value })}
            placeholder="Ex: Cimento, argamassa, vergalhão CA-50..." className="input-rede" />
        </Field>
        <Field label="Diferencial competitivo">
          <textarea rows={2} value={perfil.diferencial || ""} onChange={(e) => setPerfil({ ...perfil, diferencial: e.target.value })}
            placeholder="O que torna sua oferta única" className="input-rede" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacidade/mês">
            <input type="number" value={perfil.capacidade_atendimentos_mes || ""} onChange={(e) => setPerfil({ ...perfil, capacidade_atendimentos_mes: parseInt(e.target.value) || null })} placeholder="50" className="input-rede" />
          </Field>
          <Field label="Ticket médio (R$)">
            <input type="number" value={perfil.ticket_medio_centavos ? perfil.ticket_medio_centavos / 100 : ""} onChange={(e) => setPerfil({ ...perfil, ticket_medio_centavos: parseFloat(e.target.value) ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="2500" className="input-rede" />
          </Field>
        </div>
      </Card>

      <Card titulo="Cliente ideal (ICP)">
        <Field label="CNAEs do cliente ideal">
          <input type="text" value={(perfil.icp_cnaes || []).join(", ")} onChange={(e) => setPerfil({ ...perfil, icp_cnaes: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
            placeholder="4120400, 4313400, 4321500" className="input-rede font-mono" />
          <div className="text-[10px] text-white/40 mt-1">7 dígitos sem ponto. Ex: 4120400 = construção edifícios</div>
        </Field>
        <Field label="UFs onde quer atender">
          <div className="flex flex-wrap gap-1">
            {UFS.map((uf) => {
              const ativo = (perfil.icp_ufs || []).includes(uf);
              return <button key={uf} onClick={() => {
                const set = new Set(perfil.icp_ufs || []);
                if (ativo) set.delete(uf); else set.add(uf);
                setPerfil({ ...perfil, icp_ufs: Array.from(set) });
              }} className={`text-[11px] px-2 py-1 rounded font-bold transition-colors ${ativo ? "bg-violet-500 text-white" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"}`}>{uf}</button>;
            })}
          </div>
        </Field>
        <Field label="Porte">
          <div className="flex gap-2 flex-wrap">
            {PORTES.map((p) => {
              const ativo = (perfil.icp_porte || []).includes(p);
              return <button key={p} onClick={() => {
                const set = new Set(perfil.icp_porte || []);
                if (ativo) set.delete(p); else set.add(p);
                setPerfil({ ...perfil, icp_porte: Array.from(set) });
              }} className={`text-xs px-3 py-1.5 rounded font-bold ${ativo ? "bg-violet-500 text-white" : "bg-white/[0.04] text-white/55"}`}>{p}</button>;
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Faturamento min. (R$/ano)">
            <input type="number" value={perfil.icp_faturamento_min || ""} onChange={(e) => setPerfil({ ...perfil, icp_faturamento_min: parseInt(e.target.value) || null })} placeholder="1000000" className="input-rede" />
          </Field>
          <Field label="Faturamento max. (R$/ano)">
            <input type="number" value={perfil.icp_faturamento_max || ""} onChange={(e) => setPerfil({ ...perfil, icp_faturamento_max: parseInt(e.target.value) || null })} placeholder="50000000" className="input-rede" />
          </Field>
        </div>
        <Field label="Descrição livre do ICP">
          <textarea rows={2} value={perfil.icp_descricao || ""} onChange={(e) => setPerfil({ ...perfil, icp_descricao: e.target.value })}
            placeholder="Ex: construtoras de médio porte com 5+ obras simultâneas em SP/MG" className="input-rede" />
        </Field>
      </Card>

      <Card titulo="Status na rede" className="lg:col-span-2">
        <div className="grid sm:grid-cols-2 gap-3">
          <Toggle label="🌐 Visível para outras empresas" value={perfil.visivel ?? true} onChange={(v) => setPerfil({ ...perfil, visivel: v })} />
          <Toggle label="💬 Aberto para receber conversas" value={perfil.aberto_para_conversas ?? true} onChange={(v) => setPerfil({ ...perfil, aberto_para_conversas: v })} />
          <Toggle label="🎯 Procurando clientes" value={perfil.procurando_clientes ?? true} onChange={(v) => setPerfil({ ...perfil, procurando_clientes: v })} />
          <Toggle label="🛒 Procurando fornecedores" value={perfil.procurando_fornecedores ?? false} onChange={(v) => setPerfil({ ...perfil, procurando_fornecedores: v })} />
          <Toggle label="🤝 Procurando parcerias" value={perfil.procurando_parcerias ?? false} onChange={(v) => setPerfil({ ...perfil, procurando_parcerias: v })} />
        </div>
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <button onClick={salvar} disabled={salvando} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50">
            {salvando ? "Salvando…" : "💾 Salvar perfil B2B"}
          </button>
          {salvouEm && <span className="text-emerald-300 text-xs">✅ Salvo às {salvouEm}</span>}
          {erro && <span className="text-rose-300 text-xs">⚠️ {erro}</span>}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// ABA 2: MATCHES
// ============================================================================
function AbaMatches({ cnpj }: { cnpj: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<{ com_signals_30d: number; com_perfil_declarado: number; abertos_para_conversa: number; fit_medio: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conversaDe, setConversaDe] = useState<Match | null>(null);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/loja/rede-b2b/matches?cnpj=${cnpj.replace(/\D/g, "")}&limite=50&salvar=true`);
      const d = await r.json();
      if (!r.ok) setErro(d.error || "Erro — cadastre seu perfil B2B primeiro");
      else { setMatches(d.matches || []); setStats(d.stats); }
    } finally { setCarregando(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={buscar} disabled={carregando} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50">
          {carregando ? "Cruzando ICP + signals…" : "🔥 Gerar matches agora"}
        </button>
        {stats && (
          <div className="flex gap-3 text-xs flex-wrap">
            <Badge>🎯 Fit médio: {stats.fit_medio}/100</Badge>
            <Badge>🔥 Em movimento 30d: {stats.com_signals_30d}</Badge>
            <Badge>✅ Cadastrados na rede: {stats.com_perfil_declarado}</Badge>
            <Badge>💬 Abertos pra conversa: {stats.abertos_para_conversa}</Badge>
          </div>
        )}
      </div>

      {erro && <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-4 text-rose-200 text-sm">⚠️ {erro}</div>}

      {matches.length === 0 && !carregando && !erro && (
        <div className="text-center py-12 text-white/45 text-sm">Click em &quot;Gerar matches&quot; pra cruzar seu ICP com a base.</div>
      )}

      <div className="space-y-3">
        {matches.map((m) => (
          <article key={m.cnpj_alvo} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-violet-500/40 transition-colors">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-white">{m.razao_social}</h3>
                  {m.signals && m.signals.recentes_30d > 0 && (
                    <span className="text-[10px] uppercase font-bold bg-rose-500/20 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded-full">🔥 EM MOVIMENTO</span>
                  )}
                  {m.perfil_declarado && (
                    <span className="text-[10px] uppercase font-bold bg-violet-500/20 border border-violet-500/40 text-violet-200 px-2 py-0.5 rounded-full">✅ NA REDE</span>
                  )}
                  {m.aberto_para_conversas && (
                    <span className="text-[10px] uppercase font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-2 py-0.5 rounded-full">💬 ABERTO</span>
                  )}
                </div>
                <div className="text-white/55 text-xs mb-1">CNPJ {fmtCnpj(m.cnpj_alvo)} · {m.uf}{m.municipio ? `/${m.municipio}` : ""} · {brl(m.capital_social)}</div>
                <div className="text-white/40 text-[11px] mb-2">{m.cnae_descricao}</div>
                <div className="text-emerald-200 text-xs">{m.motivo}</div>
                {m.signals?.resumo && <div className="text-cyan-200 text-[11px] mt-1">{m.signals.resumo}</div>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-black bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">{m.fit_score}</div>
                <div className="text-[10px] text-white/40 uppercase font-bold">FIT</div>
                <button onClick={() => setConversaDe(m)} disabled={!m.aberto_para_conversas}
                  className="mt-2 bg-violet-500 hover:bg-violet-600 disabled:bg-white/[0.04] disabled:text-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                  {m.aberto_para_conversas ? "💬 Abrir conversa" : "🔒 Não aberto"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {conversaDe && <ModalIniciarConversa origem={cnpj} alvo={conversaDe} onFechar={() => setConversaDe(null)} />}
    </div>
  );
}

// ============================================================================
// ABA 3: CONVERSAS
// ============================================================================
function AbaConversas({ cnpj }: { cnpj: string }) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/loja/rede-b2b/conversa?cnpj=${cnpj.replace(/\D/g, "")}`)
      .then((r) => r.json())
      .then((d) => setConversas(d.conversas || []))
      .finally(() => setCarregando(false));
  }, [cnpj]);

  if (carregando) return <div className="text-center py-8 text-white/45">Carregando…</div>;
  if (conversas.length === 0) return (
    <div className="text-center py-12 text-white/45 text-sm">
      Nenhuma conversa ainda. Vá em <strong className="text-violet-300">🔥 Matches</strong> e clique em &quot;💬 Abrir conversa&quot;.
    </div>
  );

  return (
    <div className="space-y-2">
      {conversas.map((c) => {
        const eu = c.cnpj_origem === cnpj.replace(/\D/g, "");
        const outro = eu ? c.cnpj_alvo : c.cnpj_origem;
        return (
          <div key={c.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:bg-white/[0.06]">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <div className="font-bold text-white">{eu ? "→" : "←"} CNPJ {fmtCnpj(outro)}</div>
                {c.decisor_nome && <div className="text-xs text-white/55 mt-0.5">Decisor: {c.decisor_nome}{c.decisor_cargo ? ` (${c.decisor_cargo})` : ""}</div>}
                {c.ultima_msg && <div className="text-xs text-white/65 mt-1 italic">&quot;{c.ultima_msg.slice(0, 120)}{c.ultima_msg.length > 120 ? "…" : ""}&quot;</div>}
              </div>
              <div className="text-right">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                  c.status === "aberta" ? "bg-cyan-500/20 text-cyan-200" :
                  c.status === "aceita" ? "bg-emerald-500/20 text-emerald-200" :
                  c.status === "reuniao_agendada" ? "bg-violet-500/20 text-violet-200" :
                  "bg-white/[0.06] text-white/50"
                }`}>{c.status.replace(/_/g, " ")}</span>
                {c.nao_lidas > 0 && (
                  <div className="mt-1 text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold inline-block">
                    {c.nao_lidas} nova{c.nao_lidas > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// ABA 4: TRENDING
// ============================================================================
interface EmpresaTrending {
  cnpj: string;
  razao_social: string;
  cnae_descricao: string | null;
  uf: string;
  municipio: string | null;
  porte: number;
  capital_social: number;
  email: string | null;
  telefone: string | null;
  signals: {
    total: number;
    ultimas_24h: number;
    ultimos_7d: number;
    origens: string[];
    ultimo_evento_em: string | null;
    ultimo_titulo: string;
    ultimo_tipo: string | null;
  };
  perfil_declarado: boolean;
}

function AbaTrending({ cnpj: meuCnpj }: { cnpj: string }) {
  const [dias, setDias] = useState(7);
  const [filtroUf, setFiltroUf] = useState<string[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaTrending[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [conversaDe, setConversaDe] = useState<EmpresaTrending | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      params.set("dias", String(dias));
      params.set("limite", "100");
      if (filtroUf.length > 0) params.set("uf", filtroUf.join(","));
      const r = await fetch(`/api/loja/rede-b2b/trending?${params}`);
      const d = await r.json();
      setEmpresas(d.empresas || []);
    } finally { setCarregando(false); }
  }, [dias, filtroUf]);

  useEffect(() => { buscar(); }, [buscar]);

  return (
    <div>
      <div className="bg-white/[0.02] border border-violet-500/30 rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-violet-400 font-bold mb-1">Janela</label>
            <select value={dias} onChange={(e) => setDias(parseInt(e.target.value))}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-400">
              <option value={1}>Últimas 24h</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] uppercase tracking-wider text-violet-400 font-bold mb-1">Filtrar UFs (opcional)</label>
            <div className="flex gap-1 flex-wrap">
              {UFS.map((uf) => {
                const ativo = filtroUf.includes(uf);
                return <button key={uf} onClick={() => setFiltroUf(ativo ? filtroUf.filter((u) => u !== uf) : [...filtroUf, uf])}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${ativo ? "bg-violet-500 text-white" : "bg-white/[0.04] text-white/45 hover:bg-white/[0.08]"}`}>{uf}</button>;
              })}
            </div>
          </div>
          <button onClick={buscar} disabled={carregando} className="bg-violet-500 hover:bg-violet-600 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50 self-end">
            {carregando ? "Carregando…" : "🔄 Atualizar"}
          </button>
        </div>
      </div>

      {empresas.length === 0 && !carregando && (
        <div className="text-center py-12 text-white/45 text-sm">Nenhuma empresa em movimento nesta janela. Tente expandir pra 30 ou 90 dias.</div>
      )}

      <div className="space-y-3">
        {empresas.map((e) => (
          <article key={e.cnpj} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-violet-500/40 transition-colors">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-white">{e.razao_social}</h3>
                  {e.signals.ultimas_24h > 0 && (
                    <span className="text-[10px] uppercase font-bold bg-rose-500/20 border border-rose-500/40 text-rose-200 px-2 py-0.5 rounded-full animate-pulse">🔥 ATIVA HOJE</span>
                  )}
                  {e.perfil_declarado && (
                    <span className="text-[10px] uppercase font-bold bg-violet-500/20 border border-violet-500/40 text-violet-200 px-2 py-0.5 rounded-full">✅ NA REDE</span>
                  )}
                </div>
                <div className="text-white/55 text-xs mb-1">CNPJ {fmtCnpj(e.cnpj)} · {e.uf}{e.municipio ? `/${e.municipio}` : ""} · {brl(e.capital_social)}</div>
                <div className="text-white/40 text-[11px] mb-2">{e.cnae_descricao}</div>
                <div className="text-cyan-200 text-xs font-semibold mb-1">📊 {e.signals.total} sinal(is) na janela · {e.signals.origens.join(" · ")}</div>
                {e.signals.ultimo_titulo && (
                  <div className="text-white/65 text-[11px] italic">
                    Último: &quot;{e.signals.ultimo_titulo}&quot;
                    {e.signals.ultimo_evento_em && ` · ${new Date(e.signals.ultimo_evento_em).toLocaleDateString("pt-BR")}`}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-black bg-gradient-to-r from-rose-300 to-orange-300 bg-clip-text text-transparent">{e.signals.total}</div>
                <div className="text-[10px] text-white/40 uppercase font-bold">SIGNALS</div>
                <button onClick={() => setConversaDe(e)} className="mt-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">💬 Iniciar conversa</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {conversaDe && (
        <ModalIniciarConversa
          origem={meuCnpj}
          alvo={{
            cnpj_alvo: conversaDe.cnpj, razao_social: conversaDe.razao_social, nome_fantasia: null,
            cnae_fiscal: "", cnae_descricao: conversaDe.cnae_descricao, uf: conversaDe.uf, municipio: conversaDe.municipio,
            porte: conversaDe.porte, capital_social: conversaDe.capital_social,
            email: conversaDe.email, telefone: conversaDe.telefone,
            fit_score: 0, fit_breakdown: {}, motivo: "Trending — em movimento",
            signals: { recentes_30d: conversaDe.signals.total, recentes_90d: conversaDe.signals.total, tipos: conversaDe.signals.origens, resumo: conversaDe.signals.ultimo_titulo },
            perfil_declarado: conversaDe.perfil_declarado, aberto_para_conversas: true,
          }}
          onFechar={() => setConversaDe(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL — iniciar conversa
// ============================================================================
function ModalIniciarConversa({ origem, alvo, onFechar }: { origem: string; alvo: Match; onFechar: () => void }) {
  const [decisorNome, setDecisorNome] = useState("");
  const [decisorCargo, setDecisorCargo] = useState("");
  const [decisorEmail, setDecisorEmail] = useState(alvo.email || "");
  const [decisorTel, setDecisorTel] = useState(alvo.telefone || "");
  const [primeiraMsg, setPrimeiraMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (primeiraMsg.trim().length < 10) { setErro("Mensagem muito curta"); return; }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/loja/rede-b2b/conversa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj_origem: origem.replace(/\D/g, ""),
          cnpj_alvo: alvo.cnpj_alvo,
          decisor_nome: decisorNome || null,
          decisor_cargo: decisorCargo || null,
          decisor_email: decisorEmail || null,
          decisor_telefone: decisorTel || null,
          primeira_mensagem: primeiraMsg.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) setErro(d.error || "Erro");
      else onFechar();
    } finally { setEnviando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-[#0a0a14] border border-violet-500/40 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-white text-lg">💬 Iniciar conversa</h3>
            <div className="text-xs text-white/55 mt-1">{alvo.razao_social}</div>
          </div>
          <button onClick={onFechar} className="text-white/55 text-2xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Decisor (nome)">
              <input value={decisorNome} onChange={(e) => setDecisorNome(e.target.value)} className="input-rede" placeholder="João Silva" />
            </Field>
            <Field label="Cargo do decisor">
              <input value={decisorCargo} onChange={(e) => setDecisorCargo(e.target.value)} className="input-rede" placeholder="Diretor Comercial" />
            </Field>
          </div>
          <Field label="Email do decisor">
            <input type="email" value={decisorEmail} onChange={(e) => setDecisorEmail(e.target.value)} className="input-rede" />
          </Field>
          <Field label="Telefone/WhatsApp">
            <input value={decisorTel} onChange={(e) => setDecisorTel(e.target.value)} className="input-rede" />
          </Field>
          <Field label="Primeira mensagem">
            <textarea rows={4} value={primeiraMsg} onChange={(e) => setPrimeiraMsg(e.target.value)}
              placeholder="Olá, vi que vocês estão com fit alto com nossa oferta..." className="input-rede" />
          </Field>
          {erro && <div className="text-rose-300 text-xs">⚠️ {erro}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={enviar} disabled={enviando || primeiraMsg.length < 10}
              className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
              {enviando ? "Enviando…" : "💬 Iniciar conversa"}
            </button>
            <button onClick={onFechar} className="bg-white/[0.04] text-white/70 font-semibold px-5 py-3 rounded-xl">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// helpers
// ============================================================================
function Card({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.02] border border-white/10 rounded-2xl p-5 ${className}`}>
      <div className="text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-3">{titulo}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-white/55 font-bold mb-1">{label}</label>
      {children}
      <style jsx global>{`
        .input-rede {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          color: white;
          font-size: 0.875rem;
        }
        .input-rede:focus { outline: none; border-color: rgb(167 139 250 / 0.5); background: rgba(167 139 250 / 0.04); }
        .input-rede::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-white/75">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-violet-500" />
      {label}
    </label>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="bg-white/[0.04] border border-white/10 text-white/65 px-2 py-1 rounded-full">{children}</span>;
}
