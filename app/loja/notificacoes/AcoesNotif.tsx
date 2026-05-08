"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcoesNotif() {
  const router = useRouter();
  const [marcando, setMarcando] = useState(false);

  async function marcarTodas() {
    if (!confirm("Marcar todas como lidas?")) return;
    setMarcando(true);
    try {
      await fetch("/api/loja/notificacoes", { method: "POST" });
      router.refresh();
    } finally { setMarcando(false); }
  }

  return (
    <button
      onClick={marcarTodas}
      disabled={marcando}
      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
    >
      {marcando ? "..." : "✓ Marcar todas como lidas"}
    </button>
  );
}
