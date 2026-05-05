// Página pública. NÃO substitui revisão jurídica — texto inicial razoável.

export const metadata = {
  title: "Termos de uso e privacidade — SevenConstruction",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-200">
      <h1 className="text-3xl font-semibold">Termos de uso e política de privacidade</h1>
      <p className="mt-2 text-sm text-zinc-500">Versão 1.0 — última atualização: 2026-05-05</p>

      <p className="mt-6 rounded-md border border-amber-700/30 bg-amber-950/20 p-3 text-xs text-amber-200">
        ⚠️ Este texto é uma versão inicial. Antes do uso em produção, deve passar por revisão jurídica
        adequada à atividade da loja, especialmente sobre tratamento de dados pessoais (LGPD)
        e marketing direto.
      </p>

      <Section titulo="1. Quem somos">
        <p>
          SevenConstruction é uma plataforma SaaS multi-tenant fornecida pelo grupo Seven Empresas,
          destinada a lojas de material de construção que desejam vender produtos digitais
          (certidões, consultas, certificado digital, clube de vantagens, crédito) à sua base de
          clientes existente.
        </p>
      </Section>

      <Section titulo="2. Quem é o controlador dos dados">
        <p>
          Cada <strong>loja</strong> é controladora dos dados dos seus clientes finais.
          A SevenConstruction é operadora, executando o tratamento conforme orientação da loja.
        </p>
      </Section>

      <Section titulo="3. Que dados tratamos">
        <ul className="list-disc pl-6 space-y-1">
          <li>Dados de cadastro do usuário da loja (nome, email, telefone, função)</li>
          <li>Dados dos clientes da loja (CNPJ/CPF, contato, histórico de compras)</li>
          <li>Dados públicos da Receita Federal (RFB) — empresas ativas no Brasil</li>
          <li>Dados públicos de licitações e compliance (CEIS, CNEP, PGFN, CADIN)</li>
          <li>Logs de acesso e atividade (IP, user-agent, timestamps)</li>
        </ul>
      </Section>

      <Section titulo="4. Base legal">
        <p>
          Tratamos dados sob as seguintes bases legais (LGPD art. 7º):
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Consentimento:</strong> consultas que envolvam dados sensíveis ou de PF</li>
          <li><strong>Legítimo interesse:</strong> envio de comunicações comerciais B2B (com descadastro 1-clique)</li>
          <li><strong>Cumprimento de obrigação legal:</strong> emissão de certidões, registros fiscais</li>
          <li><strong>Execução de contrato:</strong> entrega dos serviços contratados</li>
        </ul>
      </Section>

      <Section titulo="5. Direitos do titular">
        <p>
          Você pode, a qualquer momento:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Solicitar acesso aos seus dados</li>
          <li>Corrigir dados incorretos</li>
          <li>Solicitar exclusão (direito de oposição)</li>
          <li>Descadastrar de envios marketing pelo link de unsubscribe</li>
          <li>Solicitar portabilidade</li>
        </ul>
        <p className="mt-3">
          Contato do encarregado: <a href="mailto:dpo@sevenconstruction.com.br" className="text-amber-400 hover:underline">dpo@sevenconstruction.com.br</a>
        </p>
      </Section>

      <Section titulo="6. Marketing direto (legítimo interesse)">
        <p>
          Quando a loja envia campanhas de email/WhatsApp para sua base, atua sob legítimo
          interesse comercial B2B. Todo envio:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Identifica claramente quem está enviando (nome da loja)</li>
          <li>Inclui link de descadastro 1-clique (LGPD art. 18)</li>
          <li>Respeita lista de supressão</li>
          <li>Não usa endereços coletados sem origem documentada</li>
        </ul>
      </Section>

      <Section titulo="7. Compartilhamento com terceiros">
        <p>
          Compartilhamos dados <strong>apenas</strong> com:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Provedores de envio</strong> (Resend para email, Cloud API Meta para WhatsApp) — só destinatário e mensagem</li>
          <li><strong>Bureaus de crédito</strong> (Serasa, SPC) — quando consulta de crédito for solicitada com consentimento</li>
          <li><strong>Receita Federal e órgãos públicos</strong> — para emissão de certidões</li>
        </ul>
      </Section>

      <Section titulo="8. Retenção e segurança">
        <p>
          Dados são retidos pelo prazo necessário para a finalidade ou obrigação legal aplicável.
          Logs de auditoria: 1 ano. Senhas: hash bcrypt cost 12. Comunicação: TLS 1.3.
          Banco de dados criptografado em repouso.
        </p>
      </Section>

      <Section titulo="9. Atualizações">
        <p>
          Estes termos podem ser atualizados. Versões anteriores ficam arquivadas com
          a data de publicação. Você será notificado sobre mudanças materiais via email.
        </p>
      </Section>

      <p className="mt-12 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        © SevenConstruction. Para dúvidas: contato@sevenconstruction.com.br
      </p>
    </main>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-amber-300">{titulo}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}
