# Security — SevenConstruction

Auditoria por pilar conforme skill `seguranca-deploy` (regra absoluta antes de qualquer push em produção).

## Pilar 1 — RLS / Isolamento multi-tenant

Banco: PostgreSQL local, **não Supabase** — RLS nativo Postgres não está ativado. Isolamento é feito **no app layer**:

- ✅ Cookie `sc_auth` carrega `loja_id` (validado por HMAC-SHA256)
- ✅ TODA query autenticada filtra `WHERE loja_id = $1` com o `loja_id` da sessão
- ✅ `criarClienteManual()`, `salvarLista()`, `criarCampanha()`, `registrarVendaServico()`, `registrarIndicacao()` validam ownership antes de qualquer write
- ✅ `lerListaComItens()`, `listarClientesLoja()` etc. filtram por `loja_id` no SELECT
- ✅ Cliente_id passado em POST é validado com `SELECT ... WHERE id=$1 AND loja_id=$2`

**Risco residual:** se alguém adicionar query nova esquecendo o filtro, vaza dados entre lojas. Mitigação: code review + grep em SELECTs novos.

## Pilar 2 — CORS

- ✅ Sem rotas `/api/v1/*` públicas
- ✅ Default Next 16 bloqueia origens cross-site
- ✅ APIs autenticadas exigem cookie httpOnly (sameSite=lax) — não chamáveis por JS de outro domínio

## Pilar 3 — Security Headers (`middleware.ts`)

| Header | Valor | Status |
|---|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`{em prod adiciona `; upgrade-insecure-requests`} | ✅ |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` (só em prod) | ✅ |
| X-Frame-Options | `DENY` | ✅ |
| X-Content-Type-Options | `nosniff` | ✅ |
| Referrer-Policy | `strict-origin-when-cross-origin` | ✅ |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), browsing-topics=()` | ✅ |
| Cross-Origin-Opener-Policy | `same-origin` | ✅ |
| Cross-Origin-Resource-Policy | `same-origin` | ✅ |
| X-DNS-Prefetch-Control | `off` | ✅ |
| X-Permitted-Cross-Domain-Policies | `none` | ✅ |

**Pendente em prod:**
- Submeter domínio em https://hstspreload.org após primeiro deploy
- Considerar nonce-based CSP (eliminar `'unsafe-inline'` em script-src)
- Adicionar Reporting-Endpoints + report-to pra coletar violations

## Auth

- ✅ Cookie `sc_auth` com **httpOnly + sameSite=lax + secure (em prod)**
- ✅ HMAC-SHA256 do payload — assinatura validada com `timingSafeEqual` (resistente a timing attacks)
- ✅ Expiração 7 dias embutida no token
- ✅ Validação soft no middleware (formato), validação real no server (HMAC + role + exp)
- ✅ Senha: bcrypt cost 12
- ✅ `setCookie` em prod: `secure: true`. Em dev: `secure: false` pra http://localhost funcionar
- ⚠️ Em prod: considerar prefixo `__Host-` no nome do cookie (exige secure + path=/ + sem domain) — mais hardening anti-cookie-injection

## Rate limit

| Endpoint | Limite | Status |
|---|---|---|
| `POST /api/auth/login` | 5/15min por IP + 10/60min por email | ✅ |
| `POST /api/prospec/buscar` | 30/min por loja_id | ✅ |
| `POST /api/auth/logout` | sem limite (não-sensível) | n/a |
| Outras APIs autenticadas | usar `exigirLojaUser()` de `lib/auth-helpers` (60/min default) | ⚠️ não aplicado em todas — TODO |

**Implementação:** memória do processo (Map em `lib/rate-limit.ts`). Single-instance OK; multi-instance precisa Redis.

## SQL injection

- ✅ Todas queries usam parametrização `pg` ($1, $2) — nunca concatenação de strings
- ✅ Filtros dinâmicos (cidade, busca, etc) entram via `params.push()` + `$N`
- ✅ ORDER BY/LIMIT são string-literais (não vêm de input do usuário)

## Input validation

- ✅ POSTs validam tipo de campo principal (`typeof body.x === "string"`, `Number.isFinite()`)
- ✅ Slice em strings (limita tamanho: nome 200, busca 100, UF 2)
- ✅ CNPJ/CPF: `replace(/\D/g, "")` + length check
- ⚠️ Sem schema validation strict (zod) — TODO se crescer

## Secrets management

- ✅ `.gitignore` exclui `.env`, `.env.local`, `db/seed.mjs` (tem senha demo)
- ✅ `SC_SECRET` gerado >= 16 chars; em prod throw se faltar
- ✅ Senhas locais (`sc_reader`, `sevenapp`) em `.env.local` — fora do git
- ✅ Repo `walgomes/sevenconstruction` é **privado** no GitHub
- ⚠️ Senhas em prod: precisam vir de secret manager (Vercel env vars marked Sensitive, não em `.env.local`)

## Database

- ✅ Pool `pg` com timeout (5s connect, 30s idle)
- ✅ Role `sc_reader` em `sevendb` tem GRANT SELECT só em `public.empresas` (não toca outras tabelas)
- ✅ Helper `rfbQuery()` rejeita SQL não-SELECT (defesa em profundidade)
- ✅ `.env.local` separado de `.env.example`

## Compliance

- ⚠️ LGPD: ainda não há termo de uso/política de privacidade. Necessário antes de produção (especialmente quando consultar dados PF — Serasa, Bolsa Família, óbito).
- ⚠️ Bacen: feature de crédito (FIDC) precisa modelo claro: plataforma de indicação ou correspondente bancário. Cada parceiro vai exigir documentação.
- ⚠️ Susep: clube/seguros via corretora parceira (não direto).

## Pré-deploy checklist

Antes de qualquer push em produção:

- [ ] `npx tsc --noEmit` exit 0
- [ ] Trocar `SC_SECRET` para valor random ≥32 chars
- [ ] Trocar senhas Postgres (`sc_reader`, `sevenapp`)
- [ ] Configurar domínio com DKIM/SPF/DMARC (se vai mandar email)
- [ ] WhatsApp Cloud API com número aprovado + templates aprovados pela Meta
- [ ] LGPD: termo aceito pelo loja antes de qualquer consulta PF
- [ ] HSTS preload submission
- [ ] Backup automático Postgres
- [ ] Monitoring (Sentry / similar) com PII redaction nos logs
