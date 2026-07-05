-- ============================================================
-- QUITAÇÃO DE REPASSES POR ABATIMENTO (SETTLEMENTS)
-- ============================================================
-- Registra a quitação dos repasses de um período: quando o valor
-- líquido final (após abatimentos mútuos) é pago, todos os
-- repasses pendentes do período são marcados como OFFSET e os
-- splits pendentes das contas do período como PAID.
-- Dados existentes não são alterados: a coluna settlement_id em
-- transfers é opcional e começa nula em todos os registros.

create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  month         integer check (month between 1 and 12),
  year          integer check (year >= 2020),
  settled_by    uuid references public.profiles(id) on delete set null,
  net_transfers jsonb not null default '[]'::jsonb,
  total_amount  numeric(12, 2) not null default 0,
  created_at    timestamptz not null default now(),
  -- month/year nulos = quitação de grupo avulso (EVENT), sem período
  constraint settlements_period check (
    (month is null and year is null) or (month is not null and year is not null)
  )
);

alter table public.settlements enable row level security;

create index settlements_group_period_idx on public.settlements(group_id, year, month);

create policy "Group members can view settlements"
  on public.settlements for select
  using (
    auth.uid() is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Group members can create settlements"
  on public.settlements for insert
  with check (
    auth.uid() is not null
    and public.is_group_member(group_id, auth.uid())
  );

-- Vincula cada repasse encerrado ao registro de quitação que o abateu
alter table public.transfers
  add column settlement_id uuid references public.settlements(id) on delete set null;

create index transfers_settlement_idx on public.transfers(settlement_id);
