-- ============================================================
-- GERAÇÃO AUTOMÁTICA DE OCORRÊNCIAS (RECURRING / INSTALLMENT)
-- ============================================================
-- Contas recorrentes e parceladas sempre têm a ocorrência do mês
-- seguinte pré-criada:
--   1. Na criação da conta, a API chama create_next_occurrence.
--   2. Na virada do mês (dia 1), o job pg_cron chama
--      generate_monthly_recurrences para criar as ocorrências do
--      mês seguinte de todas as séries ativas.
-- O fechamento mensal continua manual (admin) e não participa
-- desta geração.

-- Cria a ocorrência do mês seguinte de uma conta recorrente ou
-- parcelada, copiando splits e gerando os repasses do mês de
-- destino. Idempotente: se a série já tem ocorrência no mês de
-- destino (mesmo group_id + title + recurrence), não cria nada.
-- Retorna o id da conta criada, ou null se nada foi criado.
create or replace function public.create_next_occurrence(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account  public.accounts%rowtype;
  v_next_due date;
  v_new_id   uuid;
begin
  select * into v_account from public.accounts where id = p_account_id;
  if not found then
    return null;
  end if;

  if v_account.recurrence = 'ONCE' or v_account.due_date is null then
    return null;
  end if;

  -- Parcelada: só gera enquanto houver parcelas restantes
  if v_account.recurrence = 'INSTALLMENT' then
    if v_account.total_installments is null
       or coalesce(v_account.installment_number, 1) >= v_account.total_installments then
      return null;
    end if;
  end if;

  v_next_due := (v_account.due_date + interval '1 month')::date;

  -- Idempotência: a série já tem ocorrência no mês de destino?
  if exists (
    select 1 from public.accounts
    where group_id is not distinct from v_account.group_id
      and title = v_account.title
      and recurrence = v_account.recurrence
      and due_date >= date_trunc('month', v_next_due)::date
      and due_date <  (date_trunc('month', v_next_due) + interval '1 month')::date
  ) then
    return null;
  end if;

  insert into public.accounts (
    title, amount, currency, due_date, category_id, type, recurrence,
    total_installments, installment_number, status, group_id,
    paid_by_member_id, origin_account_id
  ) values (
    v_account.title, v_account.amount, v_account.currency, v_next_due,
    v_account.category_id, v_account.type, v_account.recurrence,
    v_account.total_installments,
    case when v_account.recurrence = 'INSTALLMENT'
         then coalesce(v_account.installment_number, 1) + 1 end,
    'OPEN', v_account.group_id, v_account.paid_by_member_id, v_account.id
  )
  returning id into v_new_id;

  insert into public.account_splits (account_id, member_id, percentage, amount_due, status)
  select v_new_id, member_id, percentage, amount_due, 'PENDING'
  from public.account_splits
  where account_id = v_account.id;

  if v_account.group_id is not null and v_account.paid_by_member_id is not null then
    insert into public.transfers (
      from_member_id, to_member_id, group_id, amount, currency, month, year, status
    )
    select
      s.member_id, v_account.paid_by_member_id, v_account.group_id, s.amount_due,
      v_account.currency,
      extract(month from v_next_due)::integer,
      extract(year from v_next_due)::integer,
      'PENDING'
    from public.account_splits s
    where s.account_id = v_account.id
      and s.member_id <> v_account.paid_by_member_id
      and s.amount_due > 0;
  end if;

  return v_new_id;
end;
$$;

-- Varre as séries recorrentes/parceladas do mês corrente (e do mês
-- anterior, para recuperar viradas perdidas) e cria as ocorrências
-- do mês seguinte de cada uma. Retorna o total de contas criadas.
create or replace function public.generate_monthly_recurrences()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_created integer := 0;
begin
  for v_row in
    select id from public.accounts
    where recurrence in ('RECURRING', 'INSTALLMENT')
      and due_date >= (date_trunc('month', current_date) - interval '1 month')::date
      and due_date <  (date_trunc('month', current_date) + interval '1 month')::date
    order by due_date
  loop
    if public.create_next_occurrence(v_row.id) is not null then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

-- Job mensal: dia 1 às 03:00 UTC (meia-noite em America/Sao_Paulo).
-- Guardado por pg_available_extensions para não quebrar ambientes
-- sem pg_cron.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'generate-recurring-accounts',
      '0 3 1 * *',
      'select public.generate_monthly_recurrences()'
    );
  else
    raise notice 'pg_cron indisponível; job generate-recurring-accounts não agendado';
  end if;
end;
$$;

-- Backfill: gera imediatamente as ocorrências do mês seguinte para
-- as séries existentes que ainda não as possuem.
select public.generate_monthly_recurrences();
