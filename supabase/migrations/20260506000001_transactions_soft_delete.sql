alter table transactions
  add column deleted_at timestamptz default null;

-- partial index for the common filter WHERE deleted_at IS NULL
create index idx_transactions_deleted_at on transactions (org_id, deleted_at)
  where deleted_at is null;
