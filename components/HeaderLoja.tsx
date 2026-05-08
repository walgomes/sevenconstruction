"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  lojaNome?: string;
  voltarHref?: string;
  voltarLabel?: string;
};

export default function HeaderLoja({ lojaNome, voltarHref, voltarLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const showVoltar = pathname !== "/loja";
  const [naoLidas, setNaoLidas] = useState<number | null>(null);
  const [naoLidasAlta, setNaoLidasAlta] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const fetchContagem = async () => {
      try {
        const r = await fetch("/api/loja/notificacoes/contagem");
        if (!r.ok || cancelado) return;
        const j = await r.json();
        if (cancelado) return;
        setNaoLidas(j.nao_lidas ?? 0);
        setNaoLidasAlta(j.nao_lidas_alta ?? 0);
      } catch { /* silencioso */ }
    };
    fetchContagem();
    const id = setInterval(fetchContagem, 60_000);
    return () => { cancelado = true; clearInterval(id); };
  }, [pathname]);

  async function sair() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
      <div className="flex items-center gap-3">
        <Link href="/loja" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-zinc-100">
          <span className="inline-block h-6 w-6 rounded bg-amber-500" />
          <span className="font-semibold">
            Seven<span className="text-amber-400">Construction</span>
          </span>
        </Link>
        {lojaNome && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-sm text-zinc-400">{lojaNome}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/loja/notificacoes"
          className="relative rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          title="Notificações"
        >
          🔔
          {naoLidas != null && naoLidas > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              naoLidasAlta > 0 ? "bg-rose-500" : "bg-amber-500"
            }`}>
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Link>
        {showVoltar && (
          <Link
            href={voltarHref ?? "/loja"}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            ← {voltarLabel ?? "Painel"}
          </Link>
        )}
        <button
          onClick={sair}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-red-300"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
