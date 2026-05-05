// Cliente Supabase read-only para puxar licitacoes do SevenLicite.
// Schema: transparencia.licitacoes + transparencia.licitacoes_participantes.
//
// IMPORTANTE: filtramos por uf da OBRA (campo licitacoes.uf), nao da empresa
// vencedora — o vencedor pode estar em outra UF mas a obra acontece aqui.
//
// CACHE LOCAL: o Supabase do SevenLicite (free tier) tem statement_timeout
// muito apertado e variavel. Para nao deixar a feature instavel:
//   1. Toda fetch bem-sucedida grava em sevenconstruction.licitacoes_cache
//   2. Se Supabase timeoutar, lemos do cache local (mesmo se "antigo")
// Resultado: UI consistente. Cache fica fresco quando Supabase responde.

import { createClient } from "@supabase/supabase-js";
import pool from "@/lib/db";

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
  vencedor_cnpj: string | null;
  vencedor_nome: string | null;
  vencedor_valor: number | null;
};

export type LicitacaoEnriquecida = LicitacaoVencida & {
  vencedor_telefone: string | null;
  vencedor_email: string | null;
};

export type FiltroLicitacoes = {
  uf: string;
  desde?: string;
  termo?: string;
  modalidades?: string[];
  limite?: number;
};

export type ResultadoBusca = {
  fonte: "supabase" | "cache" | "cache_fallback";
  cache_idade_h: number | null;
  licitacoes: LicitacaoEnriquecida[];
};

async function buscarDoSupabase(filtro: FiltroLicitacoes): Promise<LicitacaoVencida[]> {
  const cli = getClient();
  const limite = Math.min(Math.max(filtro.limite ?? 100, 1), 200);
  // POOL_DB pequeno pra nao estourar statement_timeout
  const POOL_DB = Math.min(limite * 2, 50);

  const { data: licitsRaw, error } = await cli
    .schema("transparencia")
    .from("licitacoes")
    .select(
      "id_licitacao, modalidade, objeto, data_abertura, valor_licitacao, nome_orgao, uf, municipio",
    )
    .eq("uf", filtro.uf.toUpperCase())
    .limit(POOL_DB);

  if (error) throw new Error(error.message);

  let licits = licitsRaw ?? [];

  // Filtros aplicados em memoria (Supabase nao consegue combinar com timeout apertado)
  if (filtro.termo) {
    const t = filtro.termo.toLowerCase();
    licits = licits.filter((l) => (l.objeto || "").toLowerCase().includes(t));
  }
  if (filtro.modalidades && filtro.modalidades.length) {
    const set = new Set(filtro.modalidades);
    licits = licits.filter((l) => l.modalidade && set.has(l.modalidade));
  }
  const desde = filtro.desde;
  if (desde) {
    licits = licits.filter((l) => (l.data_abertura || "9999") >= desde);
  }
  licits.sort((a, b) => (b.data_abertura || "").localeCompare(a.data_abertura || ""));
  licits = licits.slice(0, limite);

  if (licits.length === 0) return [];

  // Vencedores
  const ids = licits.map((l) => l.id_licitacao);
  const { data: vencedores } = await cli
    .schema("transparencia")
    .from("licitacoes_participantes")
    .select("id_licitacao, cnpj, nome, valor_proposto")
    .in("id_licitacao", ids)
    .eq("vencedor", true);

  const mapaV = new Map<string, { cnpj: string | null; nome: string | null; valor: number | null }>();
  for (const v of vencedores ?? []) {
    mapaV.set(v.id_licitacao, { cnpj: v.cnpj, nome: v.nome, valor: v.valor_proposto });
  }

  return licits.map((l) => {
    const v = mapaV.get(l.id_licitacao);
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
}

async function enriquecerComContato(
  licits: LicitacaoVencida[],
): Promise<LicitacaoEnriquecida[]> {
  const cnpjs = licits.map((l) => l.vencedor_cnpj).filter((c): c is string => !!c);
  if (!cnpjs.length) {
    return licits.map((l) => ({ ...l, vencedor_telefone: null, vencedor_email: null }));
  }
  const { rfbQuery } = await import("@/lib/rfb-db");
  type Contato = { cnpj: string; ddd1: string | null; telefone1: string | null; email: string | null };
  let rows: Contato[] = [];
  try {
    rows = await rfbQuery<Contato>(
      `SELECT cnpj, ddd1, telefone1, email FROM empresas WHERE cnpj = ANY($1::text[])`,
      [cnpjs],
    );
  } catch {
    // RFB pode estar lento (backfill). Sem enriquecimento — nao quebra.
  }
  const mapa = new Map<string, Contato>();
  for (const r of rows) mapa.set(r.cnpj, r);
  return licits.map((l) => {
    const c = l.vencedor_cnpj ? mapa.get(l.vencedor_cnpj) : null;
    return {
      ...l,
      vencedor_telefone: c?.telefone1 ? `(${c.ddd1 ?? ""}) ${c.telefone1}`.trim() : null,
      vencedor_email: c?.email ?? null,
    };
  });
}

async function gravarNoCache(licits: LicitacaoEnriquecida[]): Promise<void> {
  if (licits.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const valores = licits.map((l) => [
      l.id_licitacao,
      l.numero_licitacao,
      l.ano,
      l.modalidade,
      l.situacao,
      l.objeto,
      l.data_abertura,
      l.data_resultado,
      l.valor_licitacao,
      l.nome_orgao,
      l.uf,
      l.municipio,
      l.vencedor_cnpj,
      l.vencedor_nome,
      l.vencedor_valor,
      l.vencedor_telefone,
      l.vencedor_email,
    ]);
    // Upsert via UNNEST
    await client.query(
      `INSERT INTO sevenconstruction.licitacoes_cache
         (id_licitacao, numero_licitacao, ano, modalidade, situacao, objeto,
          data_abertura, data_resultado, valor_licitacao, nome_orgao, uf, municipio,
          vencedor_cnpj, vencedor_nome, vencedor_valor, vencedor_telefone, vencedor_email,
          cached_em)
       SELECT u.id_licitacao, u.numero_licitacao, u.ano, u.modalidade, u.situacao, u.objeto,
              u.data_abertura::date, u.data_resultado::date, u.valor_licitacao, u.nome_orgao,
              u.uf, u.municipio, u.vencedor_cnpj, u.vencedor_nome, u.vencedor_valor,
              u.vencedor_telefone, u.vencedor_email, NOW()
         FROM UNNEST(
                $1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[],
                $7::text[], $8::text[], $9::numeric[], $10::text[], $11::text[], $12::text[],
                $13::text[], $14::text[], $15::numeric[], $16::text[], $17::text[]
              ) AS u(id_licitacao, numero_licitacao, ano, modalidade, situacao, objeto,
                     data_abertura, data_resultado, valor_licitacao, nome_orgao, uf, municipio,
                     vencedor_cnpj, vencedor_nome, vencedor_valor, vencedor_telefone, vencedor_email)
       ON CONFLICT (id_licitacao) DO UPDATE
         SET modalidade = EXCLUDED.modalidade,
             objeto = EXCLUDED.objeto,
             data_abertura = EXCLUDED.data_abertura,
             valor_licitacao = EXCLUDED.valor_licitacao,
             nome_orgao = EXCLUDED.nome_orgao,
             uf = EXCLUDED.uf,
             municipio = EXCLUDED.municipio,
             vencedor_cnpj = COALESCE(EXCLUDED.vencedor_cnpj, sevenconstruction.licitacoes_cache.vencedor_cnpj),
             vencedor_nome = COALESCE(EXCLUDED.vencedor_nome, sevenconstruction.licitacoes_cache.vencedor_nome),
             vencedor_valor = COALESCE(EXCLUDED.vencedor_valor, sevenconstruction.licitacoes_cache.vencedor_valor),
             vencedor_telefone = COALESCE(EXCLUDED.vencedor_telefone, sevenconstruction.licitacoes_cache.vencedor_telefone),
             vencedor_email = COALESCE(EXCLUDED.vencedor_email, sevenconstruction.licitacoes_cache.vencedor_email),
             cached_em = NOW()`,
      [
        valores.map((v) => v[0]),
        valores.map((v) => v[1]),
        valores.map((v) => v[2]),
        valores.map((v) => v[3]),
        valores.map((v) => v[4]),
        valores.map((v) => v[5]),
        valores.map((v) => v[6]),
        valores.map((v) => v[7]),
        valores.map((v) => v[8]),
        valores.map((v) => v[9]),
        valores.map((v) => v[10]),
        valores.map((v) => v[11]),
        valores.map((v) => v[12]),
        valores.map((v) => v[13]),
        valores.map((v) => v[14]),
        valores.map((v) => v[15]),
        valores.map((v) => v[16]),
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[licitacoes-cache] erro gravar:", e);
  } finally {
    client.release();
  }
}

async function lerDoCache(filtro: FiltroLicitacoes): Promise<{
  licits: LicitacaoEnriquecida[];
  idade_h: number | null;
}> {
  const conds: string[] = ["uf = $1"];
  const params: unknown[] = [filtro.uf.toUpperCase()];

  if (filtro.desde) {
    params.push(filtro.desde);
    conds.push(`(data_abertura IS NULL OR data_abertura >= $${params.length})`);
  }
  if (filtro.termo) {
    params.push(filtro.termo);
    conds.push(`to_tsvector('portuguese', coalesce(objeto, '')) @@ plainto_tsquery('portuguese', $${params.length})`);
  }
  if (filtro.modalidades && filtro.modalidades.length) {
    params.push(filtro.modalidades);
    conds.push(`modalidade = ANY($${params.length}::text[])`);
  }

  const limite = Math.min(Math.max(filtro.limite ?? 100, 1), 500);
  const r = await pool.query(
    `SELECT id_licitacao, numero_licitacao, ano, modalidade, situacao, objeto,
            data_abertura::text, data_resultado::text, valor_licitacao, nome_orgao,
            uf, municipio, vencedor_cnpj, vencedor_nome, vencedor_valor,
            vencedor_telefone, vencedor_email,
            EXTRACT(EPOCH FROM (NOW() - cached_em))/3600 AS idade_h
       FROM sevenconstruction.licitacoes_cache
      WHERE ${conds.join(" AND ")}
      ORDER BY data_abertura DESC NULLS LAST
      LIMIT ${limite}`,
    params,
  );
  const licits = r.rows.map((row) => ({
    id_licitacao: row.id_licitacao,
    numero_licitacao: row.numero_licitacao,
    ano: row.ano,
    modalidade: row.modalidade,
    situacao: row.situacao,
    objeto: row.objeto,
    data_abertura: row.data_abertura,
    data_resultado: row.data_resultado,
    valor_licitacao: row.valor_licitacao != null ? Number(row.valor_licitacao) : null,
    nome_orgao: row.nome_orgao,
    uf: row.uf,
    municipio: row.municipio,
    vencedor_cnpj: row.vencedor_cnpj,
    vencedor_nome: row.vencedor_nome,
    vencedor_valor: row.vencedor_valor != null ? Number(row.vencedor_valor) : null,
    vencedor_telefone: row.vencedor_telefone,
    vencedor_email: row.vencedor_email,
  }));
  const idade_h = r.rows.length > 0 ? Number(r.rows[0].idade_h) : null;
  return { licits, idade_h };
}

/**
 * Estrategia v2: PREFERE cache local (rapido + estavel). Refresca do Supabase
 * em background quando cache esta velho (>24h) — nao bloqueia resposta.
 *
 * - Cache fresco (<24h): retorna do cache, fonte='cache'
 * - Cache velho ou vazio: tenta Supabase em paralelo com timeout curto (5s);
 *   se OK retorna fresh, senao retorna o que tiver no cache
 *
 * O sync proativo (scripts/sync-licitacoes-cache.mjs) deve rodar diariamente
 * pra manter o cache fresco. Cron: 1x ao dia em horario de menor carga.
 */
export async function buscarLicitacoesEnriquecidas(
  filtro: FiltroLicitacoes,
): Promise<ResultadoBusca> {
  // Sempre comeca tentando o cache
  const cached = await lerDoCache(filtro);
  const cacheFresco = cached.idade_h != null && cached.idade_h < 24;

  if (cacheFresco && cached.licits.length > 0) {
    // Cache fresco: retorna direto. Refresca em background se >12h.
    if ((cached.idade_h ?? 0) > 12) {
      refrescarEmBackground(filtro);
    }
    return {
      fonte: "cache",
      cache_idade_h: cached.idade_h,
      licitacoes: cached.licits,
    };
  }

  // Cache velho ou vazio: tenta Supabase com timeout curto
  try {
    const supabaseLicits = await Promise.race([
      buscarDoSupabase(filtro),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout_supabase_5s")), 5000),
      ),
    ]);
    const enriq = await enriquecerComContato(supabaseLicits);
    gravarNoCache(enriq).catch((e) => console.error("[licitacoes] cache write fail", e));
    return { fonte: "supabase", cache_idade_h: 0, licitacoes: enriq };
  } catch (eSupabase) {
    const msg = eSupabase instanceof Error ? eSupabase.message : String(eSupabase);
    console.warn("[licitacoes] Supabase falhou:", msg);
    // Mesmo se cache antigo, vale mais que vazio
    return {
      fonte: "cache_fallback",
      cache_idade_h: cached.idade_h,
      licitacoes: cached.licits,
    };
  }
}

function refrescarEmBackground(filtro: FiltroLicitacoes): void {
  setTimeout(async () => {
    try {
      const fresh = await buscarDoSupabase(filtro);
      const enriq = await enriquecerComContato(fresh);
      await gravarNoCache(enriq);
      console.log(`[licitacoes] cache refrescado em background uf=${filtro.uf} (${enriq.length} rows)`);
    } catch (e) {
      // refresh background nao precisa logar erro toda hora
    }
  }, 0);
}
