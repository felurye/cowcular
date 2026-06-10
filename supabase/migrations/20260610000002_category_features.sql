
-- Feature: Soft delete for custom categories
ALTER TABLE public.categories ADD COLUMN deleted_at timestamptz;

-- Update view policy to exclude soft-deleted categories
DROP POLICY IF EXISTS "view_categories" ON public.categories;
CREATE POLICY "view_categories"
  ON public.categories FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_system = true
      OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
    )
  );

-- Feature: Category budgets
CREATE TABLE public.category_budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  month       integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        integer NOT NULL CHECK (year >= 2020),
  limit_amount numeric(12, 2) NOT NULL CHECK (limit_amount > 0),
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- Partial unique: only one active budget per category/group/month/year
CREATE UNIQUE INDEX category_budgets_unique_active
  ON public.category_budgets(category_id, group_id, month, year)
  WHERE deleted_at IS NULL;

CREATE INDEX category_budgets_group_idx ON public.category_budgets(group_id);
CREATE INDEX category_budgets_category_idx ON public.category_budgets(category_id);

CREATE POLICY "view_category_budgets"
  ON public.category_budgets FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "manage_category_budgets"
  ON public.category_budgets FOR ALL
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));
