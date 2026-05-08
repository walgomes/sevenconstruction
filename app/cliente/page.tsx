import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ erro?: string }>;

export default async function ClienteLanding({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const erro = sp.erro;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-6xl">🎁</span>
      <h1 className="mt-4 text-2xl font-bold text-zinc-100">Meu clube</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Acumule pontos a cada compra, resgate em desconto e indique amigos.
      </p>

      {erro === "token_invalido" && (
        <p className="mt-4 rounded-md border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          Link inválido. Peça um novo pra sua loja.
        </p>
      )}
      {erro === "token_expirado" && (
        <p className="mt-4 rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Link expirado. Peça um novo pra sua loja.
        </p>
      )}
      {!erro && (
        <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
          Você precisa de um link único enviado pela sua loja parceira pra entrar aqui.
        </p>
      )}

      <Link
        href="/"
        className="mt-6 text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← voltar pra landing
      </Link>
    </main>
  );
}
