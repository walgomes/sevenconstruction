import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import pool from "@/lib/db";
import TileAdmin from "./TileAdmin";

export const dynamic = "force-dynamic";

export default async function PainelLoja() {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  // Decide qual loja exibir + se mostra o tile Admin.
  // - loja_user: usa sua propria loja; tile Admin so aparece se email tem
  //   conta super_admins ativa (defesa em profundidade visual).
  // - super: usa primeira loja ativa pra demo; tile Admin sempre visivel
  //   (e sem modal — leva direto pra /admin porque ja esta logado como super).
  let lojaIdRef: number | null = null;
  let podeVerTileAdmin = false;
  let superJaLogado = false;

  if (sessao.role === "loja_user" && sessao.loja_id) {
    lojaIdRef = sessao.loja_id;
    const ehAdmin = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sevenconstruction.super_admins sa
         JOIN sevenconstruction.loja_users lu ON LOWER(lu.email) = LOWER(sa.email)
         WHERE lu.id = $1 AND sa.ativo
       ) AS existe`,
      [sessao.id],
    );
    podeVerTileAdmin = ehAdmin.rows[0]?.existe ?? false;
  } else if (sessao.role === "super") {
    const lr = await pool.query<{ id: number }>(
      `SELECT id FROM sevenconstruction.lojas WHERE ativo ORDER BY id ASC LIMIT 1`,
    );
    lojaIdRef = lr.rows[0]?.id ?? null;
    podeVerTileAdmin = true;
    superJaLogado = true;
  } else {
    redirect("/login");
  }

  if (!lojaIdRef) redirect("/login");

  const r = await pool.query(
    `SELECT loja_id, nome_fantasia, cidade, uf, plano,
            clientes_ativos, clientes_verdes, usuarios_ativos, listas_prospec
       FROM sevenconstruction.v_loja_resumo
      WHERE loja_id = $1`,
    [lojaIdRef],
  );
  const resumo = r.rows[0] || {
    nome_fantasia: "Sua loja",
    cidade: "—",
    uf: "—",
    plano: "starter",
    clientes_ativos: 0,
    clientes_verdes: 0,
    usuarios_ativos: 1,
    listas_prospec: 0,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">
            Painel da loja
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{resumo.nome_fantasia}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {resumo.cidade} / {resumo.uf} — plano{" "}
            <span className="font-medium text-zinc-200">{resumo.plano}</span>
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Clientes ativos" valor={resumo.clientes_ativos} />
        <Stat label="Rating verde" valor={resumo.clientes_verdes} />
        <Stat label="Usuários" valor={resumo.usuarios_ativos} />
        <Stat label="Listas de prospecção" valor={resumo.listas_prospec} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <TileLink href="/loja/clientes-base" titulo="Base de clientes da loja" status="ativo" />
          <TileLink href="/loja/catalogo-servicos" titulo="Catálogo de serviços digitais" status="ativo" />
          <TileLink href="/loja/comissoes" titulo="Comissões (receita)" status="ativo" />
          <TileLink href="/loja/prospec" titulo="Prospecção (CNPJ + nome + CNAE)" status="ativo" />
          <TileLink href="/loja/licitacoes-estado" titulo="Licitações no meu Estado" status="ativo" />
          <TileLink href="/loja/profissionais" titulo="Time de profissionais (indicação)" status="ativo" />
          <TileLink href="/loja/consulta-cnpj" titulo="Consulta CNPJ + sócios + compliance" status="ativo" />
          <TileLink href="/loja/concierge" titulo="Concierge — emitir certidões" status="ativo" />
          <TileLink href="/loja/relatorios" titulo="Relatórios mensais (CSV)" status="ativo" />
          <TileLink href="/loja/disparo" titulo="Disparo Email + WhatsApp" status="ativo" />
          <TileLink href="/loja/credito" titulo="Crédito no checkout (FIDC)" status="esqueleto" />
          <TileLink href="/loja/marketplace" titulo="Marketplace lojas parceiras" status="esqueleto" />
          <TileLink href="/loja/revendedores" titulo="Revendedores multi-nível" status="esqueleto" />
          <TileLink href="/loja/rede-b2b" titulo="🌐 Rede B2B (matches + conversas)" status="ativo" />
          <TileLink href="/loja/empresas-brasileiras" titulo="🏢 Empresas brasileiras (21 setores)" status="ativo" />
          <TileLink href="/loja/lookalike" titulo="🎯 Lookalike de carteira" status="ativo" />
          <TileLink href="/loja/fidelizacao" titulo="🎁 Fidelização (Clube de pontos)" status="ativo" />
          <TileLink href="/loja/perfil" titulo="⚙️ Editar perfil da loja" status="ativo" />
          {podeVerTileAdmin && <TileAdmin superJaLogado={superJaLogado} />}
        </ul>
      </section>

      <footer className="mt-12 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">
          ← landing pública
        </Link>
      </footer>
    </main>
  );
}

function Stat({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-zinc-100">{valor}</div>
    </div>
  );
}

function Tile({ titulo, status }: { titulo: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <span className="text-sm">{titulo}</span>
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
        {status}
      </span>
    </div>
  );
}

function TileLink({ href, titulo, status }: { href: string; titulo: string; status: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 transition hover:border-amber-500/40 hover:bg-zinc-900"
    >
      <span className="text-sm">{titulo}</span>
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
        {status}
      </span>
    </Link>
  );
}
