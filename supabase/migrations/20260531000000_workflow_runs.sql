create table workflow_runs (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references organizations(id) on delete cascade,
  workflow_id   text        not null,
  workflow_name text        not null,
  status        text        not null default 'running',
  -- status: 'running' | 'completed' | 'completed_with_warnings' | 'failed'
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  summary_json  jsonb,
  created_by    uuid        references auth.users(id)
);

create index idx_workflow_runs_org on workflow_runs (org_id, started_at desc);

alter table workflow_runs enable row level security;

create policy "org members can select workflow_runs"
  on workflow_runs for select
  using (
    exists (
      select 1 from org_members
      where org_id = workflow_runs.org_id
        and user_id = auth.uid()
    )
  );

create policy "org members can insert workflow_runs"
  on workflow_runs for insert
  with check (
    exists (
      select 1 from org_members
      where org_id = workflow_runs.org_id
        and user_id = auth.uid()
    )
  );

create policy "org members can update workflow_runs"
  on workflow_runs for update
  using (
    exists (
      select 1 from org_members
      where org_id = workflow_runs.org_id
        and user_id = auth.uid()
    )
  );
