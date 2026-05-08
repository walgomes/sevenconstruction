// Wrapper de email transacional via Resend (https://resend.com).
// Sem RESEND_API_KEY: enviarEmail vira no-op (loga e retorna ok=false).
// Templates HTML inline pra evitar dep extra (tipo react-email).

const FROM_DEFAULT = "SevenConstruction <noreply@sevenconstruction.com.br>";

export interface EnvioResultado {
  ok: boolean;
  motivo?: string;
  id?: string;
}

export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  html: string;
  text?: string;
  reply_to?: string;
}): Promise<EnvioResultado> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || FROM_DEFAULT;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY nao configurado — email nao enviado:", opts.assunto, "→", opts.para);
    return { ok: false, motivo: "resend_nao_configurado" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.para],
        subject: opts.assunto,
        html: opts.html,
        text: opts.text,
        reply_to: opts.reply_to,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, motivo: `Resend ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = await r.json() as { id?: string };
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

// ===== Templates =====

const ESTILO_BASE = `
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; margin: 0; padding: 24px; color: #18181b; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
  .logo { display: inline-block; padding: 8px 12px; background: #f59e0b; color: #18181b; font-weight: 700; border-radius: 6px; }
  h1 { font-size: 24px; margin: 24px 0 12px; }
  p { line-height: 1.5; margin: 12px 0; color: #3f3f46; }
  .btn { display: inline-block; background: #f59e0b; color: #18181b; font-weight: 700; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 16px 0; }
  .footer { color: #71717a; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
  .codigo { font-family: monospace; background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
`;

function envelopar(conteudo: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${ESTILO_BASE}</style></head><body><div class="card">${conteudo}<p class="footer">SevenConstruction · Você recebeu este email porque tem conta na nossa plataforma. Se foi engano, pode ignorar.</p></div></body></html>`;
}

export function tplBoasVindas(opts: { nome: string; nome_loja: string; trial_dias: number }): { assunto: string; html: string; text: string } {
  const html = envelopar(`
    <span class="logo">Seven<span style="color:white">Construction</span></span>
    <h1>Bem-vindo, ${escape(opts.nome)} 👋</h1>
    <p>Sua loja <strong>${escape(opts.nome_loja)}</strong> está oficialmente no ar.</p>
    <p>Você tem <strong>${opts.trial_dias} dias de teste grátis</strong> no plano completo, sem cartão. Aproveita pra explorar:</p>
    <ul>
      <li>Prospecção geo do bairro</li>
      <li>Lookalike de carteira (achar clientes parecidos com os seus)</li>
      <li>FIDC + comparador de bancos</li>
      <li>Marketplace cross-fulfillment com outras lojas</li>
      <li>Clube de fidelização + PWA pro cliente final</li>
    </ul>
    <a class="btn" href="https://sevenconstruction.com.br/loja">Acessar o painel da loja →</a>
    <p>Qualquer dúvida, responda este email — falamos em até 4h em horário comercial.</p>
  `);
  return {
    assunto: `Bem-vindo, ${opts.nome} — sua loja está no ar`,
    html,
    text: `Bem-vindo, ${opts.nome}!\n\nSua loja ${opts.nome_loja} está no ar. Você tem ${opts.trial_dias} dias de trial grátis.\n\nAcesse: https://sevenconstruction.com.br/loja`,
  };
}

export function tplResetSenha(opts: { nome: string; link: string; expira_min: number }): { assunto: string; html: string; text: string } {
  const html = envelopar(`
    <span class="logo">Seven<span style="color:white">Construction</span></span>
    <h1>Resete sua senha</h1>
    <p>Olá, ${escape(opts.nome)}. Recebemos uma solicitação pra redefinir sua senha.</p>
    <a class="btn" href="${opts.link}">Redefinir senha →</a>
    <p>Esse link vale por <strong>${opts.expira_min} minutos</strong>. Se você não solicitou, ignore este email — sua senha continua a mesma.</p>
    <p style="font-size: 12px; color: #71717a;">Se o botão não funcionar, copie este link no navegador:<br><span class="codigo">${opts.link}</span></p>
  `);
  return {
    assunto: "Redefinir senha · SevenConstruction",
    html,
    text: `Olá, ${opts.nome}.\n\nClique pra redefinir sua senha (válido por ${opts.expira_min} min):\n${opts.link}\n\nSe você não solicitou, ignore.`,
  };
}

export function tplReciboPagamento(opts: { nome: string; valor_brl: string; periodo_inicio: string; periodo_fim: string; nome_loja: string }): { assunto: string; html: string; text: string } {
  const html = envelopar(`
    <span class="logo">Seven<span style="color:white">Construction</span></span>
    <h1>Pagamento confirmado ✅</h1>
    <p>Olá, ${escape(opts.nome)}. Seu pagamento foi processado com sucesso.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #71717a;">Valor</td><td style="text-align: right; font-weight: 700;">${escape(opts.valor_brl)}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717a;">Loja</td><td style="text-align: right;">${escape(opts.nome_loja)}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717a;">Período</td><td style="text-align: right;">${escape(opts.periodo_inicio)} → ${escape(opts.periodo_fim)}</td></tr>
    </table>
    <a class="btn" href="https://sevenconstruction.com.br/loja/billing">Ver fatura no painel →</a>
    <p style="font-size: 12px; color: #71717a;">Você pode baixar a NF-e no portal de billing acessando "Gerenciar".</p>
  `);
  return {
    assunto: `Pagamento confirmado · ${opts.valor_brl}`,
    html,
    text: `Pagamento de ${opts.valor_brl} confirmado para ${opts.nome_loja}. Período ${opts.periodo_inicio} → ${opts.periodo_fim}.`,
  };
}

export function tplFaturaVencida(opts: { nome: string; nome_loja: string; valor_brl: string; link_portal: string }): { assunto: string; html: string; text: string } {
  const html = envelopar(`
    <span class="logo">Seven<span style="color:white">Construction</span></span>
    <h1>⚠️ Pagamento não processado</h1>
    <p>Olá, ${escape(opts.nome)}. Não conseguimos cobrar a mensalidade da loja <strong>${escape(opts.nome_loja)}</strong> (${escape(opts.valor_brl)}).</p>
    <p>Pra evitar suspensão, atualize seu cartão no portal de cobrança:</p>
    <a class="btn" href="${opts.link_portal}">Atualizar cartão →</a>
    <p>Se o pagamento não for processado em <strong>5 dias</strong>, sua loja vai entrar em modo limitado (sem features Pro).</p>
  `);
  return {
    assunto: `Pagamento pendente · ${opts.valor_brl}`,
    html,
    text: `Pagamento de ${opts.valor_brl} pra loja ${opts.nome_loja} não processado. Atualize o cartao em ${opts.link_portal}`,
  };
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c));
}
