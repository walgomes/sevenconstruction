"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /loja/lookalike — Recomendacao de leads por similaridade.
 * COPIA INDEPENDENTE de seven-empresas/app/lookalike/page.tsx.
 *
 * Cliente cola lista de CNPJs (carteira atual) → sistema:
 *   1. Extrai perfil da carteira (CNAE/UF/porte/capital/idade)
 *   2. Busca na sevendb empresas similares que NAO sao clientes
 *   3. Ranqueia por score de similaridade + Intent Signals
 *   4. Permite exportar CSV
 *
 * Endpoints: /api/loja/lookalike/perfil + /api/loja/lookalike/buscar
 */

import { useState, useRef } from "react";

function extrairCnpjs(texto: string): string[] {
  const limpo = texto.replace(/[^\d\n]/g, " ");
  const matches = limpo.match(/\b\d{14}\b/g) || [];
  return Array.from(new Set(matches));
}

interface PerfilCarteira {
  total_encontrados: number;
  total_pedidos: number;
  total_ativos?: number;
  total_inativos?: number;
  nao_encontrados?: string[];
  cnaes_top: { cnae: string; descricao: string | null; n: number; pct: number }[];
  ufs_top: { uf: string; n: number; pct: number }[];
  porte: { ME: number; EPP: number; demais: number; nao_informado: number };
  capital: { p25: number; mediano: number; p75: number; min: number; max: number };
  idade_anos: { p25: number; mediano: number; p75: number };
  tem_email_pct: number;
  tem_telefone_pct: number;
}

interface EmpresaSimilar {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_fiscal: string;
  cnae_descricao: string | null;
  uf: string;
  municipio: string;
  porte: number;
  capital_social: number;
  data_abertura: string | null;
  email: string | null;
  ddd1: string | null;
  telefone1: string | null;
  score: number;
  signals: { recentes_30d: number; recentes_90d: number; tipos: string[]; resumo: string; boost: number } | null;
}

interface ResultadoBusca {
  total: number;
  empresas: EmpresaSimilar[];
  perfil: PerfilCarteira;
  filtros_aplicados: {
    cnaes: string[];
    ufs: string[];
    portes: number[];
    capital_min: number;
    capital_max: number;
    idade_min_anos: number;
    idade_max_anos: number;
  };
}

const PORTE_LABEL: Record<number, string> = { 2: "ME", 3: "EPP", 5: "Médio/Grande", 1: "—" };

function fmtBRL(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtCNPJ(s: string): string {
  if (!s || s.length !== 14) return s;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}
function fmtTelefone(ddd: string | null, fone: string | null): string {
  if (!ddd || !fone) return "—";
  return `(${ddd}) ${fone}`;
}

export default function LookalikePage() {
  const [cnpjsTexto, setCnpjsTexto] = useState("");
  const [perfil, setPerfil] = useState<PerfilCarteira | null>(null);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [exigirEmail, setExigirEmail] = useState(false);
  const [exigirTelefone, setExigirTelefone] = useState(false);
  const [apenasComSinais, setApenasComSinais] = useState(false);
  const [ufsFiltro, setUfsFiltro] = useState("");
  const [limite, setLimite] = useState(200);

  const fileRef = useRef<HTMLInputElement>(null);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);

  async function lerArquivo(file: File) {
    setCarregandoArquivo(true);
    setErro("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let texto = "";
      if (ext === "xlsx" || ext === "xls") {
        const XLSX: any = await import("xlsx");
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as any[][];
        texto = linhas.flat().join("\n");
      } else {
        texto = await file.text();
      }
      const cnpjs = extrairCnpjs(texto);
      if (cnpjs.length === 0) {
        setErro(`Nenhum CNPJ válido em "${file.name}". O arquivo precisa ter números de 14 dígitos.`);
        return;
      }
      const ja = extrairCnpjs(cnpjsTexto);
      const todos = Array.from(new Set([...ja, ...cnpjs]));
      setCnpjsTexto(todos.join("\n"));
    } catch (e) {
      setErro("Erro ao ler arquivo: " + (e as Error).message);
    } finally {
      setCarregandoArquivo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function analisar() {
    setCarregando(true); setErro(""); setPerfil(null); setResultado(null);
    try {
      const r = await fetch("/api/loja/lookalike/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpjs: cnpjsTexto }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro"); return; }
      setPerfil(d.perfil);
    } catch (e) {
      setErro((e as Error).message || "Erro de conexão");
    } finally { setCarregando(false); }
  }

  async function buscar() {
    setCarregando(true); setErro(""); setResultado(null);
    const ufsLista = ufsFiltro.toUpperCase().split(/[\s,;]+/).filter((u) => u.length === 2);
    try {
      const r = await fetch("/api/loja/lookalike/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpjs: cnpjsTexto,
          filtros: {
            exigir_email: exigirEmail,
            exigir_telefone: exigirTelefone,
            apenas_com_sinais: apenasComSinais,
            ordenar_por_sinais: apenasComSinais,
            ufs: ufsLista.length > 0 ? ufsLista : undefined,
            limite,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro"); return; }
      setResultado(d);
      setPerfil(d.perfil);
    } catch (e) {
      setErro((e as Error).message || "Erro de conexão");
    } finally { setCarregando(false); }
  }

  function exportarCsv() {
    if (!resultado) return;
    const linhas = [
      ["CNPJ","Razão Social","Nome Fantasia","CNAE","Descrição CNAE","UF","Município","Porte","Capital","Abertura","Email","Telefone","Score","Signals 30d"].join(";"),
      ...resultado.empresas.map((e) => [
        fmtCNPJ(e.cnpj),
        (e.razao_social || "").replace(/;/g, ","),
        (e.nome_fantasia || "").replace(/;/g, ","),
        e.cnae_fiscal,
        (e.cnae_descricao || "").replace(/;/g, ","),
        e.uf,
        (e.municipio || "").replace(/;/g, ","),
        PORTE_LABEL[e.porte] || "",
        e.capital_social || 0,
        e.data_abertura || "",
        (e.email || "").replace(/;/g, ","),
        fmtTelefone(e.ddd1, e.telefone1),
        e.score,
        e.signals?.recentes_30d || 0,
      ].join(";")),
    ].join("\n");
    const blob = new Blob([linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lookalike-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black mb-2">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Lookalike</span> de carteira
        </h1>
        <p className="text-white/55 text-sm">
          Cole sua carteira de clientes (CNPJs). Achamos empresas <strong className="text-white">parecidas</strong> que ainda não são clientes — ranqueadas por similaridade + sinais de movimento.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-3">1. Cole sua carteira</h2>
        <textarea
          value={cnpjsTexto}
          onChange={(e) => setCnpjsTexto(e.target.value)}
          rows={8}
          placeholder="Cole CNPJs separados por linha, vírgula, espaço ou tab. Aceita com ou sem máscara.&#10;Ex: 12.345.678/0001-90&#10;98765432000110&#10;..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-white/30 focus:outline-none focus:border-violet-400 resize-none"
        />
        <div className="text-xs text-white/45 mt-1">
          Limite: 5.000 CNPJs. <strong className="text-white/70">{extrairCnpjs(cnpjsTexto).length} CNPJs detectados.</strong>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }}
            className="hidden"
            id="upload-cnpjs"
          />
          <label htmlFor="upload-cnpjs" className="cursor-pointer bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-100 font-bold px-4 py-2.5 rounded-xl text-sm">
            {carregandoArquivo ? "⚙️ Lendo..." : "📂 Upload CSV/Excel"}
          </label>
          <button onClick={analisar} disabled={carregando || !cnpjsTexto.trim()}
            className="bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-100 font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">
            {carregando && !resultado ? "⚙️ Analisando..." : "🔍 Analisar perfil"}
          </button>
          {cnpjsTexto && (
            <button onClick={() => setCnpjsTexto("")} className="text-xs text-white/55 hover:text-white px-3 py-2">✕ Limpar</button>
          )}
        </div>
        <p className="text-[11px] text-white/40 mt-2">
          💡 Aceita CSV, TXT, Excel. Busca números de 14 dígitos no arquivo todo — não importa qual coluna.
        </p>
      </section>

      {erro && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">⚠️ {erro}</div>
      )}

      {perfil && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-[11px] uppercase tracking-widest text-cyan-300 font-bold mb-3">
            2. Perfil ({perfil.total_encontrados} de {perfil.total_pedidos} CNPJs encontrados)
          </h2>

          {((perfil.nao_encontrados && perfil.nao_encontrados.length > 0) || (perfil.total_inativos && perfil.total_inativos > 0)) && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
              {perfil.nao_encontrados && perfil.nao_encontrados.length > 0 && (
                <div className="text-amber-200">
                  <strong>⚠️ {perfil.nao_encontrados.length} CNPJ(s) não encontrados</strong> na base.
                  <details className="mt-1">
                    <summary className="cursor-pointer text-amber-300/70 text-xs">Ver lista</summary>
                    <div className="font-mono text-xs text-amber-100/70 mt-1 break-all">{perfil.nao_encontrados.join(", ")}</div>
                  </details>
                </div>
              )}
              {perfil.total_inativos && perfil.total_inativos > 0 && (
                <div className="text-amber-200 mt-2">
                  <strong>⚠️ {perfil.total_inativos} inativa(s)</strong> — não influenciam o perfil de prospecção.
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Bloco titulo="🎯 CNAEs principais">
              <ul className="text-sm space-y-1">
                {perfil.cnaes_top.slice(0, 5).map((c) => (
                  <li key={c.cnae} className="flex items-baseline gap-2">
                    <span className="font-mono text-cyan-300">{c.cnae}</span>
                    <span className="text-white/85 truncate flex-1" title={c.descricao || ""}>{c.descricao || "—"}</span>
                    <span className="text-white/55 text-xs">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            <Bloco titulo="📍 Concentração geográfica">
              <ul className="text-sm space-y-1">
                {perfil.ufs_top.slice(0, 5).map((u) => (
                  <li key={u.uf} className="flex items-baseline gap-2">
                    <span className="font-bold text-white">{u.uf}</span>
                    <span className="flex-1 text-white/45 text-xs">— {u.n} empresas</span>
                    <span className="text-white/55 text-xs">{u.pct}%</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            <Bloco titulo="🏢 Porte">
              <ul className="text-sm space-y-1">
                <li className="flex justify-between"><span>ME</span><span className="text-white/55">{perfil.porte.ME}</span></li>
                <li className="flex justify-between"><span>EPP</span><span className="text-white/55">{perfil.porte.EPP}</span></li>
                <li className="flex justify-between"><span>Médio/Grande</span><span className="text-white/55">{perfil.porte.demais}</span></li>
                <li className="flex justify-between text-white/35"><span>Não informado</span><span>{perfil.porte.nao_informado}</span></li>
              </ul>
            </Bloco>

            <Bloco titulo="💰 Capital social (faixa)">
              <ul className="text-sm space-y-1">
                <li className="flex justify-between"><span className="text-white/55">P25</span><span className="text-white">{fmtBRL(perfil.capital.p25)}</span></li>
                <li className="flex justify-between"><span className="text-white/55">Mediana</span><span className="text-white font-bold">{fmtBRL(perfil.capital.mediano)}</span></li>
                <li className="flex justify-between"><span className="text-white/55">P75</span><span className="text-white">{fmtBRL(perfil.capital.p75)}</span></li>
              </ul>
            </Bloco>

            <Bloco titulo="🕒 Idade da empresa">
              <ul className="text-sm space-y-1">
                <li className="flex justify-between"><span className="text-white/55">P25</span><span className="text-white">{perfil.idade_anos.p25} anos</span></li>
                <li className="flex justify-between"><span className="text-white/55">Mediana</span><span className="text-white font-bold">{perfil.idade_anos.mediano} anos</span></li>
                <li className="flex justify-between"><span className="text-white/55">P75</span><span className="text-white">{perfil.idade_anos.p75} anos</span></li>
              </ul>
            </Bloco>

            <Bloco titulo="📞 Cobertura de contato">
              <ul className="text-sm space-y-1">
                <li className="flex justify-between"><span className="text-white/55">Email</span><span className="text-white font-bold">{perfil.tem_email_pct}%</span></li>
                <li className="flex justify-between"><span className="text-white/55">Telefone</span><span className="text-white font-bold">{perfil.tem_telefone_pct}%</span></li>
              </ul>
            </Bloco>
          </div>
        </section>
      )}

      {(perfil || cnpjsTexto.trim()) && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-[11px] uppercase tracking-widest text-emerald-300 font-bold mb-3">3. Filtros e busca</h2>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-white/70 text-xs font-medium block mb-1">UFs alvo (vazio = usa as do perfil)</span>
              <input type="text" value={ufsFiltro} onChange={(e) => setUfsFiltro(e.target.value)}
                placeholder="Ex: SP, RJ, MG"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm uppercase" />
            </label>
            <label className="block">
              <span className="text-white/70 text-xs font-medium block mb-1">Limite de resultados</span>
              <select value={limite} onChange={(e) => setLimite(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                <option value={50}  className="bg-zinc-900">50</option>
                <option value={100} className="bg-zinc-900">100</option>
                <option value={200} className="bg-zinc-900">200</option>
                <option value={500} className="bg-zinc-900">500</option>
                <option value={1000} className="bg-zinc-900">1.000</option>
                <option value={2000} className="bg-zinc-900">2.000</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-white/85">
              <input type="checkbox" checked={exigirEmail} onChange={(e) => setExigirEmail(e.target.checked)} className="w-4 h-4" />
              Só com email
            </label>
            <label className="flex items-center gap-2 text-sm text-white/85">
              <input type="checkbox" checked={exigirTelefone} onChange={(e) => setExigirTelefone(e.target.checked)} className="w-4 h-4" />
              Só com telefone
            </label>
            <label className="flex items-center gap-2 text-sm text-white/85 sm:col-span-2">
              <input type="checkbox" checked={apenasComSinais} onChange={(e) => setApenasComSinais(e.target.checked)} className="w-4 h-4" />
              🔥 Só leads em movimento (signals 90d) — converte 5-10× mais
            </label>
          </div>

          <button onClick={buscar} disabled={carregando || !cnpjsTexto.trim()}
            className="bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
            {carregando ? "⚙️ Buscando similares..." : "🚀 Encontrar empresas similares"}
          </button>
        </section>
      )}

      {resultado && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-[11px] uppercase tracking-widest text-amber-300 font-bold mb-1">
                4. Empresas similares ({resultado.total})
              </h2>
              <p className="text-white/55 text-sm">
                CNAEs {resultado.filtros_aplicados.cnaes.length} · UFs {resultado.filtros_aplicados.ufs.length} · capital {fmtBRL(resultado.filtros_aplicados.capital_min)} → {fmtBRL(resultado.filtros_aplicados.capital_max)} · idade {resultado.filtros_aplicados.idade_min_anos}-{resultado.filtros_aplicados.idade_max_anos}a
              </p>
            </div>
            <button onClick={exportarCsv} className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-100 font-bold px-4 py-2 rounded-lg text-xs">
              📥 Exportar CSV
            </button>
          </div>

          {resultado.total === 0 ? (
            <p className="text-white/55 text-sm text-center py-12">Nenhuma empresa similar com os filtros atuais.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-white/45">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-2">Score</th>
                    <th className="text-left py-2 px-2">Razão Social</th>
                    <th className="text-left py-2 px-2">CNPJ</th>
                    <th className="text-left py-2 px-2">CNAE</th>
                    <th className="text-left py-2 px-2">UF</th>
                    <th className="text-left py-2 px-2">Município</th>
                    <th className="text-left py-2 px-2">Porte</th>
                    <th className="text-right py-2 px-2">Capital</th>
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-left py-2 px-2">Tel</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.empresas.map((e) => (
                    <tr key={e.cnpj} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-2 px-2">
                        <span className="inline-block bg-violet-500/20 border border-violet-500/40 text-violet-100 text-xs font-bold px-2 py-0.5 rounded">
                          {e.score}
                        </span>
                        {e.signals && e.signals.recentes_30d > 0 && (
                          <span className="ml-1 text-[10px] bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold px-1.5 py-0.5 rounded">🔥</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-white">
                        <div className="font-bold">{e.razao_social}</div>
                        {e.nome_fantasia && <div className="text-white/55 text-xs">{e.nome_fantasia}</div>}
                        {e.signals?.resumo && <div className="text-cyan-200 text-[11px] mt-0.5">{e.signals.resumo}</div>}
                      </td>
                      <td className="py-2 px-2 font-mono text-xs text-white/70">{fmtCNPJ(e.cnpj)}</td>
                      <td className="py-2 px-2 font-mono text-xs text-cyan-300" title={e.cnae_descricao || ""}>{e.cnae_fiscal}</td>
                      <td className="py-2 px-2">{e.uf}</td>
                      <td className="py-2 px-2 text-white/70">{e.municipio}</td>
                      <td className="py-2 px-2 text-white/70">{PORTE_LABEL[e.porte] || "—"}</td>
                      <td className="py-2 px-2 text-right text-white/70">{fmtBRL(e.capital_social)}</td>
                      <td className="py-2 px-2 text-cyan-300 text-xs truncate max-w-[160px]" title={e.email || ""}>{e.email || "—"}</td>
                      <td className="py-2 px-2 text-white/70 text-xs">{fmtTelefone(e.ddd1, e.telefone1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-violet-300 font-bold mb-2">{titulo}</h3>
      {children}
    </div>
  );
}
