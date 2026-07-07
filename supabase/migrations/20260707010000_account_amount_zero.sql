-- ============================================================
-- CONTAS COM VALOR ZERO (M-01)
-- ============================================================
-- Permite lançar contas com amount = 0 (ex.: contas de valor
-- variável aguardando a fatura). Contas com valor zero não geram
-- repasses; ao editar para valor > 0, divisões e repasses são
-- recalculados pela API.

alter table public.accounts
  drop constraint accounts_amount_check;

alter table public.accounts
  add constraint accounts_amount_check check (amount >= 0);
