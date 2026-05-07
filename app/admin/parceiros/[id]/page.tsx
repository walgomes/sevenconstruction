import Link from "next/link";
import { notFound } from "next/navigation";
import { lerParceiro, TIPOS_PARCEIRO } from "@/lib/parceiros";

export const dynamic = "force-dynamic";

export default async function ParceiroDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await lerParceiro(Number(id));
  if (!p) notFound();

  const meta = TIPOS_PARCEIRO.find((t) => t.valor === p.tipo);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-rose-400">Admin · Parceiros</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{p.nome_fantasia}</h1>
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta?.cor ?? ""}`}>
              {meta?.rotulo ?? p.tipo}
            </span>
            <span className="font-mono text-sm text-zinc-500">#{p.codigo}</span>
          </div>
          {p.razao_social && p.razao_social !== p.nome_fantasia && (
            <p className="mt-1 text-sm text-zinc-400">{p.razao_social}</p>
          )}
        </div>
        <Link href="/admin/parceiros" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Voltar
        </Link>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Bloco titulo="Dados cadastrais">
          <Linha rotulo="CNPJ" valor={p.cnpj ? formatarCnpj(p.cnpj) : "—"} mono />
          <Linha rotulo="CNAE" valor={p.cnae_principal ? formatarCnae(p.cnae_principal) : "—"} mono />
          <Linha rotulo="Status" valor={p.ativo ? "Ativo" : "Inativo"} />
          <Linha rotulo="Origem" valor={p.origem ?? "—"} />
          {p.origem_url && (
            <Linha
              rotulo="URL fonte"
              valor={
                <a href={p.origem_url} target="_blank" rel="noreferrer noopener" className="text-rose-300 hover:underline">
                  {p.origem_url.replace(/^https?:\/\//, "").slice(0, 60)}
                </a>
              }
            />
          )}
        </Bloco>

        <Bloco titulo="Localização">
          <Linha rotulo="UF" valor={p.uf ?? "—"} />
          <Linha rotulo="Cidade" valor={p.cidade ?? "—"} />
          <Linha rotulo="Endereço" valor={p.endereco ?? "—"} />
          <Linha rotulo="CEP" valor={p.cep ? formatarCep(p.cep) : "—"} mono />
        </Bloco>

        <Bloco titulo="Contato">
          <Linha rotulo="Telefone" valor={p.telefone ?? "—"} />
          <Linha rotulo="WhatsApp" valor={p.whatsapp ?? "—"} />
          <Linha rotulo="Email" valor={p.email ?? "—"} />
          <Linha
            rotulo="Site"
            valor={
              p.site ? (
                <a href={p.site} target="_blank" rel="noreferrer noopener" className="text-rose-300 hover:underline">
                  {p.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              ) : "—"
            }
          />
        </Bloco>

        <Bloco titulo="Produtos cadastrados">
          {p.produtos && p.produtos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {p.produtos.map((pr) => (
                <Link
                  key={pr}
                  href={`/admin/parceiros?produto=${encodeURIComponent(pr)}`}
                  className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  {pr}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nenhum produto cadastrado.</p>
          )}
        </Bloco>

        {p.notas && (
          <div className="sm:col-span-2">
            <Bloco titulo="Notas internas">
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{p.notas}</p>
            </Bloco>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-zinc-600">
        Cadastrado em {new Date(p.criado_em).toLocaleString("pt-BR")} · atualizado em{" "}
        {new Date(p.atualizado_em).toLocaleString("pt-BR")}
      </p>
    </main>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{titulo}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800/60 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <span className={`text-sm text-zinc-200 ${mono ? "font-mono" : ""}`}>{valor}</span>
    </div>
  );
}

function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D+/g, "").padStart(14, "0");
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}
function formatarCnae(cnae: string): string {
  const d = cnae.replace(/\D+/g, "").padStart(7, "0");
  return `${d.slice(0,4)}-${d.slice(4,5)}/${d.slice(5,7)}`;
}
function formatarCep(cep: string): string {
  const d = cep.replace(/\D+/g, "").padStart(8, "0");
  return `${d.slice(0,5)}-${d.slice(5,8)}`;
}
