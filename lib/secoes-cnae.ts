// CNAE 2.3 — 21 secoes (A a U), cada uma com range de divisao (cnae_fiscal[0:2]).
// Usado pelo modulo /loja/empresas-brasileiras pra listar empresas por setor.

export type CodigoSecao =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U";

export interface SecaoCnae {
  codigo: CodigoSecao;
  nome: string;
  slug: string;
  icone: string;
  divisoes: number[]; // numeros de divisao (1-99) — ex: A = [1,2,3]
}

export const SECOES_CNAE: SecaoCnae[] = [
  { codigo: "A", nome: "Agricultura, pecuária, produção florestal, pesca e aquicultura", slug: "agro", icone: "🌾", divisoes: [1, 2, 3] },
  { codigo: "B", nome: "Indústrias extrativas", slug: "industrias-extrativas", icone: "⛏️", divisoes: [5, 6, 7, 8, 9] },
  { codigo: "C", nome: "Indústrias de transformação", slug: "industrias-transformacao", icone: "🏭", divisoes: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33] },
  { codigo: "D", nome: "Eletricidade e gás", slug: "eletricidade-gas", icone: "⚡", divisoes: [35] },
  { codigo: "E", nome: "Água, esgoto, atividades de gestão de resíduos e descontaminação", slug: "agua-esgoto-residuos", icone: "💧", divisoes: [36, 37, 38, 39] },
  { codigo: "F", nome: "Construção", slug: "construcao", icone: "🏗️", divisoes: [41, 42, 43] },
  { codigo: "G", nome: "Comércio; reparação de veículos automotores e motocicletas", slug: "comercio-reparacao", icone: "🛒", divisoes: [45, 46, 47] },
  { codigo: "H", nome: "Transporte, armazenagem e correio", slug: "transporte-armazenagem", icone: "🚚", divisoes: [49, 50, 51, 52, 53] },
  { codigo: "I", nome: "Alojamento e alimentação", slug: "alojamento-alimentacao", icone: "🍴", divisoes: [55, 56] },
  { codigo: "J", nome: "Informação e comunicação", slug: "informacao-comunicacao", icone: "📡", divisoes: [58, 59, 60, 61, 62, 63] },
  { codigo: "K", nome: "Atividades financeiras, de seguros e serviços relacionados", slug: "financeiras-seguros", icone: "🏦", divisoes: [64, 65, 66] },
  { codigo: "L", nome: "Atividades imobiliárias", slug: "imobiliarias", icone: "🏠", divisoes: [68] },
  { codigo: "M", nome: "Atividades profissionais, científicas e técnicas", slug: "profissionais-cientificas", icone: "🔬", divisoes: [69, 70, 71, 72, 73, 74, 75] },
  { codigo: "N", nome: "Atividades administrativas e serviços complementares", slug: "administrativas", icone: "📋", divisoes: [77, 78, 79, 80, 81, 82] },
  { codigo: "O", nome: "Administração pública, defesa e seguridade social", slug: "administracao-publica", icone: "🏛️", divisoes: [84] },
  { codigo: "P", nome: "Educação", slug: "educacao", icone: "🎓", divisoes: [85] },
  { codigo: "Q", nome: "Saúde humana e serviços sociais", slug: "saude-social", icone: "🩺", divisoes: [86, 87, 88] },
  { codigo: "R", nome: "Artes, cultura, esporte e recreação", slug: "artes-cultura-esporte", icone: "🎨", divisoes: [90, 91, 92, 93] },
  { codigo: "S", nome: "Outras atividades de serviços", slug: "outras-servicos", icone: "🔧", divisoes: [94, 95, 96] },
  { codigo: "T", nome: "Serviços domésticos", slug: "servicos-domesticos", icone: "🧹", divisoes: [97] },
  { codigo: "U", nome: "Organismos internacionais e outras instituições extraterritoriais", slug: "organismos-internacionais", icone: "🌐", divisoes: [99] },
];

export function buscarSecaoPorSlug(slug: string): SecaoCnae | undefined {
  return SECOES_CNAE.find((s) => s.slug === slug);
}

export function divisoesDaSecao(secao: CodigoSecao): number[] {
  return SECOES_CNAE.find((s) => s.codigo === secao)?.divisoes ?? [];
}

// Tipos de ranking disponiveis dentro de cada secao
export interface RankingTipo {
  slug: string;
  rotulo: string;
  uf?: string;
  porte?: number;
  ordem: "capital_desc" | "abertura_desc";
}

const PRINCIPAIS_UFS = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "GO", "PE", "DF"];

export function rankingsDaSecao(_secao: CodigoSecao): RankingTipo[] {
  const lista: RankingTipo[] = [
    { slug: "top-brasil", rotulo: "Top 200 Brasil (por capital social)", ordem: "capital_desc" },
    { slug: "novas", rotulo: "100 mais recentes (abertas há menos)", ordem: "abertura_desc" },
    { slug: "top-grande", rotulo: "Top 100 Grande Porte", porte: 5, ordem: "capital_desc" },
    { slug: "top-medio", rotulo: "Top 100 Médio Porte", porte: 5, ordem: "capital_desc" },
    { slug: "top-epp",   rotulo: "Top 100 EPP",         porte: 3, ordem: "capital_desc" },
    { slug: "top-me",    rotulo: "Top 100 ME",          porte: 2, ordem: "capital_desc" },
  ];
  for (const uf of PRINCIPAIS_UFS) {
    lista.push({ slug: `uf-${uf.toLowerCase()}`, rotulo: `Top 100 ${uf}`, uf, ordem: "capital_desc" });
  }
  return lista;
}

export function rankingPorSlug(secao: CodigoSecao, slug: string): RankingTipo | undefined {
  return rankingsDaSecao(secao).find((r) => r.slug === slug);
}
