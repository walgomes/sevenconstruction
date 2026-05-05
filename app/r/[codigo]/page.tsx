// Pagina publica de revendedor: /r/CODIGO-DA-LOJA-XXXX
// Setta cookie sc_ref que rastreia origem da indicacao por 30 dias.
// Redirect pra landing principal mostrando msg de boas-vindas.

import Link from "next/link";
import { cookies } from "next/headers";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const COOKIE_REF = "sc_ref";
const COOKIE_REF_DIAS = 30;

export default async function RevendedorLanding({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const codigoLimpo = codigo.trim().toUpperCase().slice(0, 50);

  // Busca revendedor (procura em revendedor + profissionais)
  const revendedor = await buscarPorCodigo(codigoLimpo);

  if (!revendedor) {
    return <PaginaInvalida codigo={codigoLimpo} />;
  }

  // Set cookie de tracking
  const c = await cookies();
  c.set(COOKIE_REF, JSON.stringify({
    codigo: codigoLimpo,
    loja_id: revendedor.loja_id,
    tipo: revendedor.tipo,
    set_em: Date.now(),
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_REF_DIAS * 24 * 60 * 60,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <span className="inline-block h-16 w-16 rounded-2xl bg-amber-500" />
      <h1 className="mt-6 text-3xl font-bold">
        Você foi indicado por <span className="text-amber-400">{revendedor.nome}</span>
      </h1>
      <p className="mt-4 max-w-lg text-zinc-400">
        {revendedor.tipo === "profissional"
          ? `Você está sendo recomendado por um profissional parceiro da loja ${revendedor.loja_nome}.`
          : `Boas-vindas! Você está chegando por indicação de um revendedor da rede ${revendedor.loja_nome}.`}
      </p>

      <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 px-6 py-4">
        <p className="text-sm text-zinc-300">
          Loja:{" "}
          <strong className="text-amber-300">{revendedor.loja_nome}</strong>
          {revendedor.loja_cidade ? ` · ${revendedor.loja_cidade}/${revendedor.loja_uf}` : ""}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Sua compra ou serviço usado nessa loja vai render comissão automática para quem te indicou.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-amber-500 px-5 py-3 font-medium text-zinc-950 hover:bg-amber-400"
        >
          Continuar
        </Link>
        <Link
          href="/termos"
          target="_blank"
          className="rounded-md border border-zinc-700 px-5 py-3 text-zinc-300 hover:bg-zinc-900"
        >
          Termos de uso
        </Link>
      </div>

      <p className="mt-12 text-xs text-zinc-600">
        Sua visita foi registrada por 30 dias. Você pode limpar isso a qualquer momento
        nas configurações do navegador.
      </p>
    </main>
  );
}

type RevendedorMatch = {
  loja_id: number;
  loja_nome: string;
  loja_cidade: string | null;
  loja_uf: string | null;
  nome: string;
  tipo: "profissional" | "revendedor";
};

async function buscarPorCodigo(codigo: string): Promise<RevendedorMatch | null> {
  // 1) Tenta na tabela profissionais (codigo_indicacao)
  const p = await pool.query(
    `SELECT p.nome, p.loja_id, l.nome_fantasia AS loja_nome, l.cidade, l.uf
       FROM sevenconstruction.profissionais p
       JOIN sevenconstruction.lojas l ON l.id = p.loja_id
      WHERE p.codigo_indicacao = $1 AND p.ativo = TRUE AND l.ativo = TRUE
      LIMIT 1`,
    [codigo],
  );
  if (p.rows[0]) {
    return {
      loja_id: p.rows[0].loja_id,
      loja_nome: p.rows[0].loja_nome,
      loja_cidade: p.rows[0].cidade,
      loja_uf: p.rows[0].uf,
      nome: p.rows[0].nome,
      tipo: "profissional",
    };
  }

  // 2) Tenta na tabela revendedor
  const r = await pool.query(
    `SELECT r.nome, r.loja_id, l.nome_fantasia AS loja_nome, l.cidade, l.uf
       FROM sevenconstruction.revendedor r
       JOIN sevenconstruction.lojas l ON l.id = r.loja_id
      WHERE r.codigo = $1 AND r.ativo = TRUE AND l.ativo = TRUE
      LIMIT 1`,
    [codigo],
  );
  if (r.rows[0]) {
    return {
      loja_id: r.rows[0].loja_id,
      loja_nome: r.rows[0].loja_nome,
      loja_cidade: r.rows[0].cidade,
      loja_uf: r.rows[0].uf,
      nome: r.rows[0].nome,
      tipo: "revendedor",
    };
  }

  return null;
}

function PaginaInvalida({ codigo }: { codigo: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <span className="text-5xl">🔗</span>
      <h1 className="mt-4 text-2xl font-semibold">Link não encontrado</h1>
      <p className="mt-2 text-sm text-zinc-400">
        O código <code className="rounded bg-zinc-800 px-1 font-mono">{codigo}</code> não corresponde
        a um revendedor ou profissional ativo.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
      >
        Ir para a página inicial
      </Link>
    </main>
  );
}
