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

- Email: `dono@demo.local`
- Senha: `demo123456`

## Roadmap

- F0 (auth multi-tenant + landing + login + dashboard) — entregue
- F1 (prospecção geo + lookalike portado do consultTudo) — próximo
- F2 (catálogo + cotação)
- F3 (checkout financeiro com 3 parceiros piloto via adapter pattern)
- F4 (consultas + certidões + certificado digital)
- F5 (plug SevenLicite + Seven Brecha)
- F6 (clube + PWA cliente final)
- F7 (onboarding 150+ parceiros via 1 adapter por semana)

## Segurança

- RLS lógico no app (todo SELECT filtra por `loja_id`)
- CSP + headers de segurança no middleware
- Cookie `sc_auth` httpOnly + sameSite=lax + HMAC validado no server
- Rate limit por IP (5/15min) e por email (10/60min)
- bcrypt cost 12

Antes de qualquer push para produção: rodar skill `seguranca-deploy` (RLS+CORS+Headers).
