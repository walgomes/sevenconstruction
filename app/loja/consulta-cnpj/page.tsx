"use client";

import { useState } from "react";

type Resp = {
  ok: boolean;
  motivo?: string;
  empresa?: {
    cnpj_formatado: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    situacao_label: string;
    data_abertura: string | null;
    cnae_fiscal: string | null;
    cnae_descricao: string | null;
    municipio: string | null;
    uf: string | null;
    porte_label: string;
    capital_social: number | null;
    natureza_jur: string | null;
    telefone1: string | null;
    ddd1: string | null;
    email: string | null;
    bairro: string | null;
    logradouro: string | null;
    numero: string | null;
  };
  socios?: {
    cnpj_cpf_socio: string;
    nome_socio: string | null;
    qualif_socio: string | null;
    data_entrada: string | null;
  }[];
  cruzamentos?: {
    socio: { nome_socio: string | null; cnpj_cpf_socio: string };
    empresas: { cnpj: string; razao_social: string | null; uf: string | null; municipio: string | null }[];
  }[];
  compliance?: {
    cadin: { presente: boolean; total: number };
    pgfn: { presente: boolean; total: number; valor_devido: number | null };
  };
};

function fmtBrl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCnpj(s: string) {
  if (s.length !== 14) return s;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

function fmtCpfCnpj(s: string) {
  const limpo = s.replace(/\D/g, "");
  if (limpo.length === 14) return fmtCnpj(limpo);
  if (limpo.length === 11) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
  return s;
}

export default function ConsultaCnpjPage() {
  const [cnpj, setCnpj] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) {
      setErro("CNPJ inválido (14 dígitos)");
      return;
    }
    setCarregando(true);
    setErro(null);
    setData(null);
    try {
      const r = await fetch(`/api/consulta-cnpj?cnpj=${limpo}`);
      const j = (await r.json()) as Resp;
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setData(j);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-amber-400">Consulta</p>
        <h1 className="mt-1 text-3xl font-semibold">CNPJ completo</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Dados RFB + sócios + cruzamento de empresas dos sócios + compliance
          (CADIN/PGFN). Tudo em uma tela só.
        </p>
      </header>

      <form
        onSubmit={buscar}
        className="mt-6 flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      >
        <input
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={carregando}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {carregando ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {data?.empresa && (
        <>
          <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <header className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{data.empresa.razao_social || "—"}</h2>
                {data.empresa.nome_fantasia && (
                  <p className="text-xs text-zinc-500">{data.empresa.nome_fantasia}</p>
                )}
                <p className="mt-1 font-mono text-xs text-amber-300">{data.empresa.cnpj_formatado}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                data.empresa.situacao_label === "ATIVA"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-red-500/10 text-red-300"
              }`}>
                {data.empresa.situacao_label}
              </span>
            </header>
            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
              <Field label="CNAE" valor={`${data.empresa.cnae_fiscal || "—"}`} sub={data.empresa.cnae_descricao || ""} />
              <Field label="Cidade/UF" valor={data.empresa.municipio ? `${data.empresa.municipio}/${data.empresa.uf}` : data.empresa.uf || "—"} />
              <Field label="Porte" valor={data.empresa.porte_label} />
              <Field label="Capital social" valor={fmtBrl(data.empresa.capital_social)} />
              <Field label="Data abertura" valor={data.empresa.data_abertura || "—"} />
              <Field label="Telefone" valor={data.empresa.telefone1 ? `(${data.empresa.ddd1 ?? ""}) ${data.empresa.telefone1}` : "—"} />
              <Field label="Email" valor={data.empresa.email || "—"} />
              <Field label="Endereço" valor={`${data.empresa.logradouro || ""} ${data.empresa.numero || ""}`} sub={data.empresa.bairro || ""} />
              <Field label="Natureza jurídica" valor={data.empresa.natureza_jur || "—"} />
            </div>
          </section>

          {/* Compliance */}
          {data.compliance && (
            <section className="mt-4 grid gap-3 md:grid-cols-2">
              <div className={`rounded-xl border p-5 ${
                data.compliance.cadin.presente
                  ? "border-red-700/40 bg-red-950/20"
                  : "border-emerald-700/40 bg-emerald-950/10"
              }`}>
                <h3 className="font-semibold">
                  CADIN {data.compliance.cadin.presente ? "⚠️" : "✓"}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {data.compliance.cadin.presente
                    ? `${data.compliance.cadin.total} pendência(s) registrada(s)`
                    : "Sem pendências cadastradas"}
                </p>
              </div>
              <div className={`rounded-xl border p-5 ${
                data.compliance.pgfn.presente
                  ? "border-red-700/40 bg-red-950/20"
                  : "border-emerald-700/40 bg-emerald-950/10"
              }`}>
                <h3 className="font-semibold">
                  PGFN (dívida ativa) {data.compliance.pgfn.presente ? "⚠️" : "✓"}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  {data.compliance.pgfn.presente
                    ? `${data.compliance.pgfn.total} dívida(s) — ${fmtBrl(data.compliance.pgfn.valor_devido)}`
                    : "Sem dívida ativa"}
                </p>
              </div>
            </section>
          )}

          {/* Sócios */}
          {data.socios && data.socios.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">{data.socios.length} sócio(s)</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Sócio</th>
                      <th className="px-3 py-2 text-left">CPF/CNPJ</th>
                      <th className="px-3 py-2 text-left">Qualificação</th>
                      <th className="px-3 py-2 text-left">Entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.socios.map((s, i) => (
                      <tr key={i} className="border-b border-zinc-800 last:border-0">
                        <td className="px-3 py-2 font-medium">{s.nome_socio || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{fmtCpfCnpj(s.cnpj_cpf_socio)}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400">{s.qualif_socio || "—"}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400">{s.data_entrada || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Cruzamento: outras empresas dos sócios */}
          {data.cruzamentos && data.cruzamentos.some((c) => c.empresas.length > 0) && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">Outras empresas dos sócios (cruzamento)</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Análise de risco: identifica grupo econômico e empresas ligadas pelos mesmos sócios.
              </p>
              <ul className="mt-3 space-y-3">
                {data.cruzamentos.filter((c) => c.empresas.length > 0).map((c, i) => (
                  <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <p className="text-sm font-medium">
                      {c.socio.nome_socio || "(sem nome)"}{" "}
                      <span className="text-xs text-zinc-500">aparece em {c.empresas.length} outras empresas:</span>
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {c.empresas.map((e) => (
                        <li key={e.cnpj} className="flex justify-between gap-3">
                          <span className="font-mono text-zinc-400">{fmtCnpj(e.cnpj)}</span>
                          <span className="flex-1 truncate">{e.razao_social || "—"}</span>
                          <span className="text-zinc-500">{e.municipio || ""}/{e.uf || ""}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Field({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 font-medium">{valor}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}
