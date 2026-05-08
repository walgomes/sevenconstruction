import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block h-9 w-9 rounded-md bg-amber-500" />
          <span className="text-lg font-semibold tracking-tight">
            Seven<span className="text-amber-400">Construction</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Entrar
          </Link>
          <Link
            href="/cadastrar"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            Criar conta grátis
          </Link>
        </div>
      </header>

      <section className="mt-16">
        <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          A loja de bairro que vende{" "}
          <span className="text-amber-400">muito mais que cimento</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-zinc-300">
          Prospecção geo do bairro, crédito no checkout, antecipação via FIDC,
          consultas, certidões, seguros e clube de fidelização — num único SaaS
          que faz a loja ganhar comissão em cada serviço que oferece.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/cadastrar"
            className="rounded-md bg-amber-500 px-5 py-3 font-medium text-zinc-950 hover:bg-amber-400"
          >
            🚀 Criar conta grátis (14 dias)
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-700 px-5 py-3 font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Já tenho conta
          </Link>
          <a
            href="#beneficios"
            className="rounded-md border border-zinc-800 px-5 py-3 font-medium text-zinc-400 hover:text-zinc-200"
          >
            Como funciona
          </a>
        </div>
      </section>

      <section id="beneficios" className="mt-20 grid gap-6 md:grid-cols-3">
        <Card titulo="Prospecção do bairro" texto="CEP da loja + raio em km. Liste construtoras, instaladores e empresas ativas com CNAE de obra na sua área." />
        <Card titulo="Crédito no checkout" texto="Bancos, fintechs, FIDC e factoring conectados. Vende a prazo e recebe à vista no mesmo dia." />
        <Card titulo="Licitações ganhas" texto="Cruza obras públicas vencidas na cidade e no Estado com sua base — vira lead quente em material." />
        <Card titulo="Consultas & certidões" texto="Serasa, placa, CPF, certidões federais e municipais, certificado digital — tudo na mesma tela." />
        <Card titulo="Consultoria embutida" texto="Jurídica e tributária por demanda. Comissão em cada serviço prestado ao seu cliente." />
        <Card titulo="Clube de fidelização" texto="Cashback que vira crédito em material ou serviço. Cliente fica, indica e compra mais." />
      </section>

      <section className="mt-20 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h2 className="text-2xl font-semibold">Todo mundo ganha</h2>
        <ul className="mt-4 grid gap-3 text-zinc-300 md:grid-cols-3">
          <li><strong className="text-zinc-100">Loja:</strong> mensalidade baixa + comissão em crédito, FIDC, seguros, consultas e certidões.</li>
          <li><strong className="text-zinc-100">Cliente:</strong> compra material no prazo, acessa crédito rápido e resolve burocracia num lugar só.</li>
          <li><strong className="text-zinc-100">Parceiro:</strong> recebe leads já enriquecidos com dado RFB e rating — conversão alta.</li>
        </ul>
      </section>

      <footer className="mt-16 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
        SevenConstruction — ecossistema Seven.
      </footer>
    </main>
  );
}

function Card({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/40">
      <h3 className="text-lg font-semibold text-amber-300">{titulo}</h3>
      <p className="mt-2 text-sm text-zinc-300">{texto}</p>
    </div>
  );
}
