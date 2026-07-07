-- ============================================================
-- CONTAS RECORRENTES INICIADAS COM VALOR ZERO (M-02)
-- ============================================================
-- zero_start marca séries recorrentes de valor variável (água,
-- luz): a conta nasce com amount = 0 e as ocorrências geradas
-- pelo job também nascem com valor 0, sem copiar o valor
-- preenchido em meses anteriores. Divisões mantêm os percentuais
-- com amount_due = 0 e nenhum repasse é gerado até o valor do mês
-- ser preenchido (M-01).

alter table public.accounts
  add column zero_start boolean not null default false;

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
    paid_by_member_id, origin_account_id, zero_start
  ) values (
    v_account.title,
    case when v_account.zero_start then 0 else v_account.amount end,
    v_account.currency, v_next_due,
    v_account.category_id, v_account.type, v_account.recurrence,
    v_account.total_installments,
    case when v_account.recurrence = 'INSTALLMENT'
         then coalesce(v_account.installment_number, 1) + 1 end,
    'OPEN', v_account.group_id, v_account.paid_by_member_id, v_account.id,
    v_account.zero_start
  )
  returning id into v_new_id;

  insert into public.account_splits (account_id, member_id, percentage, amount_due, status)
  select v_new_id, member_id, percentage,
         case when v_account.zero_start then 0 else amount_due end,
         'PENDING'
  from public.account_splits
  where account_id = v_account.id;

  if v_account.group_id is not null
     and v_account.paid_by_member_id is not null
     and not v_account.zero_start then
    insert into public.transfers (
      from_member_id, to_member_id, group_id, amount, currency, month, year, status,
      related_account_ids
    )
    select
      s.member_id, v_account.paid_by_member_id, v_account.group_id, s.amount_due,
      v_account.currency,
      extract(month from v_next_due)::integer,
      extract(year from v_next_due)::integer,
      'PENDING',
      array[v_new_id]
    from public.account_splits s
    where s.account_id = v_account.id
      and s.member_id <> v_account.paid_by_member_id
      and s.amount_due > 0;
  end if;

  return v_new_id;
end;
$$;
