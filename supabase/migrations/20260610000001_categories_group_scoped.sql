
-- Remove per-user seeded categories (replaced by system ones below)
DELETE FROM public.categories WHERE is_system = false;

-- Drop old RLS policies first (they depend on user_id)
DROP POLICY IF EXISTS "Users can view system categories and their own" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can create their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- Drop old user_id index
DROP INDEX IF EXISTS categories_user_idx;

-- Add group_id column (null for system categories)
ALTER TABLE public.categories
  ADD COLUMN group_id uuid references public.groups(id) on delete cascade;

-- Remove user_id column
ALTER TABLE public.categories DROP COLUMN user_id;

-- Add index on group_id
CREATE INDEX categories_group_idx ON public.categories(group_id);

-- New RLS policies
CREATE POLICY "view_categories"
  ON public.categories FOR SELECT
  USING (
    is_system = true
    OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
  );

CREATE POLICY "create_group_categories"
  ON public.categories FOR INSERT
  WITH CHECK (
    is_system = false
    AND group_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "update_group_categories"
  ON public.categories FOR UPDATE
  USING (
    is_system = false
    AND group_id IS NOT NULL
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "delete_group_categories"
  ON public.categories FOR DELETE
  USING (
    is_system = false
    AND group_id IS NOT NULL
    AND public.is_group_member(group_id, auth.uid())
  );

-- Seed shared system categories
INSERT INTO public.categories (name, icon, is_system) VALUES
  ('Moradia', '🏠', true),
  ('Alimentação', '🍽️', true),
  ('Transporte', '🚗', true),
  ('Saúde', '🏥', true),
  ('Lazer', '🎉', true),
  ('Serviços', '🔧', true),
  ('Viagem', '✈️', true),
  ('Outros', '📦', true);
