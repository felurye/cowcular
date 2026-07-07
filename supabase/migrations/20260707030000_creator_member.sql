-- ============================================================
-- PAPEL DE CREATOR (M-07)
-- ============================================================
-- Identifica o criador do grupo: exatamente um por grupo, definido
-- na criação e imutável. O creator acumula as permissões de admin,
-- não pode ser removido do grupo e não pode ter o admin revogado
-- (checagens na API). Optou-se por flag booleana em vez de novo
-- valor no enum member_role para não alterar as checagens
-- existentes de role = 'ADMIN' (API e RLS).

alter table public.group_members
  add column is_creator boolean not null default false;

-- Backfill: o membro com conta mais antigo de cada grupo foi
-- inserido na criação do grupo, portanto é o creator.
with firsts as (
  select distinct on (group_id) id
  from public.group_members
  where user_id is not null
  order by group_id, joined_at asc
)
update public.group_members gm
set is_creator = true
from firsts f
where gm.id = f.id;

-- Garante o creator como admin (precedência sobre rebaixamentos
-- feitos antes desta migration)
update public.group_members
set role = 'ADMIN'
where is_creator and role <> 'ADMIN';

-- No máximo um creator por grupo
create unique index group_members_one_creator_per_group
  on public.group_members(group_id)
  where is_creator;
