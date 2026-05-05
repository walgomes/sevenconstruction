import Link from "next/link";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { lerKpisMarketing } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export default async function DisparoHome() {
  const sessao = await lerSessao();
  if (!sessao || sessao.role !== "loja_user" || !sessao.loja_id) {
    redirect("/login");
  }

  const k = await lerKpisMarketing(sessao.loja_id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-400">Outbound</p>
          <h1 className="mt-1 text-3xl font-semibold">Disparo Email + WhatsApp</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Mande mensagem em massa pra sua base de clientes ou pra leads que vieram da prospecção.
            Templates personalizados, segmentação, supressão de descadastros — tudo dentro da LGPD.
          </p>
        </div>
        <Link
          href="/loja"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          ← Painel
        </Link>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <KPI label="Listas" valor={k.total_listas} cor="zinc" />
        <KPI label="Templates" valor={k.total_templates} cor="zinc" />
        <KPI label="Campanhas" valor={k.total_campanhas} cor="zinc" />
        <KPI
          label="Em disparo agora"
          valor={k.campanhas_ativas}
          cor={k.campanhas_ativas > 0 ? "amber" : "zinc"}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300">Enviados (30 dias)</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-200">
            {k.enviados_30d.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="rounded-xl border border-rose-700/30 bg-rose-950/20 p-5">
          <div className="text-xs uppercase tracking-wider text-rose-300">Supressões</div>
          <div className="mt-2 text-3xl font-semibold text-rose-200">{k.total_supressoes}</div>
          <div className="mt-1 text-xs text-zinc-400">descadastrados, bounces, manuais</div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card
          href="/loja/disparo/listas"
          titulo="Listas"
          desc="Audiência: importar da base de clientes ou prospec"
          emoji="📋"
        />
        <Card
          href="/loja/disparo/templates"
          titulo="Templates"
          desc="Modelos de email + WhatsApp com variáveis"
          emoji="✏️"
        />
        <Card
          href="/loja/disparo/campanhas"
          titulo="Campanhas"
          desc="Criar e disparar mensagem para uma lista"
          emoji="📤"
        />
      </section>

      <section className="mt-8 rounded-xl border border-amber-700/40 bg-amber-950/20 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-300">
          ⚠️ Setup pendente para envio real
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          A estrutura de listas, templates e campanhas está pronta. Para o envio real
          funcionar, precisa configurar:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
          <li>• <strong>WhatsApp Cloud API Meta</strong> — número aprovado, App ID, token, templates aprovados</li>
          <li>• <strong>Resend Email</strong> — domínio sevenconstruction.com.br configurado (DKIM, SPF, DMARC)</li>
          <li>• <strong>Worker de envio</strong> — processa fila respeitando rate limit</li>
          <li>• <strong>Webhook de descadastro</strong> — link de unsubscribe em cada email</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Modelo: ~R$ 0,06 por WhatsApp utility · Email Resend grátis até 3.000/dia ·
          Compliance LGPD (legítimo interesse) embutido nas templates.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
          📜 LGPD — base legal
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Envios B2B usando <strong>legítimo interesse</strong> exigem:
        </p>
        <ul className="mt-2 text-sm text-zinc-400 space-y-1">
          <li>• Descadastro 1-clique em todo email</li>
          <li>• Lista de supressão respeitada</li>
          <li>• Domínio não pode ser usado pra fins enganosos</li>
          <li>• WhatsApp Meta: respeita os 50–100 envios/dia/número se for chip</li>
        </ul>
      </section>
    </main>
  );
}

function KPI({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: "zinc" | "amber";
}) {
  const cls =
    cor === "amber"
      ? "border-amber-700/40 bg-amber-950/20"
      : "border-zinc-800 bg-zinc-900";
  return (
    <div className={`rounded-xl border ${cls} p-5`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${cor === "amber" ? "text-amber-300" : ""}`}>
        {valor}
      </div>
    </div>
  );
}

function Card({
  href,
  titulo,
  desc,
  emoji,
}: {
  href: string;
  titulo: string;
  desc: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/40"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <div className="font-semibold group-hover:text-amber-300">{titulo}</div>
          <div className="mt-1 text-xs text-zinc-400">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
