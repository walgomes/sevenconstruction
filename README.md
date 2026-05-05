# SevenConstruction

SaaS standalone para lojas de material de construção. Prospecção geo do bairro, crédito no checkout, FIDC, seguros, certidões e fidelização — num único lugar.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- PostgreSQL 17 (banco próprio: `sevenconstruction_db`, schema `sevenconstruction.*`)
- bcrypt + HMAC-SHA256 + cookie httpOnly + rate limit em memória

## Setup local

```bash
# 1. Database (precisa do superuser postgres)
psql -U postgres -d postgres -c "CREATE DATABASE sevenconstruction_db OWNER sevenapp;"

# 2. .env.local (copie de .env.example e ajuste)
cp .env.example .env.local

# 3. Schema
npm run db:migrate

# 4. Seed (cria loja demo + dono)
npm run db:seed

# 5. Dev server
npm install
npm run dev
# http://localhost:8800
```

## Login demo

- Email: `walbericogomes@gmail.com`
- Senha: `Wal10201`

## Status (2026-05-05)

### Entregue

**Sprint 0 — Auth multi-tenant**
- Landing pública, login, dashboard
- Cookie `sc_auth` (HMAC-SHA256), bcrypt, rate limit
- Middleware com CSP + 8 headers de segurança

**Sprint 1 — Geração de leads**
- `/loja/prospec` — busca empresas no RFB de 70M (sevendb do consultTudo via role `sc_reader` read-only). Filtros: UF, município, nome, CNPJ, CNAE preset, porte. Salva resultados como `prospec_listas` + exporta CSV.
- `/loja/licitacoes-estado` — licitações vencidas no Estado da loja (Supabase do SevenLicite via `transparencia.licitacoes`). Junta com vencedor + telefone/email RFB.
- Schema marketing pré-instalado (mkt_listas, mkt_campanhas, mkt_envios, mkt_supressoes, mkt_templates) — UI de disparo virá no Sprint 4.

**Sprint 2 — Monetização da base de clientes**
- `/loja/clientes-base` — base de clientes da loja com filtros (cidade, rating, origem). Importa de uma `prospec_lista` ou cadastro manual (PJ/PF).
- `/loja/catalogo-servicos` — 10 serviços digitais ativáveis (certidões federal/estadual/trabalhista/falência, cert digital A1, consulta CNPJ/sócios/compliance/score, clube de vantagens). Toggle on/off + preço custom. Margem da loja calculada automaticamente.
- `/loja/comissoes` — ledger de receita: KPIs (mês, total, ticket médio, vendas/mês), últimas 50 transações, export CSV. API `POST /api/comissoes/registrar` registra venda automaticamente.

### Próximas fases

- **Sprint 3** — Diretório de profissionais (arquiteto/pedreiro/eletricista/etc) + programa de indicação 1 nível (código + ledger comissão).
- **Sprint 4** — Disparo real (Cloud API Meta + Resend domain + IA marketing 24h).
- **Fase 2** — APIs pagas plugadas (Serasa, SPC, Detran, Datavalid). Marketplace lojas concorrentes. Clube vantagens via white label (Allya/Lecupon). FIDC primeiros 3 adapters. MLM revendedor.

## Segurança

- RLS lógico no app (todo SELECT filtra por `loja_id`)
- CSP + headers de segurança no middleware
- Cookie `sc_auth` httpOnly + sameSite=lax + HMAC validado no server
- Rate limit por IP (5/15min) e por email (10/60min)
- bcrypt cost 12

Antes de qualquer push para produção: rodar skill `seguranca-deploy` (RLS+CORS+Headers).
