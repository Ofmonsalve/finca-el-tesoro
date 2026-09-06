create table if not exists farm_members (
  user_id    text primary key,
  email      text not null default '',
  name       text not null default '',
  role       text not null,
  created_at timestamptz not null default now()
);
