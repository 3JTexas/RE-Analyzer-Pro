-- ============================================================
-- Deal Analyzer — Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Properties table
create table if not exists properties (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  address     text,
  units       int default 8,
  year_built  int,
  notes         text,
  display_order int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Scenarios table — inputs stored as JSONB so schema never needs migration when fields are added
create table if not exists scenarios (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null default 'New Scenario',
  method       text not null default 'om' check (method in ('om', 'physical')),
  inputs       jsonb not null default '{}',
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger properties_updated_at before update on properties
  for each row execute function update_updated_at();

create trigger scenarios_updated_at before update on scenarios
  for each row execute function update_updated_at();

-- Row Level Security — users only see their own data
alter table properties enable row level security;
alter table scenarios  enable row level security;

create policy "Users manage own properties"
  on properties for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own scenarios"
  on scenarios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User defaults — stores underwriting defaults as JSONB
create table if not exists user_defaults (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  defaults    jsonb not null default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table user_defaults enable row level security;

create policy "Users manage own defaults"
  on user_defaults for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_defaults_updated_at before update on user_defaults
  for each row execute function update_updated_at();

-- Indexes
create index if not exists properties_user_id_idx on properties(user_id);
create index if not exists scenarios_property_id_idx on scenarios(property_id);
create index if not exists scenarios_user_id_idx on scenarios(user_id);
