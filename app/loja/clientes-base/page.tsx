"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Cliente = {
  id: number;
  tipo_pessoa: "J" | "F";
  cnpj: string | null;
  cpf: string | null;
  nome_razao: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  rating_interno: string | null;
  origem: string;
  ultimo_compra_em: string | null;
  valor_total_comprado: number;
  qtd_compras: number;
};

type ProspecLista = { id: number; nome: string; total_itens: number; criado_em: string };

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDoc(c: Cliente) {
  const v = c.tipo_pessoa === "J" ? c.cnpj : c.cpf;
  if (!v) return "—";
  if (v.length === 14) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  if (v.length === 11) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  return v;
}

function ratingColor(r: string | null) {
  switch (r) {
    case "verde": return "bg-emerald-500/10 text-emerald-300";
    case "amarelo": return "bg-amber-500/10 text-amber-300";
    case "vermelho": return "bg-red-500/10 text-red-300";
    default: return "bg-zinc-500/10 text-zinc-400";
  }
}

export default function ClientesBasePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [cidade, setCidade] = useState("");
  const [rating, setRating] = useState("");
  const [origem, setOrigem] = useState("");

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());
      if (cidade.trim()) params.set("cidade", cidade.trim());
      if (rating) params.set("rating", rating);
      if (origem) params.set("origem", origem);
      const r = await fetch(`/api/clientes-base?${params}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setClientes(j.clientes);
    } catch {
      setErro("Erro de rede");
    } finally {
      setCarregando(false);
    }
  }, [busca, cidade, rating, origem]);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Base de clientes</p>
          <h1 className="mt-1 text-3xl font-semibold">Seus clientes</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Quem já compra de você. A base que monetiza com produtos digitais.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalImportar(true)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Importar de prospec
          </button>
          <button
            onClick={() => setModalNovo(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Novo cliente
          </button>
          <Link
            href="/loja"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Painel
          </Link>
        </div>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); buscar(); }}
        className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-5"
      >
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">Busca por nome</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex: Construtora ABC"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Cidade</label>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Rating</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">Qualquer</option>
            <option value="verde">Verde</option>
            <option value="amarelo">Amarelo</option>
            <option value="vermelho">Vermelho</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400">Origem</label>
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">Qualquer</option>
            <option value="manual">Manual</option>
            <option value="prospec">Prospec</option>
            <option value="importacao">Importação</option>
            <option value="wizard">Wizard</option>
          </select>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <button
            type="submit"
            disabled={carregando}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {carregando ? "Filtrando..." : "Filtrar"}
          </button>
        </div>
      </form>

      {erro && (
        <div className="mt-4 rounded-md border border-red-700/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {clientes.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Doc</th>
                <th className="px-3 py-2">Cidade/UF</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2 text-right">Total comprado</th>
                <th className="px-3 py-2 text-right">Compras</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-950/50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.nome_razao}</div>
                    {c.nome_fantasia && <div className="text-xs text-zinc-500">{c.nome_fantasia}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{formatDoc(c)}</td>
                  <td className="px-3 py-2">{c.cidade ? `${c.cidade}/${c.uf}` : c.uf || "—"}</td>
                  <td className="px-3 py-2">{c.telefone || <span className="text-zinc-500">—</span>}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{c.email || <span className="text-zinc-500">—</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ratingColor(c.rating_interno)}`}>
                      {c.rating_interno || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtBrl(c.valor_total_comprado)}</td>
                  <td className="px-3 py-2 text-right">{c.qtd_compras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && clientes.length === 0 && (
        <p className="mt-12 text-center text-sm text-zinc-500">
          Nenhum cliente cadastrado ainda. Use{" "}
          <button onClick={() => setModalNovo(true)} className="text-amber-400 hover:underline">
            + Novo cliente
          </button>{" "}
          ou{" "}
          <button onClick={() => setModalImportar(true)} className="text-amber-400 hover:underline">
            Importar de prospec
          </button>.
        </p>
      )}

      {modalNovo && <ModalNovo onClose={() => setModalNovo(false)} onSaved={buscar} />}
      {modalImportar && <ModalImportar onClose={() => setModalImportar(false)} onSaved={buscar} />}
    </main>
  );
}

function ModalNovo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipoPessoa, setTipoPessoa] = useState<"J" | "F">("J");
  const [doc, setDoc] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("BA");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/clientes-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_pessoa: tipoPessoa,
          cnpj: tipoPessoa === "J" ? doc : undefined,
          cpf: tipoPessoa === "F" ? doc : undefined,
          nome_razao: nome,
          email: email || undefined,
          telefone: telefone || undefined,
          cidade: cidade || undefined,
          uf: uf || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErro("Erro de rede");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo cliente</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">✕</button>
        </header>

        <div className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoPessoa("J")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${tipoPessoa === "J" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              Pessoa Jurídica
            </button>
            <button
              type="button"
              onClick={() => setTipoPessoa("F")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${tipoPessoa === "F" ? "bg-amber-500 text-zinc-950" : "border border-zinc-700"}`}
            >
              Pessoa Física
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-400">{tipoPessoa === "J" ? "CNPJ" : "CPF"}</label>
            <input
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder={tipoPessoa === "J" ? "00.000.000/0000-00" : "000.000.000-00"}
              required
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">{tipoPessoa === "J" ? "Razão social" : "Nome"}</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Telefone</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400">Cidade</label>
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">UF</label>
              <input
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalImportar({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [listas, setListas] = useState<ProspecLista[]>([]);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prospec/listas")
      .then((r) => r.json())
      .then((j) => setListas(j.listas || []))
      .finally(() => setCarregando(false));
  }, []);

  async function importar() {
    if (!selecionada) return;
    setImportando(true);
    setErro(null);
    try {
      const r = await fetch("/api/clientes-base/importar-prospec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospec_lista_id: selecionada }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErro(j.motivo || "Falha");
        return;
      }
      setResultado(`Importados: ${j.inseridos} novos · Já existiam: ${j.ja_existiam}`);
      onSaved();
    } catch {
      setErro("Erro de rede");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Importar de prospec</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">✕</button>
        </header>

        <p className="mt-2 text-sm text-zinc-400">
          Cada empresa da lista de prospecção vira cliente da sua base (origem=prospec).
          Duplicados (mesmo CNPJ) são ignorados.
        </p>

        {carregando && <p className="mt-6 text-sm text-zinc-500">Carregando...</p>}

        {!carregando && listas.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">
            Nenhuma lista de prospecção salva.{" "}
            <Link href="/loja/prospec" className="text-amber-400 hover:underline">
              Faça uma busca primeiro
            </Link>.
          </p>
        )}

        {!carregando && listas.length > 0 && (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {listas.map((l) => (
              <li key={l.id}>
                <label className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 ${selecionada === l.id ? "border-amber-500 bg-amber-500/5" : "border-zinc-700"}`}>
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={selecionada === l.id}
                      onChange={() => setSelecionada(l.id)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm">{l.nome}</span>
                  </span>
                  <span className="text-xs text-zinc-500">{l.total_itens} empresas</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {erro && (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {erro}
          </div>
        )}
        {resultado && (
          <div className="mt-3 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {resultado}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Fechar
          </button>
          {!resultado && (
            <button
              type="button"
              onClick={importar}
              disabled={!selecionada || importando}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {importando ? "Importando..." : "Importar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
