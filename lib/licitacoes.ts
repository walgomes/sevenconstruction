// Cliente Supabase read-only para puxar licitacoes do SevenLicite.
// Schema: transparencia.licitacoes + transparencia.licitacoes_participantes.
// IMPORTANTE: filtramos por uf da OBRA (campo licitacoes.uf), nao da empresa
// vencedora — o vencedor pode estar em outra UF mas a obra acontece aqui.

import { createClient } from "@supabase/supabase-js";

type Cliente = ReturnType<typeof criar>;
let _client: Cliente | null = null;

function criar() {
  const url = process.env.LICITACOES_SUPABASE_URL;
  const key = process.env.LICITACOES_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("LICITACOES_SUPABASE_URL/ANON_KEY nao configurados");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getClient(): Cliente {
  if (!_client) _client = criar();
  return _client;
}

export type LicitacaoVencida = {
  id_licitacao: string;
  numero_licitacao: string | null;
  ano: number | null;
  modalidade: string | null;
  situacao: string | null;
  objeto: string | null;
  data_abertura: string | null;
  data_resultado: string | null;
  valor_licitacao: number | null;
  nome_orgao: string | null;
  uf: string | null;
  municipio: string | null;
  // do vencedor (1 por licitacao normalmente):
  vencedor_cnpj: string | null;
  vencedor_nome: string | null;
  vencedor_valor: number | null;
};

export type FiltroLicitacoes = {
  uf: string;                        // OBRIGATORIO — UF da obra
  desde?: string;                    // ISO date, default 30d atras
  termo?: string;                    // busca em objeto
  modalidades?: string[];            // pregao, concorrencia, etc
  limite?: number;                   // default 100
};

/**
 * Busca licitacoes vencidas no Estado X nos ultimos N dias (default 30).
 * Junta cada licitacao com o seu vencedor (participantes vencedor=true).
 */
export async function buscarLicitacoesVencidasPorUf(
  filtro: FiltroLicitacoes,
): Promise<LicitacaoVencida[]> {
  const cli = getClient();
  const limite = Math.min(Math.max(filtro.limite ?? 100, 1), 500);
  const desde = filtro.desde ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ESTRATEGIA (descoberta 2026-05-05):
  // Supabase do SevenLicite tem statement_timeout muito apertado. Combinar
  // WHERE uf + qualquer outro filtro indexado (data_abertura, ano) ou um
  // ORDER BY estoura. SO uf=X funciona (~500ms).
  //
  // Por isso pegamos 1000 linhas SO com uf no banco e filtramos data/termo/
  // modalidade no JS. Mais payload mas funciona.
  // Supabase SevenLicite tem statement_timeout muito apertado. Limite 30 com
  // colunas minimas é o que cabe.
  const POOL_DB = Math.min(limite * 2, 50);
  const { data: licitsRaw, error } = await cli
    .schema("transparencia")
    .from("licitacoes")
    .select(
      "id_licitacao, modalidade, objeto, data_abertura, valor_licitacao, nome_orgao, uf, municipio",
    )
    .eq("uf", filtro.uf.toUpperCase())
    .limit(POOL_DB);

  // Filtros aplicados em memoria
  let licits = licitsRaw ?? [];
  if (filtro.termo) {
    const t = filtro.termo.toLowerCase();
    licits = licits.filter((l) => (l.objeto || "").toLowerCase().includes(t));
  }
  if (filtro.modalidades && filtro.modalidades.length) {
    const set = new Set(filtro.modalidades);
    licits = licits.filter((l) => l.modalidade && set.has(l.modalidade));
  }
  if (desde) {
    licits = licits.filter((l) => (l.data_abertura || "9999") >= desde);
  }
  // Ordena por data_abertura desc
  licits.sort((a, b) => (b.data_abertura || "").localeCompare(a.data_abertura || ""));
  // Aplica limite final do filtro
  licits = licits.slice(0, limite);
  if (error) {
    console.error("[licitacoes] erro buscar:", error.message);
    throw new Error(`Falha ao buscar licitacoes: ${error.message}`);
  }
  if (!licits || licits.length === 0) return [];

  // 2) Pega participantes vencedores em batch
  const ids = licits.map((l) => l.id_licitacao);
  const { data: vencedores, error: e2 } = await cli
    .schema("transparencia")
    .from("licitacoes_participantes")
    .select("id_licitacao, cnpj, nome, valor_proposto")
    .in("id_licitacao", ids)
    .eq("vencedor", true);

  if (e2) {
    console.error("[licitacoes] erro vencedores:", e2.message);
    // Nao trava — retorna licitacoes sem vencedor
  }

  const mapaVencedor = new Map<string, {
    cnpj: string | null; nome: string | null; valor: number | null;
  }>();
  for (const v of vencedores ?? []) {
    mapaVencedor.set(v.id_licitacao, {
      cnpj: v.cnpj,
      nome: v.nome,
      valor: v.valor_proposto,
    });
  }

  const resultado = licits.map((l) => {
    const v = mapaVencedor.get(l.id_licitacao);
    return {
      id_licitacao: l.id_licitacao,
      numero_licitacao: null,
      ano: null,
      modalidade: l.modalidade,
      situacao: null,
      objeto: l.objeto,
      data_abertura: l.data_abertura,
      data_resultado: null,
      valor_licitacao: l.valor_licitacao,
      nome_orgao: l.nome_orgao,
      uf: l.uf,
      municipio: l.municipio,
      vencedor_cnpj: v?.cnpj ?? null,
      vencedor_nome: v?.nome ?? null,
      vencedor_valor: v?.valor ?? null,
    };
  });
  return resultado;
}

/**
 * Enriquece os vencedores com telefone/email vindo da empresas (RFB) local.
 * Faz lookup em batch com 1 query.
 */
export async function enriquecerVencedoresComContato(
  licitacoes: LicitacaoVencida[],
): Promise<(LicitacaoVencida & {
  vencedor_telefone: string | null;
  vencedor_email: string | null;
})[]> {
  const { rfbQuery } = await import("@/lib/rfb-db");
  const cnpjs = licitacoes
    .map((l) => l.vencedor_cnpj)
    .filter((c): c is string => !!c);

  if (cnpjs.length === 0) {
    return licitacoes.map((l) => ({
      ...l,
      vencedor_telefone: null,
      vencedor_email: null,
    }));
  }

  type Contato = { cnpj: string; ddd1: string | null; telefone1: string | null; email: string | null };
  const rows = await rfbQuery<Contato>(
    `SELECT cnpj, ddd1, telefone1, email
       FROM empresas
      WHERE cnpj = ANY($1::text[])`,
    [cnpjs],
  );

  const mapa = new Map<string, Contato>();
  for (const r of rows) mapa.set(r.cnpj, r);

  return licitacoes.map((l) => {
    const c = l.vencedor_cnpj ? mapa.get(l.vencedor_cnpj) : null;
    return {
      ...l,
      vencedor_telefone: c?.telefone1
        ? `(${c.ddd1 ?? ""}) ${c.telefone1}`.trim()
        : null,
      vencedor_email: c?.email ?? null,
    };
  });
}
