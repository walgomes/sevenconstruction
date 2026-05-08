import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { lerSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login?redirect=/admin");
  if (sessao.role !== "super") redirect("/loja");

  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-zinc-100">
              <span className="inline-block h-6 w-6 rounded bg-rose-500" />
              <span className="font-semibold">
                Seven<span className="text-rose-400">Construction</span>
              </span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="rounded bg-rose-950/60 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-rose-300">
              admin
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/admin" className="rounded px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
              Início
            </Link>
            <Link href="/admin/parceiros" className="rounded px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
              Parceiros
            </Link>
            <Link href="/admin/skus" className="rounded px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
              Catálogo
            </Link>
            <Link href="/admin/credito-parceiros" className="rounded px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
              FIDC
            </Link>
            <form action="/api/auth/logout" method="POST" className="ml-2">
              <button className="rounded px-3 py-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}
