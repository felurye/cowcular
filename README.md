# Cowcular

> Controle financeiro compartilhado para lares, grupos e uso pessoal.

Cowcular é um trocadilho triplo: **cow** (a vaca mascote), **calcular** (a função central) e **lar** (o contexto âncora). Funciona também como verbo - _"vamos cowcular isso"_.

## O que é

Cowcular centraliza o controle de despesas compartilhadas em dois modelos de grupo:

**Lar** - grupo permanente com ciclo mensal. Ideal para casais e colegas de moradia. Suporta contas recorrentes, parcelamento, fechamento mensal automático ou manual e histórico contínuo de balanços.

**Grupo Avulso** - grupo temporário para um evento específico (viagem, churrasco, vaquinha, presente coletivo). Aceita participantes externos sem cadastro, divisão igualitária por padrão e gera um resumo final ao encerrar.

Cada usuário tem uma visão pessoal das suas finanças e acesso independente a cada grupo. Um dashboard unificado agrega tudo com filtros por período, categoria e contexto.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Conta no [Supabase](https://supabase.com)

## Setup local

**1. Clone e instale as dependências**

```bash
git clone https://github.com/seu-usuario/cowcular.git
cd cowcular
npm install
```

**2. Configure as variáveis de ambiente**

```bash
cp .env.example .env
```

Edite o `.env` com os valores do seu projeto no Supabase:

| Variável                        | Descrição                  | Onde encontrar                    |
| ------------------------------- | -------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL do projeto Supabase    | Settings > API > Project URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima pública      | Settings > API > anon key         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Chave de serviço (privada) | Settings > API > service_role key |

**3. Configure o banco de dados**

No Supabase, execute as migrations disponíveis em `packages/db/prisma/migrations/` pelo SQL Editor ou pela CLI do Supabase.

**4. Inicie o ambiente de desenvolvimento**

```bash
npm run dev
```

O app estará disponível em http://localhost:3000.

## Estrutura do projeto

```
cowcular/
  src/
    app/
      (public)/   páginas públicas (login, cadastro, join)
      (app)/      páginas autenticadas (dashboard, grupos, repasses...)
      api/        Route Handlers - lógica de negócio server-side
    hooks/        hooks TanStack Query por domínio
    lib/          clientes Supabase (browser, server, admin) e utilitários
    providers/    QueryProvider (TanStack Query)
    store/        estado global Zustand (usuário autenticado)
    components/   componentes compartilhados (sidebar...)
  public/         assets estáticos
```

## Comandos úteis

| Comando             | Descrição                             |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Inicia o servidor de desenvolvimento  |
| `npm run build`     | Compila para produção                 |
| `npm run typecheck` | Verifica tipos TypeScript             |
| `npm run lint`      | Executa o linter Biome                |
| `npm run lint:fix`  | Lint com correção automática          |
| `npm run check:fix` | Lint + format com correção automática |

## Variáveis de ambiente

Todas as variáveis ficam no `.env` na raiz do projeto.

| Variável                        | Visibilidade          | Uso                                 |
| ------------------------------- | --------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Pública (browser)     | Cliente Supabase no navegador       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública (browser)     | Autenticação e queries com RLS      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Privada (server only) | API routes que precisam ignorar RLS |

## Stack

| Camada         | Tecnologia                                                   |
| -------------- | ------------------------------------------------------------ |
| Frontend       | Next.js 16 (App Router), TypeScript, Tailwind CSS v4         |
| Estado         | Zustand (auth global), TanStack Query v5 (cache de servidor) |
| Backend        | Next.js API Route Handlers                                   |
| Autenticação   | Supabase Auth (`@supabase/ssr`)                              |
| Banco de dados | Supabase (PostgreSQL gerenciado)                             |
| Gráficos       | Recharts                                                     |
| Linter         | Biome (lint + format)                                        |
| Deploy         | Vercel                                                       |
