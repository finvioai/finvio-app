-- Speed up cross-source duplicate checks used by email sync.
-- Queries: SELECT id WHERE org_id=? AND amount=? AND type=? AND date BETWEEN ? AND ? AND deleted_at IS NULL
create index if not exists idx_transactions_dedup
  on transactions (org_id, amount, type, date)
  where deleted_at is null;
