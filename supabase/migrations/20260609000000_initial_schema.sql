
-- ============================================================
-- ENUMS
-- ============================================================
create type public.group_type    as enum ('HOME', 'EVENT');
create type public.event_type    as enum ('TRIP', 'BBQ', 'GIFT', 'FUNDRAISER', 'GENERAL');
create type public.group_status  as enum ('ACTIVE', 'CLOSED');
create type public.closing_mode  as enum ('AUTO', 'MANUAL');
create type public.member_role   as enum ('ADMIN', 'MEMBER');
create type public.account_type  as enum ('EXPENSE', 'INCOME');
create type public.recurrence    as enum ('ONCE', 'RECURRING', 'INSTALLMENT');
create type public.account_status as enum ('OPEN', 'PAID', 'DEFERRED', 'CLOSED');
create type public.split_status  as enum ('PENDING', 'PAID');
create type public.transfer_status as enum (
  'PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'OFFSET', 'EXTERNAL_PAID'
);
create type public.balance_status as enum ('OPEN', 'CLOSED');

-- ============================================================
-- SHARED TRIGGER: set_updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique,
  name             text not null,
  email            text not null,
  avatar           text,
  default_currency text not null default 'BRL',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- GROUPS
-- ============================================================
create table public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          public.group_type not null default 'HOME',
  event_type    public.event_type,
  code          text not null unique,
  status        public.group_status not null default 'ACTIVE',
  closing_mode  public.closing_mode,
  default_split jsonb,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.groups enable row level security;

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
-- user_id null = participante externo (sem conta no sistema)
create table public.group_members (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,
  external_name    text,
  external_contact text,
  role             public.member_role not null default 'MEMBER',
  joined_at        timestamptz not null default now(),
  left_at          timestamptz,
  constraint must_have_identity check (
    user_id is not null or external_name is not null
  )
);

alter table public.group_members enable row level security;

create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx  on public.group_members(user_id);

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id
      and user_id  = _user_id
      and left_at  is null
  );
$$;

create or replace function public.is_group_admin(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id
      and user_id  = _user_id
      and left_at  is null
      and role     = 'ADMIN'
  );
$$;

-- Groups policies
create policy "Members can view their groups"
  on public.groups for select
  using (auth.uid() is not null and public.is_group_member(id, auth.uid()));

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() is not null);

create policy "Admins can update groups"
  on public.groups for update
  using (public.is_group_admin(id, auth.uid()));

create policy "Admins can delete groups"
  on public.groups for delete
  using (public.is_group_admin(id, auth.uid()));

-- Group members policies
create policy "Group members can view members of same group"
  on public.group_members for select
  using (auth.uid() is not null and public.is_group_member(group_id, auth.uid()));

create policy "Authenticated users can join groups"
  on public.group_members for insert
  with check (auth.uid() is not null);

create policy "Admins can update members"
  on public.group_members for update
  using (
    public.is_group_admin(group_id, auth.uid())
    or auth.uid() = user_id
  );

create policy "Admins can remove members; members can leave"
  on public.group_members for delete
  using (
    public.is_group_admin(group_id, auth.uid())
    or auth.uid() = user_id
  );

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  icon      text,
  color     text,
  is_system boolean not null default false,
  user_id   uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create index categories_user_idx on public.categories(user_id);

create policy "Users can view system categories and their own"
  on public.categories for select
  using (
    is_system = true
    or (auth.uid() is not null and user_id = auth.uid())
  );

create policy "Authenticated users can create their own categories"
  on public.categories for insert
  with check (auth.uid() = user_id and is_system = false);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id and is_system = false);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id and is_system = false);

-- ============================================================
-- ACCOUNTS
-- ============================================================
create table public.accounts (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  amount             numeric(12, 2) not null check (amount > 0),
  currency           text not null default 'BRL',
  due_date           date,
  category_id        uuid references public.categories(id) on delete set null,
  type               public.account_type not null default 'EXPENSE',
  recurrence         public.recurrence not null default 'ONCE',
  total_installments integer,
  installment_number integer,
  status             public.account_status not null default 'OPEN',
  group_id           uuid references public.groups(id) on delete cascade,
  paid_by_member_id  uuid references public.group_members(id) on delete set null,
  origin_account_id  uuid references public.accounts(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.accounts enable row level security;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create index accounts_group_idx   on public.accounts(group_id);
create index accounts_due_date_idx on public.accounts(due_date);
create index accounts_status_idx  on public.accounts(status);

create policy "Group members can view group accounts"
  on public.accounts for select
  using (
    auth.uid() is not null
    and group_id is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Group members can create accounts"
  on public.accounts for insert
  with check (
    auth.uid() is not null
    and group_id is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Group members can update accounts"
  on public.accounts for update
  using (
    auth.uid() is not null
    and group_id is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Group admins can delete accounts"
  on public.accounts for delete
  using (
    auth.uid() is not null
    and group_id is not null
    and public.is_group_admin(group_id, auth.uid())
  );

-- ============================================================
-- ACCOUNT SPLITS
-- ============================================================
create table public.account_splits (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  member_id  uuid not null references public.group_members(id) on delete cascade,
  percentage numeric(6, 2) not null,
  amount_due numeric(12, 2) not null,
  status     public.split_status not null default 'PENDING',
  unique (account_id, member_id)
);

alter table public.account_splits enable row level security;

create index account_splits_account_idx on public.account_splits(account_id);
create index account_splits_member_idx  on public.account_splits(member_id);

create policy "Group members can view splits of group accounts"
  on public.account_splits for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.accounts a
      where a.id = account_id
        and a.group_id is not null
        and public.is_group_member(a.group_id, auth.uid())
    )
  );

create policy "Service role manages splits"
  on public.account_splits for insert
  with check (auth.uid() is not null);

create policy "Service role updates splits"
  on public.account_splits for update
  using (auth.uid() is not null);

-- ============================================================
-- TRANSFERS
-- ============================================================
create table public.transfers (
  id                 uuid primary key default gen_random_uuid(),
  from_member_id     uuid not null references public.group_members(id) on delete cascade,
  to_member_id       uuid not null references public.group_members(id) on delete cascade,
  group_id           uuid not null references public.groups(id) on delete cascade,
  amount             numeric(12, 2) not null check (amount > 0),
  currency           text not null default 'BRL',
  month              integer check (month between 1 and 12),
  year               integer check (year >= 2020),
  status             public.transfer_status not null default 'PENDING',
  offset_transfer_id uuid references public.transfers(id) on delete set null,
  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz,
  constraint different_members check (from_member_id <> to_member_id)
);

alter table public.transfers enable row level security;

create index transfers_group_idx       on public.transfers(group_id);
create index transfers_from_member_idx on public.transfers(from_member_id);
create index transfers_to_member_idx   on public.transfers(to_member_id);
create index transfers_status_idx      on public.transfers(status);

create or replace function public.is_transfer_participant(_transfer_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transfers t
    join public.group_members fm on fm.id = t.from_member_id
    join public.group_members tm on tm.id = t.to_member_id
    where t.id = _transfer_id
      and (fm.user_id = _user_id or tm.user_id = _user_id)
  );
$$;

create policy "Group members can view group transfers"
  on public.transfers for select
  using (
    auth.uid() is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Service role creates transfers"
  on public.transfers for insert
  with check (auth.uid() is not null);

create policy "Participants can update transfers"
  on public.transfers for update
  using (
    auth.uid() is not null
    and public.is_transfer_participant(id, auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index notifications_user_idx on public.notifications(user_id, read);

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications as read"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Service role creates notifications"
  on public.notifications for insert
  with check (auth.uid() is not null);

-- ============================================================
-- MONTHLY BALANCES  (HOME groups only)
-- ============================================================
create table public.monthly_balances (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  month           integer not null check (month between 1 and 12),
  year            integer not null check (year >= 2020),
  status          public.balance_status not null default 'OPEN',
  total_expense   numeric(12, 2),
  total_by_member jsonb,
  closed_at       timestamptz,
  unique (group_id, month, year)
);

alter table public.monthly_balances enable row level security;

create index monthly_balances_group_idx on public.monthly_balances(group_id);

create policy "Group members can view balances"
  on public.monthly_balances for select
  using (
    auth.uid() is not null
    and public.is_group_member(group_id, auth.uid())
  );

create policy "Service role manages balances"
  on public.monthly_balances for insert
  with check (auth.uid() is not null);

create policy "Service role updates balances"
  on public.monthly_balances for update
  using (auth.uid() is not null);
