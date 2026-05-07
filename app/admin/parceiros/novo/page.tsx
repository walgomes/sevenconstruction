import Link from "next/link";
import FormNovoParceiro from "./FormNovoParceiro";

export const dynamic = "force-dynamic";

export default function NovoParceiroPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin · Parceiros</p>
          <h1 className="mt-1 text-2xl font-semibold">Novo parceiro</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Código será gerado automaticamente (próximo da sequência ≥ 150.000).
          </p>
        </div>
        <Link href="/admin/parceiros" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Voltar
        </Link>
      </header>

      <FormNovoParceiro />
    </main>
  );
}
