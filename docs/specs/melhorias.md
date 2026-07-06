# Spec - Melhorias de Grupos

Especificação incremental sobre a [spec v1](./spec-v1.md). Cobre melhorias na experiência de grupos: contas, parcelamento, repasses, membros e nomenclatura das tabs.

## 1. Visão Geral

As melhorias abaixo refinam funcionalidades já existentes na página de grupo (`/groups/[id]`) e na página global de repasses (`/repasses`). Nenhuma delas altera o modelo de grupos (Lar / Grupo Avulso) definido na spec v1.

| ID   | Área         | Melhoria                                            |
| ---- | ------------ | --------------------------------------------------- |
| M-01 | Contas       | Lançamento de contas com valor zero                 |
| M-02 | Contas       | Contas recorrentes iniciadas com valor zero         |
| M-03 | Parcelamento | Exibição de parcela atual + restantes               |
| M-04 | Parcelamento | Adiantamento de parcelas e repasses parcelados      |
| M-05 | Repasses     | Cabeçalho de filtros na listagem de repasses        |
| M-06 | Repasses     | Campos de descrição e origem do repasse             |
| M-07 | Membros      | Papel de creator com precedência sobre admin        |
| M-08 | Membros      | Gestão de permissões de admin por admins            |
| M-09 | Tabs         | Renomear tab "Resumo" para "Balanço"                |
| M-10 | Tabs         | Renomear tab "Balanço" para "Histórico"             |

## 2. Contas

### M-01 - Lançamento de contas com valor zero

**Estado atual:** o formulário de nova conta exige valor maior que zero.

**Requisitos:**

- Permitir o cadastro de contas com `amount = 0` em qualquer contexto (pessoal, Lar, Grupo Avulso).
- Contas com valor zero não geram repasses (não há o que dividir).
- O valor pode ser editado posteriormente; a edição para valor > 0 recalcula divisões e repasses normalmente.

**Critérios de aceite:**

- Uma conta com valor 0 é salva sem erro de validação.
- Nenhum registro de repasse é criado enquanto o valor for 0.

### M-02 - Contas recorrentes iniciadas com valor zero

**Estado atual:** contas recorrentes (permanentes) herdam o valor informado no cadastro em todas as ocorrências geradas.

**Requisitos:**

- Incluir um checkbox no formulário de conta recorrente: **"Iniciar com valor zero"** (nome final a definir no design).
- Quando marcado, a conta é criada com `amount = 0` e as ocorrências futuras também nascem com valor 0, aguardando preenchimento manual mês a mês.
- Caso de uso: contas de valor variável (água, luz) cujo valor só é conhecido na chegada da fatura.

**Critérios de aceite:**

- O checkbox só aparece quando a recorrência selecionada é "recorrente".
- Ocorrências geradas pelo job de virada de mês respeitam o valor zero e não copiam valor de meses anteriores.
- Ao preencher o valor de uma ocorrência, divisões e repasses daquele mês são calculados normalmente (M-01).

## 3. Parcelamento

### M-03 - Exibição de parcela atual + restantes

**Estado atual:** lançamentos parcelados não deixam claro o progresso do parcelamento na listagem.

**Requisitos:**

- Toda conta do tipo parcelado deve exibir a parcela atual e o total, no formato `parcela atual/total` (ex.: `3/12`), nas listagens e no detalhe da conta.
- A informação deriva dos campos já existentes `installment_number` e `total_installments`.

**Critérios de aceite:**

- Listagem de contas do grupo e dashboard exibem o indicador de parcela para contas parceladas.
- O indicador não aparece para contas únicas ou recorrentes.

### M-04 - Adiantamento de parcelas e repasses parcelados

**Estado atual:** o parcelamento é imutável após o cadastro; parcelas futuras só existem quando geradas pelo job mensal.

**Requisitos:**

- Permitir alterações em um parcelamento em aberto, cobrindo dois fluxos de adiantamento:
  1. **Adiantamento de parcelas:** quitar uma ou mais parcelas futuras antes do mês de vencimento.
  2. **Adiantamento de repasses de parcelados:** permitir que um membro pague antecipadamente os repasses vinculados a parcelas futuras.

**Regras de negócio:**

- Parcelas adiantadas mantêm referência à conta de origem e ao mês originalmente previsto (rastreabilidade, mesmo princípio do adiamento na spec v1).
- Uma parcela adiantada não deve ser gerada novamente pelo job de virada de mês.
- Repasses adiantados seguem o fluxo bilateral padrão (marcação de pago + confirmação).

**Pontos em aberto (validar antes da implementação):**

- Se o adiantamento de parcela antecipa apenas o pagamento ou também o vencimento contábil (em que mês a despesa conta no balanço).
- Se é permitido adiantar parcelas fora de ordem (ex.: quitar a parcela 5 antes da 4).
- Impacto no fechamento mensal de meses futuros que já teriam parcelas quitadas.

## 4. Repasses

### M-05 - Cabeçalho de filtros na listagem de repasses

**Estado atual:** a página global `/repasses` possui filtros de direção (enviados/recebidos) e status; a tab Repasses dentro da página do grupo lista tudo sem filtro algum.

**Requisitos:**

- Incluir cabeçalho de filtros na tab Repasses do grupo, no mínimo com:
  - Direção: todos / enviados / recebidos.
  - Status: pendente, aguardando confirmação, confirmado, abatido.
  - Período (mês/ano), para Lares.
- Reaproveitar o padrão visual e de componentes já usado em `/repasses`.

**Critérios de aceite:**

- Filtros combinam entre si (direção + status + período).
- Estado vazio distingue "nenhum repasse no grupo" de "nenhum repasse com os filtros aplicados".

### M-06 - Campos de descrição e origem do repasse

**Estado atual:** o repasse exibe apenas membros envolvidos, valor e status; a conta que o originou não é visível na listagem.

**Requisitos:**

- Exibir em cada repasse (listagem e detalhe):
  - **Origem:** conta ou evento que gerou o repasse (a partir de `relatedAccountIds`).
  - **Data de origem:** data da conta/lançamento que originou o repasse.
  - **Descrição:** texto livre opcional, preenchível ao marcar o repasse como pago (ex.: "pago via Pix").

**Critérios de aceite:**

- Repasses gerados por múltiplas contas listam todas as origens.
- A descrição é persistida e visível para ambos os membros do repasse.

## 5. Membros

### M-07 - Papel de creator

**Estado atual:** os papéis são apenas `ADMIN | MEMBER`. O criador do grupo vira admin na criação, mas não é distinguível dos demais admins e pode ter o próprio admin removido.

**Requisitos:**

- Identificar o criador do grupo com uma **tag "creator"** visível na tab Membros.
- O creator tem precedência sobre todas as outras permissões:
  - Não pode ser removido do grupo por ninguém.
  - Não pode ter o papel de admin revogado.
  - Mantém acesso de admin mesmo que outro admin tente rebaixá-lo.

**Regras de negócio:**

- Existe exatamente um creator por grupo, definido na criação e imutável.
- O creator acumula todas as permissões de admin da spec v1 (seção 4.2).
- Modelagem sugerida: novo valor `CREATOR` no enum de `role` em `GroupMember`, ou flag booleana no membro; a escolha deve considerar as migrations e checagens de permissão existentes na API (`role !== "ADMIN"`), que passariam a aceitar creator.

**Critérios de aceite:**

- A tag aparece junto à tag de admin na listagem de membros.
- Endpoints de alteração de papel e remoção de membro retornam erro ao alvejar o creator.

### M-08 - Gestão de permissões de admin

**Estado atual:** a UI já possui o toggle "Tornar admin / Remover admin" na tab Membros, e a remoção de membros é restrita a admins e ao próprio membro.

**Requisitos:**

- Consolidar as permissões de admin sobre membros:
  - Adicionar e remover membros do grupo.
  - Conceder e revogar permissão de admin de outros usuários.
- Garantir que essas ações estejam protegidas na API (não apenas na UI) e respeitem a precedência do creator (M-07).

**Regras de negócio:**

- Um admin não pode revogar o admin do creator nem removê-lo (M-07).
- O grupo deve sempre ter ao menos um admin; o creator satisfaz essa condição por definição.

## 6. Nomenclatura das Tabs

As tabs da página do grupo serão renomeadas. A ordem de aplicação importa: M-10 deve ser aplicada junto ou antes de M-09, pois o nome "Balanço" muda de dono.

### M-09 - Tab "Resumo" passa a ser "Balanço"

- A tab atualmente chamada **Resumo** (`PreviewTab`: prévia de saldos do período, com ação de quitação) passa a se chamar **Balanço**.
- Apenas mudança de rótulo; comportamento inalterado.

### M-10 - Tab "Balanço" passa a ser "Histórico"

- A tab atualmente chamada **Balanço** (`BalanceTab`, exclusiva do Lar: fechamentos mensais registrados) passa a se chamar **Histórico**.
- Apenas mudança de rótulo; comportamento inalterado.

**Resultado final das tabs:**

| Tab (antes) | Tab (depois) | Conteúdo                                    | Contexto      |
| ----------- | ------------ | ------------------------------------------- | ------------- |
| Contas      | Contas       | Listagem e gestão de contas                 | Ambos         |
| Repasses    | Repasses     | Repasses do grupo (com filtros, M-05)       | Ambos         |
| Membros     | Membros      | Membros, tags de papel (M-07, M-08)         | Ambos         |
| Balanço     | Histórico    | Fechamentos mensais registrados             | Somente Lar   |
| Resumo      | Balanço      | Prévia de saldos do período + quitação      | Ambos         |

## 7. Fora do Escopo

- Alterações no modelo de grupos (Lar / Grupo Avulso) e no fluxo de fechamento mensal.
- Transferência do papel de creator para outro membro (candidato a melhoria futura).
- Filtros na página global `/repasses` além dos já existentes.
