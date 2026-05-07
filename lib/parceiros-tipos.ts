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
