"use client";

import { useEffect, useState, useCallback } from "react";

type Resumo = {
  periodo: { mes_referencia: string };
  vendas: {
    total_eventos: number;
    total_venda: number;
    total_comissao: number;
    ticket_medio: number;
    por_servico: { codigo: string; nome: string; qtd: number; comissao: number }[];
  };
  indicacoes: {
    total_eventos: number;
    total_comissao_a_pagar: number;
    profissionais_ativos: number;
    top_profissionais: { nome: string; qtd: number; total: number }[];
  };
  clientes: { total: number; novos_no_mes: number; com_compra: number };
  prospec: { listas_criadas_mes: number; total_empresas_prospectadas: number };
};

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ultimosMeses(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const mes = d.getMonth() - i;
    const ano = d.getFullYear() + Math.floor((d.getMonth() - i) / 12);
    const m = ((mes % 12) + 12) % 12;
    out.push(`${ano}-${String(m + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function RelatoriosPage() {
  const [mes, setMes] = useState(mesAtual());
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/relatorios?mes=${mes}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setResumo(j);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Relatórios</p>
          <h1 className="mt-1 text-3xl font-semibold">Relatório mensal</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            {ultimosMeses(12).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <a
            href={`/api/relatorios?mes=${mes}&formato=csv`}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            Baixar CSV
          </a>
        </div>
      </header>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {carregando && <p className="mt-8 text-sm text-zinc-500">Carregando...</p>}

      {resumo && !carregando && (
        <div className="mt-6 space-y-8">
          {/* Vendas de serviços */}
          <section>
            <h2 className="text-lg font-semibold text-amber-300">💰 Vendas de serviços</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-4">
              <KPI label="Eventos" valor={resumo.vendas.total_eventos} />
              <KPI label="Receita bruta" valor={fmtBrl(resumo.vendas.total_venda)} />
              <KPI label="Comissão da loja" valor={fmtBrl(resumo.vendas.total_comissao)} cor="amber" />
              <KPI label="Ticket médio" valor={fmtBrl(resumo.vendas.ticket_medio)} />
            </div>
            {resumo.vendas.por_servico.length > 0 && (
              <Tabela
                titulo="Por serviço"
                headers={["Código", "Nome", "Qtd", "Comissão"]}
                rows={resumo.vendas.por_servico.map((s) => [s.codigo, s.nome, s.qtd, fmtBrl(s.comissao)])}
              />
            )}
          </section>

          {/* Indicações */}
          <section>
            <h2 className="text-lg font-semibold text-amber-300">🤝 Indicações de profissionais</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <KPI label="Vendas com indicação" valor={resumo.indicacoes.total_eventos} />
              <KPI label="Comissão a pagar" valor={fmtBrl(resumo.indicacoes.total_comissao_a_pagar)} cor="amber" />
              <KPI label="Profissionais ativos" valor={resumo.indicacoes.profissionais_ativos} />
            </div>
            {resumo.indicacoes.top_profissionais.length > 0 && (
              <Tabela
                titulo="Top profissionais (por comissão)"
                headers={["Nome", "Qtd", "Comissão"]}
                rows={resumo.indicacoes.top_profissionais.map((p) => [p.nome, p.qtd, fmtBrl(p.total)])}
              />
            )}
          </section>

          {/* Clientes */}
          <section>
            <h2 className="text-lg font-semibold text-amber-300">👥 Base de clientes</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <KPI label="Total ativo" valor={resumo.clientes.total} />
              <KPI label="Novos no mês" valor={resumo.clientes.novos_no_mes} cor="amber" />
              <KPI label="Com compra registrada" valor={resumo.clientes.com_compra} />
            </div>
          </section>

          {/* Prospecção */}
          <section>
            <h2 className="text-lg font-semibold text-amber-300">🔍 Prospecção</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <KPI label="Listas criadas no mês" valor={resumo.prospec.listas_criadas_mes} />
              <KPI label="Empresas prospectadas" valor={resumo.prospec.total_empresas_prospectadas} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function KPI({ label, valor, cor }: { label: string; valor: number | string; cor?: "amber" }) {
  return (
    <div className={`rounded-xl border p-5 ${cor === "amber" ? "border-amber-700/40 bg-amber-950/20" : "border-zinc-800 bg-zinc-900"}`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${cor === "amber" ? "text-amber-300" : ""}`}>{valor}</div>
    </div>
  );
}

function Tabela({
  titulo, headers, rows,
}: {
  titulo: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
      <p className="px-4 pt-3 text-xs uppercase tracking-wider text-zinc-500">{titulo}</p>
      <table className="mt-2 w-full text-sm">
        <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
          <tr>{headers.map((h) => (<th key={h} className="px-4 py-2">{h}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-800 last:border-0">
              {r.map((c, j) => (<td key={j} className="px-4 py-2">{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
