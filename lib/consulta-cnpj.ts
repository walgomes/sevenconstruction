// Consulta completa de um CNPJ: dados RFB + sócios + cruzamento + compliance.
// Reusa role sc_reader (read-only) em sevendb (consultTudo).

import { rfbQuery } from "@/lib/rfb-db";

export type DadosEmpresa = {
  cnpj: string;
  cnpj_formatado: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: number | null;
  situacao_label: string;
  data_abertura: string | null;
  cnae_fiscal: string | null;
  cnae_descricao: string | null;
  cnae_secundarios: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  ddd1: string | null;
  telefone1: string | null;
  email: string | null;
  porte: number | null;
  porte_label: string;
  capital_social: number | null;
  natureza_jur: string | null;
};

export type Socio = {
  cnpj_cpf_socio: string;
  nome_socio: string | null;
  qualif_socio: string | null;
  data_entrada: string | null;
};

export type EmpresaSocio = {
  cnpj: string;
  razao_social: string | null;
  cnae_fiscal: string | null;
  uf: string | null;
  municipio: string | null;
};

export type Compliance = {
  cadin: { presente: boolean; total: number };
  pgfn: { presente: boolean; total: number; valor_devido: number | null };
};

function formatCnpj(cnpj: string) {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function porteLabel(p: number | null): string {
  switch (p) {
    case 2: return "ME";
    case 3: return "EPP";
    case 5: return "Médio/Grande";
    default: return "Não informado";
  }
}

function situacaoLabel(s: number | null): string {
  switch (s) {
    case 1: return "NULA";
    case 2: return "ATIVA";
    case 3: return "SUSPENSA";
    case 4: return "INAPTA";
    case 8: return "BAIXADA";
    default: return "—";
  }
}

export async function buscarDadosEmpresa(cnpj: string): Promise<DadosEmpresa | null> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return null;

  const rows = await rfbQuery<DadosEmpresa & {
    situacao: number | null;
    porte: number | null;
  }>(
    `SELECT cnpj, razao_social, nome_fantasia, situacao, data_abertura::text,
            cnae_fiscal, cnae_descricao, cnae_secundarios,
            municipio, uf, cep, bairro, logradouro, numero,
            ddd1, telefone1, email,
            porte, capital_social::float AS capital_social, natureza_jur
       FROM empresas
      WHERE cnpj = $1
      LIMIT 1`,
    [limpo],
  );
  const e = rows[0];
  if (!e) return null;
  return {
    ...e,
    cnpj_formatado: formatCnpj(e.cnpj),
    situacao_label: situacaoLabel(e.situacao),
    porte_label: porteLabel(e.porte),
  };
}

export async function buscarSocios(cnpj: string): Promise<Socio[]> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return [];
  return rfbQuery<Socio>(
    `SELECT cnpj_cpf_socio, nome_socio, qualif_socio, data_entrada::text
       FROM socios
      WHERE cnpj = $1
      ORDER BY data_entrada DESC NULLS LAST
      LIMIT 50`,
    [limpo],
  );
}

/**
 * Cruzamento: dado um sócio (CPF/CNPJ), retorna OUTRAS empresas em que ele aparece.
 */
export async function buscarEmpresasDoSocio(
  cpf_cnpj_socio: string,
  excluir_cnpj?: string,
): Promise<EmpresaSocio[]> {
  const limpo = cpf_cnpj_socio.replace(/\D/g, "");
  if (limpo.length < 11) return [];
  const excluir = (excluir_cnpj || "").replace(/\D/g, "");

  // Primeiro acha CNPJs onde esse socio aparece
  const cnpjs = await rfbQuery<{ cnpj: string }>(
    `SELECT DISTINCT cnpj
       FROM socios
      WHERE cnpj_cpf_socio = $1
        ${excluir ? "AND cnpj <> $2" : ""}
      LIMIT 25`,
    excluir ? [limpo, excluir] : [limpo],
  );
  if (cnpjs.length === 0) return [];

  // Carrega dados resumidos
  return rfbQuery<EmpresaSocio>(
    `SELECT cnpj, razao_social, cnae_fiscal, uf, municipio
       FROM empresas
      WHERE cnpj = ANY($1::text[])
      LIMIT 25`,
    [cnpjs.map((r) => r.cnpj)],
  );
}

export async function lerCompliance(cnpj: string): Promise<Compliance> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) {
    return {
      cadin: { presente: false, total: 0 },
      pgfn: { presente: false, total: 0, valor_devido: null },
    };
  }

  const cadinRows = await rfbQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM compliance_cadin WHERE cnpj = $1`,
    [limpo],
  ).catch(() => [{ n: 0 }]);

  const pgfnRows = await rfbQuery<{ n: number; total: number | null }>(
    `SELECT COUNT(*)::int AS n, SUM(valor)::float AS total
       FROM compliance_pgfn WHERE cnpj = $1`,
    [limpo],
  ).catch(() => [{ n: 0, total: null }]);

  return {
    cadin: { presente: (cadinRows[0]?.n ?? 0) > 0, total: cadinRows[0]?.n ?? 0 },
    pgfn: {
      presente: (pgfnRows[0]?.n ?? 0) > 0,
      total: pgfnRows[0]?.n ?? 0,
      valor_devido: pgfnRows[0]?.total ?? null,
    },
  };
}
