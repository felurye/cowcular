-- ============================================================
-- REVERSÃO DE QUITAÇÃO: VÍNCULO SPLIT -> SETTLEMENT
-- ============================================================
-- Permite reverter uma quitação com precisão: cada split marcado
-- como PAID por uma quitação guarda o settlement que o quitou.
-- Coluna opcional; splits existentes não são alterados.

alter table public.account_splits
  add column settlement_id uuid references public.settlements(id) on delete set null;

create index account_splits_settlement_idx on public.account_splits(settlement_id);
