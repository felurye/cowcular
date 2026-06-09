# Cowcular - Tasks e Planejamento de Desenvolvimento

## Estado Atual do Codebase

| Camada                 | Status    | O que existe                                                                                                                   |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Schema Prisma          | Completo  | Todos os modelos modelados (User, Group, GroupMember, Account, AccountSplit, Transfer, Category, Notification, MonthlyBalance) |
| Auth (API)             | Funcional | Register, login com bcrypt + JWT via `jose`                                                                                    |
| Context tRPC           | Funcional | JWT verificado e injetado no contexto em toda request                                                                          |
| Groups (tRPC)          | Parcial   | list, create, byId, close, leave - faltam convites, membros externos, defaultSplit                                             |
| Accounts (tRPC)        | Parcial   | list, create, markPaid, defer - faltam update, delete, auto-geração de repasses                                                |
| Transfers (tRPC)       | Parcial   | list, markPaid, confirm - faltam criação automática, abatimento                                                                |
| Categories (tRPC)      | Ausente   | Sem router, sem seed de categorias do sistema                                                                                  |
| Monthly Balance (tRPC) | Ausente   | Sem router                                                                                                                     |
| Notifications (tRPC)   | Ausente   | Sem router                                                                                                                     |
| Frontend               | Mínimo    | Apenas landing page (`/`), sem nenhuma tela funcional                                                                          |

---

## Decisões Técnicas

### DT-1: Backend - Hono vs Next.js API Routes

**Spec original:** Next.js API Routes + tRPC.
**Implementação atual:** Hono + tRPC.

**Decisão:** Manter Hono. O padrão atual funciona bem - Hono serve como camada REST para auth (onde bcrypt e JWT precisam rodar em ambiente Node), e tRPC cobre todo o domínio de negócio.
Migrar para Next.js API Routes introduziria trabalho sem ganho funcional para v1.

### DT-2: Auth - Custom JWT vs Auth.js v5

**Spec original:** Auth.js v5 (credentials provider).
**Implementação atual:** JWT customizado com `jose` + bcrypt.

**Decisão:** Manter JWT customizado. Auth.js agrega valor principalmente para OAuth (fora do escopo v1) e session management server-side. O JWT atual já suporta extensão futura para OAuth sem refatoração total.

**Skill relevante:** Nenhuma para esta decisão.

### DT-3: Transfer auto-geração

Quando uma conta com splits for criada, os repasses entre membros devem ser calculados e gravados automaticamente. A lógica: para cada par (pagador, devedor), se A pagou e B deve X%, gera Transfer de B para A com amount = X% do total. Executar dentro de uma transação Prisma com a criação da conta.

**Decisão:** Implementar em `accounts.create` via `ctx.db.$transaction([...])`.

### DT-4: Notificações - Estratégia de entrega

In-app apenas (v1). Sem WebSocket ou SSE.

**Decisão:** Polling via React Query com `refetchInterval: 30_000` ms no componente de notificações. Notificações são criadas server-side nas mutations relevantes (novo repasse, confirmação, etc.).

### DT-5: Estrutura de rotas no Next.js

**Decisão:** Route groups:

- `(public)` - `/login`, `/register`, `/join/[code]`
- `(app)` - tudo que requer auth; middleware redireciona para `/login` se sem token

**Skill relevante:** `nextjs-app-router-fundamentals`, `nextjs-server-client-components` - consultar antes de criar a estrutura de layouts e separar Server/Client Components corretamente.

### DT-6: Server Actions vs tRPC no Frontend

**Decisão:** Usar tRPC client para todas as mutations, não Server Actions. O backend já existe como API separada (Hono) - Server Actions não se aplicam aqui. `use client` nos formulários e páginas interativas. Componentes de listagem podem ser Server Components buscando via fetch direto ou tRPC SSR.

**Skill relevante:** `nextjs-advanced-routing` - relevante para entender `route.ts` e quando Server Actions fazem sentido. `nextjs-server-client-components` - crítico para evitar mistura incorreta de APIs.

### DT-7: Seed de categorias do sistema

Criar `packages/db/prisma/seed.ts` com as categorias padrão do spec (Moradia, Alimentação, Transporte, Saúde, Lazer, Serviços, Viagem, Outros). Executar como parte do setup inicial.

### DT-8: Convites por e-mail

Para v1: criar registro `GroupInvite` com token (ou usar o próprio `code` do grupo). O link `/join/[code]` funciona para qualquer método de convite. E-mail real (SMTP) fica para v2 - v1 apenas copia o link.

---

## Épicos e Tasks

---

### E1 - Foundation & Infra

#### T1.1 - Seed de categorias do sistema e migration inicial

**Dependências:** nenhuma

**Descrição:** Criar script de seed com as 8 categorias padrão e rodar a migration inicial contra o banco de dev.

**Critérios de aceite:**

- `packages/db/prisma/seed.ts` criado e executável via `pnpm --filter @cowcular/db exec prisma db seed`
- Categorias criadas com `isSystem: true` e `userId: null`: Moradia, Alimentação, Transporte, Saúde, Lazer, Serviços, Viagem, Outros
- `packages/db/package.json` contém script `"prisma": { "seed": "tsx prisma/seed.ts" }`
- Migration `init` executada com sucesso (`prisma migrate dev`)

**Decisão técnica:** DT-7

---

#### T1.2 - Variáveis de ambiente e setup local

**Dependências:** nenhuma

**Descrição:** Documentar e padronizar as env vars necessárias para rodar o projeto localmente.

**Critérios de aceite:**

- Arquivo `.env.example` na raiz com: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_API_URL`
- README atualizado com instruções de setup (clone → install → configure .env → migrate → seed → dev)
- `apps/api` e `apps/web` lendo as vars corretas

---

### E2 - Categories

#### T2.1 - Router de categorias

**Dependências:** T1.1

**Descrição:** Implementar `packages/trpc/src/routers/categories.ts` com as operações necessárias.

**Critérios de aceite:**

- `categories.list` retorna categorias do sistema + categorias do usuário autenticado
- `categories.create` cria categoria vinculada ao `userId` autenticado (isSystem: false)
- `categories.delete` exclui apenas categorias próprias do usuário (não pode excluir isSystem)
- Router registrado no `appRouter` em `packages/trpc/src/index.ts`

---

### E3 - Groups

#### T3.1 - Update de grupo e divisão padrão (Lar)

**Dependências:** nenhuma

**Descrição:** Procedures para editar nome do grupo e atualizar `defaultSplit` (Lar).

**Critérios de aceite:**

- `groups.update` permite admin alterar nome do grupo
- `groups.updateDefaultSplit` permite admin do Lar definir `defaultSplit` como JSON `{ memberId: percentage }`
- Validação: percentuais somam 100%, membroIds pertencem ao grupo e têm `leftAt: null`
- Não aplicável para Grupo Avulso (retorna erro claro)

---

#### T3.2 - Convites e ingresso por código

**Dependências:** nenhuma

**Descrição:** Permitir que usuários entrem em grupos via código alfanumérico.

**Critérios de aceite:**

- `groups.join` recebe `{ code: string }`, encontra grupo ACTIVE com aquele código, cria `GroupMember` para o usuário
- Retorna erro se: código inválido, grupo fechado, usuário já é membro ativo
- `groups.findByCode` retorna nome e tipo do grupo (público, sem auth) para exibir preview antes de entrar

---

#### T3.3 - Convites por username e e-mail

**Dependências:** T3.2

**Descrição:** Admin pode convidar usuários cadastrados por username ou e-mail.

**Critérios de aceite:**

- `groups.inviteByUsername` encontra usuário pelo username e cria `GroupMember` com `role: MEMBER`
- `groups.inviteByEmail` encontra usuário pelo e-mail e cria `GroupMember`
- Ambos retornam erro se: usuário não encontrado, já é membro ativo, chamador não é admin
- Notificação gerada para o usuário convidado (tipo: `GROUP_INVITE`)

---

#### T3.4 - Participantes externos (Grupo Avulso)

**Dependências:** nenhuma

**Descrição:** Admin ou membro pode adicionar participantes externos ao Grupo Avulso.

**Critérios de aceite:**

- `groups.addExternal` recebe `{ groupId, externalName, externalContact? }` e cria `GroupMember` com `userId: null`
- Só funciona para grupos `type: EVENT`
- `groups.removeExternal` remove participante externo apenas se não houver splits ou transfers associados a ele
- Participante externo aparece na listagem de membros do grupo com flag visual

---

#### T3.5 - Remoção de membro e transferência de admin

**Dependências:** nenhuma

**Descrição:** Admin pode remover membros e transferir a role de admin.

**Critérios de aceite:**

- `groups.removeMember` seta `leftAt: now()` no `GroupMember` - apenas admin pode executar
- Admin não pode remover a si mesmo se for o único admin (retorna erro)
- `groups.transferAdmin` troca a role: o chamador (atual admin) vira MEMBER, o target vira ADMIN
- Repasses pendentes do membro removido permanecem visíveis

---

#### T3.6 - Encerramento de Grupo Avulso com resumo

**Dependências:** T4.1

**Descrição:** Estender `groups.close` para gerar e retornar resumo de encerramento.

**Critérios de aceite:**

- Ao fechar grupo `EVENT`, retorna: saldo final por participante, repasses confirmados, pendentes e externos
- Grupo encerrado fica acessível em modo somente leitura (status: CLOSED)
- Notificação enviada para todos os membros (tipo: `GROUP_CLOSED`)
- `groups.list` não retorna grupos CLOSED por padrão; `groups.listClosed` retorna o histórico

---

### E4 - Accounts

#### T4.1 - Update e delete de contas

**Dependências:** nenhuma

**Descrição:** Procedures para editar e excluir contas.

**Critérios de aceite:**

- `accounts.update` permite editar título, valor, data, categoria, tipo, recorrência de conta própria ou do grupo onde o usuário é membro
- `accounts.delete` exclui conta e seus splits associados via cascade
- Não pode excluir conta com status `PAID` sem confirmação explícita (flag `force: true`)
- Edição de conta `PAID` exibe alerta (regra 4.8 do spec) - retornar flag `requiresConfirmation: true` se o mês estiver fechado

---

#### T4.2 - Auto-geração de repasses ao criar conta com splits

**Dependências:** nenhuma

**Descrição:** Ao criar uma conta com splits, calcular e gravar automaticamente os repasses entre membros.

**Critérios de aceite:**

- Se `paidByMemberId` está em `splits`, os outros membros devem repasses ao pagador
- Fórmula: `transfer.amount = (split.percentage / 100) * account.amount` para cada membro != pagador
- Todos os registros criados em uma única `ctx.db.$transaction`
- Se conta é pessoal (sem splits), nenhum transfer é gerado
- Transfers gerados com `month` e `year` a partir da `dueDate` da conta (ou data atual se sem dueDate)

**Regra de negócio crítica:** A divisão percentual prevalece sobre a divisão padrão do grupo (regra 1 do spec). Se nenhum `splits` for passado e o grupo tem `defaultSplit`, aplicar `defaultSplit` automaticamente.

---

#### T4.3 - Contas recorrentes e parceladas (Lar)

**Dependências:** T4.1

**Descrição:** Suporte a `RECURRING` e `INSTALLMENT` em grupos `HOME`.

**Critérios de aceite:**

- Conta `RECURRING`: ao fechar o mês, nova instância é criada automaticamente para o próximo mês com mesmos dados
- Conta `INSTALLMENT`: criação gera N registros onde N = `totalInstallments`, cada um com `installmentNumber` incrementado e `dueDate` incrementando 1 mês
- Apenas disponível para grupos `HOME` e contas pessoais (retorna erro se `groupId` aponta para `EVENT`)
- `accounts.list` aceita filtro por `recurrence`

---

### E5 - Transfers

#### T5.1 - Abatimento entre repasses

**Dependências:** T4.2

**Descrição:** Permitir que um repasse seja abatido por outro no sentido inverso.

**Critérios de aceite:**

- `transfers.offset` recebe `{ transferId, offsetWithTransferId }` - os dois transfers devem ser entre os mesmos membros em direções opostas
- Cria novo Transfer com `amount = |A - B|` na direção do maior, status `PENDING`
- Ambos os transfers originais recebem status `OFFSET` e `offsetTransferId` preenchido
- `transfers.list` inclui campo `netAmount` calculado considerando abatimentos da cadeia

---

#### T5.2 - Histórico de repasses por grupo e por usuário

**Dependências:** nenhuma

**Descrição:** Enriquecer `transfers.list` com filtros adicionais.

**Critérios de aceite:**

- Filtros: `groupId`, `status`, `month`, `year`, `memberId`
- Retorna repasses onde o usuário é `fromMember` OU `toMember`
- Campo calculado `direction: "sent" | "received"` relativo ao usuário autenticado
- Suporte a paginação via `cursor` e `limit`

---

### E6 - Monthly Balance (Lar)

#### T6.1 - Criação e fechamento manual de balanço mensal

**Dependências:** T4.2

**Descrição:** Implementar `packages/trpc/src/routers/balances.ts`.

**Critérios de aceite:**

- `balances.close` recebe `{ groupId, month, year }` - apenas admin de Lar pode executar
- Cria ou atualiza `MonthlyBalance` com `status: CLOSED`, `closedAt: now()`
- Calcula `totalExpense` somando contas do mês com `status: PAID`
- Calcula `totalByMember` com gasto individual de cada membro no período
- Notificação enviada para todos os membros (tipo: `MONTH_CLOSED`)
- Se `closingMode: AUTO`, executar `balances.close` automaticamente (ver T6.2)

---

#### T6.2 - Fechamento automático de balanço

**Dependências:** T6.1

**Descrição:** Implementar fechamento automático para Lares com `closingMode: AUTO`.

**Critérios de aceite:**

- Endpoint ou cron job que verifica Lares AUTO no dia 1 de cada mês
- Para cada Lar AUTO: chama a lógica de `balances.close` para o mês anterior
- Contas em aberto do mês anterior ficam com status OPEN (não são forçadas a PAID)
- Log de execução disponível para debug

**Decisão técnica:** Para v1 Vercel deploy, implementar como Vercel Cron Job (`/api/cron/monthly-close`) com `schedule: "0 1 1 * *"`. Configurar em `vercel.json`.

---

### E7 - Notifications

#### T7.1 - Router de notificações

**Dependências:** nenhuma (mas integrado em todas as mutations que geram eventos)

**Descrição:** Implementar `packages/trpc/src/routers/notifications.ts` e um helper server-side para criação.

**Critérios de aceite:**

- `notifications.list` retorna notificações do usuário autenticado ordenadas por `createdAt desc`
- `notifications.markRead` marca uma notificação como lida
- `notifications.markAllRead` marca todas como lidas
- Helper `createNotification(db, { userId, type, payload })` usado pelas mutations de domínio
- Tipos de notificação implementados: `GROUP_INVITE`, `NEW_ACCOUNT`, `TRANSFER_PENDING`, `TRANSFER_CONFIRMED`, `MONTH_CLOSED`, `MONTH_AWAITING_CLOSE`, `GROUP_CLOSED`, `ACCOUNT_DUE`

---

### E8 - User Profile

#### T8.1 - Perfil do usuário (update)

**Dependências:** nenhuma

**Descrição:** Procedures para editar perfil.

**Critérios de aceite:**

- `auth.updateProfile` permite editar `name`, `avatar` (URL), `defaultCurrency`
- Não permite mudar `email` ou `username` nesta versão
- `auth.changePassword` valida senha atual antes de permitir troca
- Retorna usuário atualizado com os campos públicos

---

### E9 - Frontend: Auth & Profile

**Skill relevante:** `nextjs-server-client-components` - verificar antes de criar os formulários de login/registro para garantir que `useSearchParams` e cookies são usados corretamente.

#### T9.1 - Tela de Login

**Dependências:** nenhuma (API de auth já funciona)

**Critérios de aceite:**

- Rota `/login` com formulário (identifier + senha)
- Submissão via `fetch` para `POST /auth/login` (Hono REST, não tRPC)
- Token salvo no Zustand store + `localStorage`
- Redirect para `/dashboard` após login
- Exibe erro de credenciais inválidas inline
- Link para `/register`

---

#### T9.2 - Tela de Cadastro

**Dependências:** nenhuma

**Critérios de aceite:**

- Rota `/register` com campos: nome, username, e-mail, senha, confirmar senha
- Validação client-side (username: alfanumérico, senha >= 8 chars)
- Submissão para `POST /auth/register`
- Redirect para `/login` após cadastro com mensagem de sucesso
- Exibe erro de e-mail/username duplicado

---

#### T9.3 - Middleware de autenticação

**Dependências:** T9.1

**Critérios de aceite:**

- `apps/web/src/middleware.ts` redireciona `/dashboard*`, `/groups*`, `/accounts*` para `/login` se sem token
- Redireciona `/login` e `/register` para `/dashboard` se já autenticado
- Token lido de cookie `auth_token` (salvo via `document.cookie` no login)

**Skill relevante:** `nextjs-app-router-fundamentals` - para o uso correto de middleware no App Router.

---

#### T9.4 - Tela de Perfil

**Dependências:** T8.1, T9.1

**Critérios de aceite:**

- Rota `/profile` com campos editáveis: nome, avatar (URL), moeda padrão
- Seção de troca de senha separada
- Feedback de sucesso/erro inline

---

### E10 - Frontend: Groups

**Skill relevante:** `nextjs-server-client-components` - listas de grupos e detalhes podem ser Server Components; formulários de criação e convite devem ser Client Components.

#### T10.1 - Listagem de grupos e criação

**Dependências:** T9.3 (middleware)

**Critérios de aceite:**

- Rota `/dashboard` exibe cards de todos os grupos ativos do usuário
- Modal/drawer de criação: escolha entre Lar ou Grupo Avulso, nome, tipo (se Avulso), modo de fechamento (se Lar)
- Card exibe nome, tipo, ícone (se Avulso), número de membros
- Link para página do grupo

---

#### T10.2 - Página do Lar

**Dependências:** T10.1

**Critérios de aceite:**

- Rota `/groups/[id]` com tabs: Contas, Repasses, Membros, Balanço
- Tab Contas: lista com filtro por mês, status, categoria
- Tab Membros: lista com roles, botão de convidar (admin), botão de remover (admin)
- Tab Balanço: histórico de balanços mensais, botão de fechar mês (admin)
- Header com nome do grupo, código de convite copiável

---

#### T10.3 - Página do Grupo Avulso

**Dependências:** T10.1

**Critérios de aceite:**

- Rota `/groups/[id]` (mesmo componente, layout adapta-se ao `type`)
- Tabs: Contas, Repasses, Participantes
- Tab Participantes: inclui externos com label visual diferente
- Botão de encerrar grupo (admin) com modal de resumo antes de confirmar
- Grupo encerrado exibe banner somente leitura

---

#### T10.4 - Fluxo de ingresso por código/link

**Dependências:** T3.2

**Critérios de aceite:**

- Rota `/join/[code]` exibe preview do grupo (nome, tipo) e botão "Entrar"
- Se não autenticado, redireciona para `/login?redirect=/join/[code]` e executa o join após login
- Exibe erro se código inválido ou grupo fechado

---

### E11 - Frontend: Accounts

#### T11.1 - Modal/formulário de criação de conta

**Dependências:** T10.2, T10.3

**Critérios de aceite:**

- Formulário com todos os campos do spec (título, valor, data, categoria, tipo, recorrência, parcelas, moeda, quem pagou, splits)
- No contexto de grupo: campos de divisão aparecem com membros do grupo pré-carregados
- Divisão igualitária ativada por padrão (Avulso) ou `defaultSplit` do Lar aplicado
- Validação: splits somam 100% (com feedback visual na soma)
- Submit via `trpc.accounts.create`

---

#### T11.2 - Listagem e detalhe de conta

**Dependências:** T11.1

**Critérios de aceite:**

- Lista com status colorido, valor, título, data, categoria
- Detalhe em drawer/modal: splits por membro, repasses gerados, histórico de adiamentos
- Ações: Marcar como pago, Adiar (Lar), Editar, Excluir

---

### E12 - Frontend: Transfers

#### T12.1 - Listagem e ações de repasses

**Dependências:** T10.2, T10.3

**Critérios de aceite:**

- Lista de repasses com status, valor, direção (devo / me devem), data
- Botão "Marcar como pago" para repasses enviados com status PENDING
- Botão "Confirmar recebimento" para repasses recebidos com status AWAITING_CONFIRMATION
- Indicador visual de repasses pendentes no header/sidebar

---

### E13 - Frontend: Dashboard Global

**Skill relevante:** `nextjs-server-client-components` - widgets de dados podem ser Server Components com Suspense para carregamento paralelo.

#### T13.1 - Dashboard Global com widgets

**Dependências:** T10.1, T11.2, T12.1

**Critérios de aceite:**

- Rota `/dashboard` com widgets:
  - Resumo do período (total gasto, total a pagar, repasses pendentes)
  - Próximos vencimentos (7 e 30 dias)
  - Repasses aguardando confirmação
  - Grupos avulsos com contas em aberto
  - Contas adiadas em aberto (Lares)
- Filtros: período, tipo de contexto, grupo específico, categoria, status

---

### E14 - Frontend: Relatórios

#### T14.1 - Tela de relatórios com gráficos

**Dependências:** T13.1

**Critérios de aceite:**

- Rota `/reports` com:
  - Gráfico de gastos por categoria (Recharts, série de 6 meses por padrão)
  - Gráfico de evolução mensal (comparativo mês a mês)
  - Tabela de balanço por membro (por grupo)
  - Tabela de histórico de repasses
- Filtros aplicáveis: período, grupo, categoria, membro, status
- Exportação de dados: **fora do escopo v1**

---

### E15 - Frontend: Notificações

#### T15.1 - Central de notificações in-app

**Dependências:** T7.1, T9.1

**Critérios de aceite:**

- Ícone no header com badge de contagem de não lidas
- Dropdown/page `/notifications` listando notificações com timestamp
- Clique na notificação navega para o contexto relevante (ex: grupo, repasse)
- "Marcar todas como lidas"
- Polling via `refetchInterval: 30_000` no React Query

---

## Dependências entre Tasks (resumo)

```
T1.1 ──► T2.1
T3.2 ──► T3.3
T4.2 ──► T5.1, T6.1
T6.1 ──► T6.2
T4.1 ──► T3.6
T9.1 ──► T9.3 ──► T10.1 ──► T10.2, T10.3, T10.4
T10.2 ──► T11.1 ──► T11.2
T11.2 ──► T12.1
T12.1, T11.2 ──► T13.1 ──► T14.1
T7.1 ──► T15.1
```

---

## Sugestão de Ordem de Implementação

### Sprint 1 - Backend Core

1. T1.1 - Seed e migration
2. T2.1 - Categories router
3. T4.2 - Auto-geração de repasses (crítico: habilita tudo que depende de transfers)
4. T4.1 - Update/delete de contas
5. T5.1 - Abatimento de repasses
6. T8.1 - Update de perfil

### Sprint 2 - Backend Groups & Balance

7. T3.1 - Update de grupo e defaultSplit
8. T3.2 + T3.3 - Convites
9. T3.4 - Participantes externos
10. T3.5 - Remoção de membro
11. T6.1 + T6.2 - Balanço mensal
12. T7.1 - Notificações

### Sprint 3 - Frontend Auth & Base

13. T9.1 + T9.2 - Login e Cadastro
14. T9.3 - Middleware
15. T10.1 - Listagem de grupos

### Sprint 4 - Frontend Groups & Accounts

16. T10.2 + T10.3 - Páginas de grupos
17. T10.4 - Ingresso por código
18. T11.1 + T11.2 - Contas
19. T12.1 - Repasses

### Sprint 5 - Frontend Dashboard & Polish

20. T9.4 - Perfil
21. T13.1 - Dashboard global
22. T14.1 - Relatórios
23. T15.1 - Notificações

---

## Fora do Escopo (v1)

- App mobile nativo
- Conversão automática de moedas
- Integração bancária / Open Finance
- OAuth / login social
- Exportação PDF/CSV
- Notificações por e-mail ou push
- Vinculação retroativa de participante externo
- Vinculação de conta T4.3 (recorrentes) ao fechamento automático (T6.2) - implementar como iteração pós-sprint 2
