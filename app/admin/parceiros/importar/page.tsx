import Link from "next/link";
import ImportarUI from "./ImportarUI";

export const dynamic = "force-dynamic";

export default function ImportarPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin · Parceiros</p>
          <h1 className="mt-1 text-2xl font-semibold">Importar lista</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Origem: <a href="https://guiafornecedoresic.com.br" target="_blank" rel="noreferrer noopener" className="text-rose-300 hover:underline">guiafornecedoresic.com.br</a>{" "}
            (sitemap público com ~361 fornecedores). Selecione o que cadastrar e o tipo a aplicar.
          </p>
        </div>
        <Link href="/admin/parceiros" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Voltar
        </Link>
      </header>

      <ImportarUI />
    </main>
  );
}
