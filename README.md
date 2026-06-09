# 🐄 Cowcular

> Controle financeiro compartilhado para lares, grupos e uso pessoal.

Cowcular é um trocadilho triplo: **cow** (a vaca mascote), **calcular** (a função central) e **lar** (o contexto âncora). Funciona também como verbo - _"vamos cowcular isso"_.

## O que é

Cowcular centraliza o controle de despesas compartilhadas em dois modelos de grupo:

**Lar** - grupo permanente com ciclo mensal. Ideal para casais e colegas de moradia. Suporta contas recorrentes, parcelamento, fechamento mensal automático ou manual e histórico contínuo de balanços.

**Grupo Avulso** - grupo temporário para um evento específico (viagem, churrasco, vaquinha, presente coletivo). Aceita participantes externos sem cadastro, divisão igualitária por padrão e gera um resumo final ao encerrar.

Cada usuário tem uma visão pessoal das suas finanças e acesso independente a cada grupo. Um dashboard unificado agrega tudo com filtros por período, categoria e contexto.

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 15+

## Setup local

**1. Clone e instale as dependências**

```bash
git clone https://github.com/seu-usuario/cowcular.git
cd cowcular
pnpm install
```

**2. Configure as variáveis de ambiente**

```bash
cp .env.example .env
```

Edite o `.env` com os valores do seu ambiente:

| Variável              | Descrição                                       | Exemplo                                          |
| --------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`        | Connection string do PostgreSQL                 | `postgresql://user:pass@localhost:5432/cowcular` |
| `AUTH_SECRET`         | Segredo para assinar tokens JWT (min. 32 chars) | `openssl rand -base64 32`                        |
| `AUTH_URL`            | URL base do frontend                            | `http://localhost:3000`                          |
| `API_URL`             | URL interna da API                              | `http://localhost:3001`                          |
| `NEXT_PUBLIC_API_URL` | URL da API acessível pelo browser               | `http://localhost:3001`                          |

**3. Crie o banco e rode as migrations**

```bash
# Cria as tabelas no banco
pnpm --filter @cowcular/db exec prisma migrate dev --name init
```

Se o banco ainda não existir, crie-o antes:

```sql
CREATE DATABASE cowcular;
```

**4. Popule as categorias do sistema**

```bash
pnpm --filter @cowcular/db exec prisma db seed
```

Isso cria as 8 categorias padrão: Moradia, Alimentação, Transporte, Saúde, Lazer, Serviços, Viagem e Outros. O script é idempotente - pode rodar várias vezes sem duplicar dados.

**5. Inicie o ambiente de desenvolvimento**

```bash
pnpm dev
```

| App        | URL                        | Descrição                   |
| ---------- | -------------------------- | --------------------------- |
| Frontend   | http://localhost:3000      | Next.js App Router          |
| Backend    | http://localhost:3001      | Hono + tRPC                 |
| tRPC panel | http://localhost:3001/trpc | Endpoint tRPC (aceita POST) |

## Testando a API

Após o setup, você pode testar a autenticação diretamente:

```bash
# Cadastro
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"joao","email":"joao@exemplo.com","name":"João","password":"senha1234"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"joao","password":"senha1234"}'
```

O login retorna um `token` JWT. Use-o nos headers das chamadas tRPC:

```
Authorization: Bearer <token>
```

## Estrutura do projeto

```
cowcular/
  apps/
    web/          Next.js App Router - frontend
    api/          Hono - servidor HTTP + adaptador tRPC
  packages/
    db/           Prisma schema, client e migrations
    trpc/         Routers tRPC compartilhados (auth, groups, accounts, transfers)
```

| Pacote          | Nome interno     | Descrição                                                |
| --------------- | ---------------- | -------------------------------------------------------- |
| `apps/web`      | `@cowcular/web`  | Frontend: Next.js, Tailwind CSS v4, Zustand, React Query |
| `apps/api`      | `@cowcular/api`  | Backend: Hono 4, tRPC v11, bcryptjs, jose                |
| `packages/db`   | `@cowcular/db`   | Prisma v6 + PostgreSQL - schema e client                 |
| `packages/trpc` | `@cowcular/trpc` | Routers e tipos tRPC compartilhados                      |

## Comandos úteis

| Comando                                              | Descrição                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                                           | Inicia todos os apps em paralelo (Turborepo)                 |
| `pnpm build`                                         | Compila todos os pacotes e apps                              |
| `pnpm lint`                                          | Executa o linter Biome                                       |
| `pnpm lint:fix`                                      | Lint com correção automática                                 |
| `pnpm typecheck`                                     | Verifica tipos TypeScript em todo o monorepo                 |
| `pnpm --filter @cowcular/db exec prisma migrate dev` | Cria e aplica migrations                                     |
| `pnpm --filter @cowcular/db exec prisma db seed`     | Roda o seed de dados                                         |
| `pnpm --filter @cowcular/db exec prisma generate`    | Regenera o Prisma Client                                     |
| `pnpm db:studio`                                     | Abre o Prisma Studio (GUI do banco) em http://localhost:5555 |

Para rodar um comando em um pacote específico:

```bash
pnpm --filter @cowcular/api dev
pnpm --filter @cowcular/web dev
```

## Stack

| Camada       | Tecnologia                                                |
| ------------ | --------------------------------------------------------- |
| Frontend     | Next.js 16 (App Router), TypeScript, Tailwind CSS v4      |
| Estado       | Zustand (auth global), TanStack Query (cache de servidor) |
| Backend      | Hono 4, tRPC v11                                          |
| Autenticação | JWT customizado com `jose`, bcryptjs                      |
| ORM          | Prisma v6                                                 |
| Banco        | PostgreSQL 15                                             |
| Monorepo     | pnpm workspaces + Turborepo                               |
| Linter       | Biome (lint + format)                                     |

## Variáveis de ambiente por app

Cada app lê as vars do `.env` na raiz do monorepo.

**apps/api** usa: `DATABASE_URL`, `AUTH_SECRET`

**apps/web** usa: `NEXT_PUBLIC_API_URL`
