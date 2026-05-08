"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Usuario = {
  id: number; email: string; nome: string; papel: string;
  telefone: string | null; ativo: boolean;
  criado_em: string; ultimo_login: string | null;
};

type Convite = {
  id: number; loja_id: number; email: string; papel: string;
  expira_em: string; status: string; criado_em: string;
};

const PAPEL_LABEL: Record<string, { label: string; cor: string }> = {
  dono:     { label: "Dono",     cor: "bg-amber-500/20 text-amber-300 border-amber-700/40" },
  gerente:  { label: "Gerente",  cor: "bg-blue-500/20 text-blue-300 border-blue-700/40" },
  vendedor: { label: "Vendedor", cor: "bg-zinc-500/20 text-zinc-300 border-zinc-700" },
};

export default function GestaoEquipe({
  usuariosIniciais, convitesIniciais, meuPapel, meuId,
}: {
  usuariosIniciais: Usuario[];
  convitesIniciais: Convite[];
  meuPapel: string;
  meuId: number;
}) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(usuariosIniciais);
  const [convites, setConvites] = useState(convitesIniciais);
  const [emailNovo, setEmailNovo] = useState("");
  const [papelNovo, setPapelNovo] = useState<"vendedor" | "gerente" | "dono">("vendedor");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const podeConvidar = meuPapel === "dono" || meuPapel === "gerente";
  const podeRemover = meuPapel === "dono";

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null); setSucesso(null);
    try {
      const r = await fetch("/api/loja/usuarios/convidar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailNovo, papel: papelNovo }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setConvites([j.convite, ...convites]);
      setEmailNovo("");
      setSucesso(`✓ Convite enviado pra ${emailNovo}. Link válido por 7 dias.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setEnviando(false); }
  }

  async function revogar(id: number) {
    if (!confirm("Revogar convite?")) return;
    const r = await fetch(`/api/loja/usuarios/convidar?id=${id}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) setConvites(convites.filter((c) => c.id !== id));
  }

  async function alternarAtivo(u: Usuario) {
    if (u.id === meuId) { alert("Não pode desativar a si mesmo"); return; }
    if (!confirm(`${u.ativo ? "Desativar" : "Ativar"} ${u.nome}?`)) return;
    try {
      const r = await fetch(`/api/loja/usuarios/${u.id}`, { method: "PATCH" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.motivo || "falha");
      setUsuarios(usuarios.map((x) => x.id === u.id ? { ...x, ativo: !x.ativo } : x));
      router.refresh();
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      {podeConvidar && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-amber-400">+ Convidar pessoa</h2>
          <form onSubmit={convidar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input
              type="email" required
              value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)}
              placeholder="email@empresa.com"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <select
              value={papelNovo} onChange={(e) => setPapelNovo(e.target.value as typeof papelNovo)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="vendedor">Vendedor</option>
              {meuPapel === "dono" && <option value="gerente">Gerente</option>}
              {meuPapel === "dono" && <option value="dono">Dono</option>}
            </select>
            <button
              type="submit" disabled={enviando || !emailNovo}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {enviando ? "..." : "Enviar convite"}
            </button>
          </form>
          {erro && <p className="mt-2 text-xs text-rose-300">⚠️ {erro}</p>}
          {sucesso && <p className="mt-2 text-xs text-emerald-300">{sucesso}</p>}
        </section>
      )}

      {convites.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Convites pendentes ({convites.length})</h2>
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/30">
            {convites.map((c) => {
              const pl = PAPEL_LABEL[c.papel] ?? { label: c.papel, cor: "bg-zinc-500/15 text-zinc-300" };
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-100">{c.email}</p>
                    <p className="text-[10px] text-zinc-500">
                      Expira em {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pl.cor}`}>
                      {pl.label}
                    </span>
                    {podeConvidar && (
                      <button onClick={() => revogar(c.id)} className="text-xs text-zinc-500 hover:text-rose-300">
                        revogar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Usuários ativos</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2">Último login</th>
                <th className="px-3 py-2 text-center">Status</th>
                {podeRemover && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {usuarios.map((u) => {
                const pl = PAPEL_LABEL[u.papel] ?? { label: u.papel, cor: "bg-zinc-500/15 text-zinc-300" };
                return (
                  <tr key={u.id} className={u.ativo ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-medium text-zinc-100">
                      {u.nome}
                      {u.id === meuId && <span className="ml-2 text-[10px] text-amber-400">(você)</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{u.email}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pl.cor}`}>
                        {pl.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {u.ultimo_login ? new Date(u.ultimo_login).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        u.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-500"
                      }`}>
                        {u.ativo ? "ativo" : "inativo"}
                      </span>
                    </td>
                    {podeRemover && (
                      <td className="px-3 py-2 text-right">
                        {u.id !== meuId && (
                          <button onClick={() => alternarAtivo(u)}
                            className="text-xs text-zinc-400 hover:text-rose-300">
                            {u.ativo ? "desativar" : "ativar"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
