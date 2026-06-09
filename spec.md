# Spec — Cowcular

## 1. Visão Geral

Sistema web de controle financeiro que permite ao usuário gerenciar suas finanças pessoais e participar de grupos de divisão de contas com outras pessoas. O sistema suporta dois modelos de grupo com comportamentos distintos:

- **Lar:** grupo permanente com fechamento mensal, histórico contínuo e divisão padrão configurável. Caso de uso principal: casais e colegas de moradia.
- **Grupo Avulso:** grupo temporário focado em um evento ou contexto específico, sem ciclo mensal. Caso de uso: viagens, churrascos, bares, presentes coletivos, vaquinhas, despesas informais entre amigos.

Cada usuário tem uma visão pessoal das suas finanças e acesso independente a cada grupo que participa, com um dashboard unificado que agrega tudo com filtros.

## 2. Conceitos Centrais

| Conceito                  | Descrição                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Usuário**               | Pessoa com conta no sistema. Possui username único.                                         |
| **Lar**                   | Grupo permanente com fechamento mensal recorrente. Membros são sempre usuários cadastrados. |
| **Grupo Avulso**          | Grupo temporário, sem ciclo mensal. Aceita participantes externos sem cadastro.             |
| **Participante Externo**  | Pessoa sem conta no sistema adicionada manualmente a um Grupo Avulso (nome + valor).        |
| **Conta**                 | Despesa ou receita registrada. Pode ser pessoal, de um Lar ou de um Grupo Avulso.           |
| **Divisão**               | Regra que define quanto cada participante paga em uma conta (percentual ou igualitário).    |
| **Repasse**               | Valor que um participante deve transferir para outro em função de uma divisão.              |
| **Fechamento Mensal**     | Consolidação do balanço de um mês em um Lar (manual ou automático).                         |
| **Encerramento de Grupo** | Ato de fechar um Grupo Avulso quando todas as contas estão quitadas.                        |

## 3. Tipos de Grupo

### 3.1 Lar

Grupo de longa duração para despesas domésticas recorrentes.

**Características exclusivas do Lar:**

- Fechamento mensal (automático ou manual pelo admin).
- Divisão padrão persistente entre membros (sobrescrita por conta individualmente).
- Suporte a contas recorrentes e parceladas.
- Balanço mensal com histórico contínuo.
- Adiamento de contas para meses futuros.
- Apenas usuários cadastrados podem ser membros.

### 3.2 Grupo Avulso

Grupo temporário criado para um contexto específico e finito.

**Tipos pré-definidos** (apenas visual/semântico, sem diferença funcional entre eles):

| Tipo              | Ícone sugerido | Exemplos                      |
| ----------------- | -------------- | ----------------------------- |
| Viagem            | ✈️             | Férias, fim de semana fora    |
| Churrasco / Bar   | 🍖             | Happy hour, jantar em grupo   |
| Presente Coletivo | 🎁             | Vaquinha de aniversário       |
| Vaquinha          | 💰             | Qualquer arrecadação informal |
| Despesas Gerais   | 📋             | Outros contextos temporários  |

**Características exclusivas do Grupo Avulso:**

- Sem fechamento mensal — existe até ser encerrado manualmente pelo admin.
- Divisão **igualitária por padrão**, com opção de customizar por conta ou por participante.
- Aceita **participantes externos** (sem cadastro): registrados com nome e valor, sem fluxo bilateral de confirmação.
- Participantes externos podem ser registrados tanto como devedores quanto como quem pagou uma conta.
- Convite por link direto (compartilhável via WhatsApp, etc.), código, e-mail ou username.
- Contas são sempre únicas (sem recorrência ou parcelamento).
- Encerramento gera um resumo final de quem deve quanto a quem.

## 4. Funcionalidades

### 4.1 Autenticação e Perfil

- Cadastro com nome, e-mail, username único e senha.
- Login via e-mail **ou** username + senha.
- Perfil editável: nome, avatar, moeda padrão (padrão: BRL).
- Sem OAuth nesta versão.

### 4.2 Criação e Gestão de Grupos

#### Criação

- O usuário escolhe entre criar um **Lar** ou um **Grupo Avulso**.
- Para Grupo Avulso, seleciona o tipo (Viagem, Churrasco, etc.) — apenas etiqueta visual.
- Ao criar qualquer grupo, o criador torna-se **admin** automaticamente.
- Cada grupo recebe um **código alfanumérico único** gerado automaticamente.

#### Convites e Ingresso

| Método                              | Lar | Grupo Avulso |
| ----------------------------------- | --- | ------------ |
| Link direto (WhatsApp, etc.)        | ✅  | ✅           |
| Código do grupo                     | ✅  | ✅           |
| Busca por username                  | ✅  | ✅           |
| Convite por e-mail                  | ✅  | ✅           |
| Participante externo (sem cadastro) | ❌  | ✅           |

#### Permissões de Admin (ambos os tipos)

| Ação                         | Membro | Admin |
| ---------------------------- | ------ | ----- |
| Ver contas do grupo          | ✅     | ✅    |
| Adicionar contas ao grupo    | ✅     | ✅    |
| Convidar membros             | ❌     | ✅    |
| Remover membros              | ❌     | ✅    |
| Editar divisão padrão        | ❌     | ✅    |
| Fechar mês manualmente (Lar) | ❌     | ✅    |
| Encerrar grupo (Avulso)      | ❌     | ✅    |
| Excluir o grupo              | ❌     | ✅    |

#### Saída e Histórico

- Membros podem sair voluntariamente de qualquer grupo.
- O histórico de participação é preservado com identificação do período de presença.
- Repasses pendentes do membro que saiu permanecem visíveis até resolução.

### 4.3 Participantes Externos (Grupo Avulso)

- Adicionados pelo admin ou qualquer membro com nome e, opcionalmente, contato.
- Podem figurar como **quem pagou** ou como **devedor** em uma conta.
- Repasses envolvendo externos são registrados unilateralmente — sem confirmação bilateral.
- Se o participante externo criar conta no sistema e entrar no grupo, o histórico de participação pode ser vinculado ao seu perfil (a ser confirmado em implementação).

### 4.4 Categorias

- O sistema fornece uma **lista padrão**: Moradia, Alimentação, Transporte, Saúde, Lazer, Serviços, Viagem, Outros.
- Cada usuário pode criar **categorias personalizadas** vinculadas ao seu perfil.
- Categorias são usadas em relatórios e filtros em todos os contextos.

### 4.5 Contas (Despesas e Receitas)

#### Tipos por contexto

| Tipo                    | Pessoal | Lar         | Grupo Avulso |
| ----------------------- | ------- | ----------- | ------------ |
| Despesa única           | ✅      | ✅          | ✅           |
| Despesa recorrente fixa | ✅      | ✅          | ❌           |
| Despesa parcelada       | ✅      | ✅          | ❌           |
| Receita                 | ✅      | ✅ (opt-in) | ❌           |

#### Campos de uma Conta

- Título
- Valor total / Valor por parcela
- Data de vencimento / data do evento
- Categoria
- Tipo (despesa / receita)
- Tipo de recorrência: única, recorrente, parcelada (Lar e pessoal)
- Número de parcelas (se parcelada)
- Moeda (herdada do perfil, editável por conta)
- Status: **Em aberto**, **Pago**, **Adiado** (Lar) / **Encerrado** (Avulso)
- Quem pagou (usuário cadastrado ou participante externo)
- Participantes da divisão

#### Divisão por Conta

**No Lar:**

- A divisão padrão do Lar é aplicada automaticamente.
- Pode ser sobrescrita por conta em porcentagem por membro (deve somar 100%).

**No Grupo Avulso:**

- Divisão igualitária aplicada por padrão entre os participantes selecionados.
- Pode ser customizada por conta: porcentagens diferentes por participante (deve somar 100%).
- Exemplo: batata frita pedida por 3 de 5 pessoas → apenas os 3 entram na divisão daquela conta.

### 4.6 Repasses

O sistema calcula automaticamente os repasses devidos ao registrar uma conta compartilhada.

**Exemplo:** A pagou R$200 dividido 60/40 com B → B deve R$80 para A.

#### Fluxo para Usuários Cadastrados (Bilateral)

1. Membro A marca o repasse como "pago".
2. Membro B recebe notificação in-app e confirma o recebimento.
3. Sem confirmação: status fica **"Aguardando confirmação"** indefinidamente.

#### Fluxo para Participantes Externos (Unilateral)

- O membro que gerencia o grupo registra o pagamento diretamente, sem necessidade de confirmação.

#### Abatimento de Repasses

- Um repasse pode ser **abatido** em outro repasse ou conta no sentido inverso.
- O sistema calcula o saldo residual e exibe quanto ainda resta a pagar após o abate.
- Histórico completo de abatimentos disponível por repasse.

### 4.7 Adiamento (exclusivo do Lar)

- Contas em aberto ou repasses não resolvidos podem ser **adiados para outro mês**.
- O item original recebe status **"Adiado"** e permanece no mês de origem para rastreabilidade.
- No mês de destino, uma nova entrada é criada com referência ao item e mês de origem.
- Valores adiados também podem ser usados para abater contas de outros meses.

### 4.8 Fechamento Mensal (exclusivo do Lar)

- Configurado por Lar, independente de outros Lares do usuário.
- **Modo automático:** sistema fecha o mês ao virar a data.
- **Modo manual:** admin aprova o fechamento; mês fica "em aberto" sem bloquear operações.
- Edições pós-fechamento são permitidas com alerta de confirmação.
- **Balanço gerado inclui:**
  - Total gasto por categoria (Lar e individual).
  - Total de repasses realizados e pendentes.
  - Saldo de cada membro.
  - Contas adiadas do mês anterior que entraram neste mês.

### 4.9 Encerramento de Grupo Avulso

- Admin encerra o grupo manualmente.
- O sistema exibe um **resumo de encerramento**: saldo final de cada participante, repasses confirmados, pendentes e externos.
- Grupo encerrado fica acessível em modo somente leitura no histórico do usuário.

### 4.10 Dashboard

#### Estrutura

- Cada grupo (Lar ou Avulso) tem sua **própria página** com visão completa das contas e repasses.
- O **Dashboard Global** agrega todas as despesas do usuário — pessoais e de grupos — com filtros.

#### Filtros do Dashboard Global

- Período
- Tipo de contexto: pessoal, Lar, Grupo Avulso, todos
- Grupo específico
- Categoria
- Status

#### Widgets do Dashboard Global

- Resumo do período: total gasto, total a pagar, repasses pendentes.
- Próximos vencimentos (7 e 30 dias).
- Repasses aguardando confirmação.
- Grupos avulsos com contas em aberto.
- Contas adiadas em aberto (Lares).

### 4.11 Relatórios

- **Gastos por categoria:** série histórica de 6 meses por padrão, ajustável.
- **Evolução mensal:** comparativo mês a mês.
- **Balanço por membro:** quanto cada pessoa gastou e deve/tem a receber (por grupo).
- **Histórico de repasses:** pagos, abatidos, pendentes, externos.
- **Histórico de grupos avulsos encerrados.**
- **Histórico de contas adiadas** (Lar): rastreabilidade de origem e destino.

Filtros aplicáveis: período, grupo, categoria, membro, status.

### 4.12 Notificações (In-App)

| Evento                                             | Quem recebe                      |
| -------------------------------------------------- | -------------------------------- |
| Convite para entrar em um grupo                    | Usuário convidado                |
| Nova conta adicionada ao grupo                     | Membros do grupo                 |
| Repasse marcado como pago (aguardando confirmação) | Membro que deve confirmar        |
| Repasse confirmado                                 | Membro que registrou o pagamento |
| Mês fechado automaticamente (Lar)                  | Todos os membros do Lar          |
| Mês aguardando fechamento manual (Lar)             | Admin do Lar                     |
| Grupo Avulso encerrado                             | Todos os membros                 |
| Conta com vencimento próximo (3 dias)              | Responsáveis pela conta          |

## 5. Regras de Negócio

1. A divisão percentual por conta prevalece sobre a divisão padrão do grupo.
2. A divisão de uma conta compartilhada deve sempre somar 100%.
3. Receitas são sempre privadas por padrão; o usuário pode optar por compartilhá-las no Lar.
4. Um membro que saiu do grupo não aparece em novas contas, mas permanece no histórico.
5. Repasses entre usuários cadastrados só são considerados quitados após confirmação bilateral.
6. Repasses envolvendo participantes externos são unilaterais, sem confirmação.
7. Valores adiados sempre mantêm referência ao mês de origem (Lar).
8. O fechamento de mês é por Lar; cada Lar tem seu ciclo independente.
9. Grupos Avulsos não têm ciclo mensal — existem até encerramento manual.
10. Moeda é definida por conta; conversões não são realizadas automaticamente.
11. Participantes externos não têm acesso ao sistema e não recebem notificações.

## 6. Stack

### Frontend

- **Next.js 16 (App Router)** — SSR/SSG, rotas, middleware de autenticação.
- **TypeScript** — tipagem estática.
- **Tailwind CSS v4** — estilização.
- **Recharts** — gráficos do dashboard.
- **Zustand** — estado global leve (usuário autenticado).
- **TanStack Query v5** — cache e sincronização de dados do servidor.

### Backend / API

- **Next.js API Route Handlers** — lógica de negócio exposta via `/api/*`.
- **Supabase** — banco de dados PostgreSQL gerenciado + Auth + RLS.
- **`@supabase/ssr`** — cliente com gerenciamento de sessão via cookies (middleware + API routes).
- **`@supabase/supabase-js`** — cliente admin (service role) para operações sem RLS.

### Autenticação

- **Supabase Auth** — credentials provider (e-mail + senha). Login por username resolvido via lookup server-side. Extensível para OAuth no futuro.

### Infraestrutura

- **Vercel** — deploy do frontend/API.
- **Supabase** — banco de dados, autenticação e armazenamento.
- **Cloudflare** (opcional) — DNS e CDN.

## 7. Modelagem de Dados (Esboço)

```
User
  id, username (unique), email (unique), name, avatar, defaultCurrency

Group
  id, name, type (HOME | EVENT), eventType (TRIP | BBQ | GIFT | FUNDRAISER | GENERAL | null)
  code (unique), status (ACTIVE | CLOSED)
  defaultSplit (JSON: { memberId: percentage } — HOME only)
  closingMode (AUTO | MANUAL — HOME only)
  closedAt (nullable)

GroupMember
  id, groupId, userId (nullable), externalName (nullable), externalContact (nullable)
  role (ADMIN | MEMBER), joinedAt, leftAt
  -- userId null = participante externo

Account (Conta)
  id, title, amount, currency, dueDate, categoryId
  type (EXPENSE | INCOME), recurrence (ONCE | RECURRING | INSTALLMENT)
  totalInstallments, installmentNumber
  status (OPEN | PAID | DEFERRED | CLOSED)
  groupId (nullable), paidByMemberId
  originAccountId (nullable — para adiamentos), originMonth (nullable)
  createdAt, updatedAt

AccountSplit (Divisão por conta)
  id, accountId, memberId, percentage, amountDue, amountPaid, status

Transfer (Repasse)
  id, fromMemberId, toMemberId, groupId, amount, currency
  month (nullable), year (nullable)
  status (PENDING | AWAITING_CONFIRMATION | CONFIRMED | OFFSET | EXTERNAL_PAID)
  relatedAccountIds (array), offsetTransferId (nullable)
  createdAt, confirmedAt

Category
  id, name, icon, isSystem (bool), userId (nullable — null = sistema)

Notification
  id, userId, type, payload (JSON), read, createdAt

MonthlyBalance (HOME only)
  id, groupId, month, year, status (OPEN | CLOSED)
  totalExpense, totalByMember (JSON), closedAt
```

**Nota de modelagem:** `GroupMember` unifica membros cadastrados e externos. Quando `userId` é nulo, trata-se de um participante externo identificado por `externalName`. Isso permite que `AccountSplit` e `Transfer` referenciem qualquer tipo de participante com a mesma chave `memberId`.

## 8. Telas Principais

1. **Login / Cadastro**
2. **Dashboard Global** — visão agregada com filtros por contexto e grupo
3. **Página do Lar** — contas, balanço mensal, membros, repasses
4. **Página do Grupo Avulso** — contas do evento, saldo por participante, encerramento
5. **Contas** — listagem, criação, edição, detalhe (por grupo ou pessoal)
6. **Repasses** — pendentes, aguardando confirmação, histórico
7. **Relatórios** — gráficos e filtros
8. **Notificações** — central in-app
9. **Perfil / Configurações**

## 9. Fora do Escopo (v1)

- App mobile nativo (web responsivo suficiente para v1).
- Conversão automática de moedas.
- Integração com bancos ou Open Finance.
- OAuth / login social.
- Exportação de dados (PDF, CSV) — candidato para v2.
- Notificações por e-mail ou push — candidato para v2.
- Vinculação retroativa de participante externo ao criar conta no sistema — candidato para v2.

## 10. Nome do Produto

**Cowcular**

Trocadilho triplo em uma única palavra:

| Camada       | Significado                                                         |
| ------------ | ------------------------------------------------------------------- |
| **Cow**      | A vaca — mascote, tom bem-humorado, identidade visual               |
| **Calcular** | A função central do produto — calcular divisões, repasses, balanços |
| **Lar**      | O conceito âncora — moradia compartilhada, onde o produto nasceu    |

Funciona também como **verbo de uso cotidiano** ("vamos cowcular isso"), o que reforça a adoção orgânica do nome. Tom acessível e informal, alinhado ao público-alvo (casais, amigos, grupos domésticos). Identidade visual baseada em paleta âmbar/teal com mascote geométrico.
