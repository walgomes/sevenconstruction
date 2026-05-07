// Tipos e constantes da feature Parceiros — SAFE PRA CLIENT.
// Nao importa pool/pg — pode ser usado em "use client" components.

export type TipoParceiro = "fabrica" | "importador" | "distribuidor" | "lojista" | "outros";

export const TIPOS_PARCEIRO: { valor: TipoParceiro; rotulo: string; cor: string }[] = [
  { valor: "fabrica",      rotulo: "Fábrica",      cor: "bg-blue-100 text-blue-700" },
  { valor: "importador",   rotulo: "Importador",   cor: "bg-purple-100 text-purple-700" },
  { valor: "distribuidor", rotulo: "Distribuidor", cor: "bg-emerald-100 text-emerald-700" },
  { valor: "lojista",      rotulo: "Lojista",      cor: "bg-amber-100 text-amber-700" },
  { valor: "outros",       rotulo: "Outros",       cor: "bg-zinc-100 text-zinc-700" },
];

export type FaseHomolog =
  | "solicitacao"
  | "pre_check"
  | "analises"
  | "consolidacao"
  | "decisao"
  | "homologado"
  | "reprovado";

export const FASES_HOMOLOG: { valor: FaseHomolog; rotulo: string; cor: string; ordem: number }[] = [
  { valor: "solicitacao",  rotulo: "Solicitação",       cor: "bg-zinc-100 text-zinc-700",      ordem: 0 },
  { valor: "pre_check",    rotulo: "Pré-checagem",      cor: "bg-sky-100 text-sky-700",        ordem: 1 },
  { valor: "analises",     rotulo: "Análises paralelas", cor: "bg-indigo-100 text-indigo-700", ordem: 2 },
  { valor: "consolidacao", rotulo: "Consolidação",      cor: "bg-violet-100 text-violet-700",  ordem: 3 },
  { valor: "decisao",      rotulo: "Decisão",           cor: "bg-amber-100 text-amber-700",    ordem: 4 },
  { valor: "homologado",   rotulo: "Homologado",        cor: "bg-emerald-100 text-emerald-700",ordem: 5 },
  { valor: "reprovado",    rotulo: "Reprovado",         cor: "bg-rose-100 text-rose-700",      ordem: 6 },
];

export type RiscoInicial = "baixo" | "medio" | "alto";
export type RecomendacaoIA = "aprovar" | "revisar" | "reprovar";

export type ParecerJson = Record<string, unknown> | null;

export type Parceiro = {
  id: number;
  codigo: number;
  tipo: TipoParceiro;
  razao_social: string | null;
  nome_fantasia: string;
  cnpj: string | null;
  cnae_principal: string | null;
  uf: string | null;
  cidade: string | null;
  endereco: string | null;
  cep: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  logo_url: string | null;
  notas: string | null;
  origem: string | null;
  origem_url: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  produtos?: string[];
  // SRM
  fase_homolog: FaseHomolog;
  trust_score: number | null;
  risco_inicial: RiscoInicial | null;
  parecer_compliance: ParecerJson;
  parecer_finance: ParecerJson;
  parecer_operacional: ParecerJson;
  parecer_legal: ParecerJson;
  recomendacao_ia: RecomendacaoIA | null;
  recomendacao_motivo: string | null;
  homologado_em: string | null;
  ultima_analise_em: string | null;
};

export type ParceirosKpis = {
  total: number;
  fabrica: number;
  importador: number;
  distribuidor: number;
  lojista: number;
  outros: number;
  ativos: number;
  estados: number;
};
