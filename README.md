# 🐄 Cowcular - Controle Financeiro Compartilhado

## Sobre

Cowcular é uma aplicação de controle financeiro voltada para lares, grupos e uso pessoal. Permite registrar contas, dividir despesas entre membros e acompanhar repasses de forma centralizada. Ideal para dividir gastos em casa, em viagens ou em qualquer grupo.

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 15+

## Setup local

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/cowcular.git
cd cowcular
```

2. Instale as dependências:

```bash
pnpm install
```

3. Configure as variáveis de ambiente:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e preencha os valores:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão PostgreSQL |
| `AUTH_SECRET` | Segredo para assinar os tokens JWT |
| `AUTH_URL` | URL base do frontend (ex: `http://localhost:3000`) |
| `API_URL` | URL interna da API (ex: `http://localhost:3001`) |
| `NEXT_PUBLIC_API_URL` | URL da API acessível pelo browser |

4. Rode as migrations:

```bash
pnpm --filter @cowcular/db exec prisma migrate dev
```

5. Rode o seed de dados iniciais:

```bash
pnpm --filter @cowcular/db exec prisma db seed
```

6. Inicie o ambiente de desenvolvimento:

```bash
pnpm dev
```

- Frontend (apps/web): http://localhost:3000
- Backend (apps/api): http://localhost:3001

## Estrutura do projeto

| Pacote | Descrição |
| --- | --- |
| `apps/web` | Frontend Next.js com App Router, Tailwind CSS e cliente tRPC |
| `apps/api` | Backend Hono com adaptador tRPC e rotas REST de autenticação |
| `packages/db` | Schema Prisma, cliente do banco e migrations |
| `packages/trpc` | Routers tRPC compartilhados entre frontend e backend |

## Comandos úteis

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia todos os apps em modo desenvolvimento |
| `pnpm build` | Compila todos os pacotes e apps |
| `pnpm lint` | Executa o linter (Biome) |
| `pnpm typecheck` | Verifica tipos TypeScript em todo o monorepo |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Executa as migrations pendentes |
| `pnpm --filter @cowcular/db exec prisma db seed` | Popula o banco com dados iniciais |
| `pnpm db:studio` | Abre o Prisma Studio |

## Stack

- Next.js (App Router)
- Hono
- tRPC
- Prisma
- PostgreSQL
- Tailwind CSS
- TypeScript
