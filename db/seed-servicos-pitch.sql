-- Pitch de marketing pra cada servico do catalogo.
-- Roda DEPOIS de schema-servicos.sql. Idempotente (UPDATE por codigo).

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Tira em minutos a Certidão Negativa Federal (Receita+PGFN) que o cliente precisa pra fechar contrato, financiamento ou licitação.',
  para_quem = 'Construtores, prestadores de serviço, fornecedores que vão fechar contrato com órgão público ou empresa grande.',
  casos_uso = ARRAY[
    'Construtor vai assinar contrato de obra: precisa CND atualizada',
    'Cliente PJ vai abrir conta empresarial em banco: pedem CND',
    'Empresa vai contratar funcionário CLT: precisa CND pra encargos',
    'Vai participar de licitação: CND é obrigatória no envelope',
    'Vai vender pra órgão público: CND no cadastro de fornecedor'
  ],
  prazo_entrega = 'Na hora (até 5 minutos)',
  como_vender = 'Pergunta: "Você está em dia com a Receita pra fechar esse contrato?" Se titubear, oferece a CND R$ 25 — você ganha R$ 16 e o cliente sai resolvido.'
WHERE codigo = 'CRT_FED';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Certidão Negativa de débitos com a Sefaz da UF. Pré-requisito pra vender pra estado/prefeitura.',
  para_quem = 'Fornecedor de órgão estadual/municipal, construtor de obra pública.',
  casos_uso = ARRAY[
    'Inscrição em licitação estadual ou municipal',
    'Cadastro de fornecedor em prefeitura',
    'Renovação de alvará comercial',
    'Aceite de proposta por orgão público'
  ],
  prazo_entrega = '1 a 3 dias úteis',
  como_vender = 'Combo com CND Federal: "Por mais R$ 30 você sai com Federal+Estadual já tudo regularizado."'
WHERE codigo = 'CRT_EST';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'CNDT do TST — comprova que a empresa não tem dívida trabalhista. Pré-requisito de licitação.',
  para_quem = 'Toda empresa que contrata mão-de-obra ou vai fechar contrato grande.',
  casos_uso = ARRAY[
    'Envelope de habilitação de licitação pública',
    'Contratação de empresa terceirizada',
    'Comprovação pra cliente final (gerente compras pede)',
    'Fechamento de financiamento com banco'
  ],
  prazo_entrega = 'Na hora',
  como_vender = '"Tem ideia se a empresa tem alguma reclamatória trabalhista pendente? Em 5 minutos a gente checa e tira a certidão limpa."'
WHERE codigo = 'CRT_TRB';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Certidão do TJ que comprova que a empresa NÃO está em recuperação judicial ou falência.',
  para_quem = 'Quem vai fechar contrato grande, vender a prazo, ou participar de licitação.',
  casos_uso = ARRAY[
    'Contrato de prestação de serviço de longo prazo',
    'Venda parcelada com nota acima de R$ 50k',
    'Habilitação em licitação pública',
    'Análise de crédito B2B'
  ],
  prazo_entrega = '1 a 2 dias úteis',
  como_vender = '"Antes de aprovar prazo nesse cliente, vamos ver se ele não está em recuperação? R$ 35 pra dormir tranquilo."'
WHERE codigo = 'CRT_FAL';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Certificado Digital A1 (1 ano) — assinatura jurídica de NF-e, contratos, declarações fiscais.',
  para_quem = 'Toda empresa que emite NF-e, MEI virando ME, contadores, escritórios.',
  casos_uso = ARRAY[
    'Emissão de NFe / NFSe',
    'Conectar Sped Fiscal',
    'Assinatura de contratos digitais',
    'Conectar e-Social, eSocial doméstico, RAIS, GFIP',
    'Acessar Portal CTF Receita Federal'
  ],
  prazo_entrega = '1 dia útil (validação por foto + selfie)',
  como_vender = '"Você ainda usa certificado físico A3? O A1 fica direto no computador, sem risco de perder. R$ 200 por 1 ano vs R$ 380 do A3 — economiza e trabalha mais ágil."'
WHERE codigo = 'CRT_DIG';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Tudo sobre uma empresa em uma tela: dados RFB, CNAEs, sócios, situação, capital, telefone, email.',
  para_quem = 'Vendedor querendo qualificar lead. Comprador querendo confirmar fornecedor. Investigador.',
  casos_uso = ARRAY[
    'Antes de aprovar prazo, confirma se a empresa está ativa há +5 anos',
    'Verifica capital social pra estimar capacidade financeira',
    'Confirma sócios reais antes de assinar contrato',
    'Identifica CNAEs secundários pra cross-sell',
    'Compara empresa do cliente com concorrente (porte, ano abertura)'
  ],
  prazo_entrega = 'Na hora',
  como_vender = '"R$ 15 e você sabe TUDO sobre o CNPJ — quem são os sócios, quanto a empresa tem de capital, e se ela tá realmente ativa. Investe R$ 15 antes de fechar R$ 5.000 a prazo?"'
WHERE codigo = 'CONS_CNPJ';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Lista TODAS as empresas em que cada sócio do CNPJ aparece. Identifica grupo econômico oculto.',
  para_quem = 'Análise de risco, due diligence, identificar concorrente disfarçado.',
  casos_uso = ARRAY[
    'O sócio que assina contrato tem outras 8 empresas — alerta de fraude',
    'O CNPJ "novo" é gemêo do que deu calote 6 meses atrás',
    'Confirma se o cliente tem porte declarado vs porte real do grupo',
    'Identifica grupo econômico para análise de crédito',
    'Encontra empresa parceira pra cross-sell'
  ],
  prazo_entrega = 'Na hora',
  como_vender = '"Você sabia que esse sócio aqui é dono de outras 4 empresas? R$ 30 e em 30s a gente mapeia o grupo todo — pode mudar tudo na sua decisão de prazo."'
WHERE codigo = 'CONS_SOC';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Análise de compliance completa: CEIS, CNEP, CEPIM, CADIN, PGFN, sanções, processos, lista suja.',
  para_quem = 'Empresa contratando fornecedor, banco analisando crédito, área de risco.',
  casos_uso = ARRAY[
    'Antes de fechar contrato com fornecedor: verifica sanções administrativas',
    'Análise de risco de fornecedor de obra pública',
    'Compliance interno de auditoria',
    'Verificação anti-corrupção (CEIS+CNEP)',
    'Confirma se empresa não está na lista suja do MTE'
  ],
  prazo_entrega = 'Na hora',
  como_vender = '"R$ 80 pra ter certeza que o fornecedor não tem sanção pública nem está em lista suja. Multa de compliance custa muito mais."'
WHERE codigo = 'CONS_COMP';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Score de crédito empresa: rating Serasa + análise de capital social + tempo de mercado + histórico.',
  para_quem = 'Toda venda a prazo. Análise de proposta de fornecedor. Banco/factoring.',
  casos_uso = ARRAY[
    'Antes de aprovar 30/60/90 dias: confirma score',
    'Define limite de crédito sugerido pra novo cliente',
    'Compara dois fornecedores pra escolher o mais sólido',
    'Análise pré-FIDC (antecipar recebível com taxa boa)',
    'Justifica negar prazo a cliente novo'
  ],
  prazo_entrega = 'Na hora',
  como_vender = '"R$ 40 e você sabe se pode dar prazo ou só à vista. Score 700+ libera 90 dias; abaixo de 500 só faz à vista. Vira política de crédito."'
WHERE codigo = 'CONS_SCORE';

UPDATE sevenconstruction.servicos_catalogo SET
  pitch_curto = 'Por R$ 49/mês, seu cliente acessa 3000+ empresas com desconto: farmácia, cinema, restaurante, posto, passagem aérea.',
  para_quem = 'Cliente recorrente que gostaria de mais benefício. Funcionários da empresa-cliente.',
  casos_uso = ARRAY[
    'Em vez de dar 5% de desconto, oferece o Clube — mantém margem e dá MAIS valor',
    'Programa de fidelidade: cliente compra material e ganha 1 mês de Clube',
    'Diferencial competitivo vs concorrente que só vende cimento',
    'Recurrência: R$ 49/mês × 100 clientes = R$ 4.900/mês passivo'
  ],
  prazo_entrega = 'Acesso na hora (login + senha por email)',
  como_vender = '"Você daria 5% de desconto na NF? São R$ 50 num ticket de R$ 1.000. Em vez disso, oferece o Clube por R$ 49/mês — cliente economiza muito mais (cinema, farmácia, posto) E você fatura R$ 24 de comissão recorrente."'
WHERE codigo = 'CLUBE';
