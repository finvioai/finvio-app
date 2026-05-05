create table voice_usage (
  user_id          uuid    references auth.users(id) on delete cascade,
  date             date    not null default current_date,
  duration_seconds numeric not null default 0,
  primary key (user_id, date)
);
alter table voice_usage enable row level security;
