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
  units       int,
  year_built  int,
  notes         text,
  status        text not null default 'research' check (status in ('research', 'pending', 'active', 'closed')),
  compare_state jsonb default '{}'::jsonb,
  display_order int default 0,
  crexi_url     text,
  property_image_url text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Scenarios table — inputs stored as JSONB so schema never needs migration when fields are added
create table if not exists scenarios (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null default 'New Scenario',
  method       text default 'om',  -- legacy field, ignored at runtime; vacancy mode derived from inputs
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

-- ============================================================
-- Deal Pipeline tables
-- ============================================================

-- Main pipeline record — one per property, auto-created when deal goes Pending
-- JSONB for: loi_tracking, milestones, deal_team, repair_estimates, expense_budgets
create table if not exists deal_pipelines (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid references properties(id) on delete cascade not null unique,
  user_id          uuid references auth.users(id) on delete cascade not null,
  loi_tracking     jsonb not null default '{
    "status": "submitted",
    "submittedDate": null,
    "counterOfferNotes": "",
    "responseDate": null,
    "loiDocumentUrl": null,
    "extractedTerms": null
  }'::jsonb,
  milestones       jsonb not null default '[
    {"id":"psa","name":"PSA Executed","date":null,"status":"pending","notes":""},
    {"id":"inspection","name":"Inspection Period","date":null,"status":"pending","notes":""},
    {"id":"financing","name":"Financing Contingency","date":null,"status":"pending","notes":""},
    {"id":"appraisal","name":"Appraisal","date":null,"status":"pending","notes":""},
    {"id":"closing","name":"Closing","date":null,"status":"pending","notes":""}
  ]'::jsonb,
  deal_team        jsonb not null default '{}'::jsonb,
  repair_estimates jsonb not null default '[]'::jsonb,
  expense_budgets  jsonb not null default '{}'::jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table deal_pipelines enable row level security;

create policy "Users manage own pipelines"
  on deal_pipelines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger deal_pipelines_updated_at before update on deal_pipelines
  for each row execute function update_updated_at();

-- Deal documents — uploaded files with optional AI extraction
create table if not exists deal_documents (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid references deal_pipelines(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  file_name    text not null,
  file_url     text not null,
  file_size    bigint,
  doc_type     text not null default 'other'
    check (doc_type in ('loi', 'psa', 'inspection_report', 'contract', 'other')),
  extracted    jsonb default null,
  uploaded_at  timestamptz default now()
);

alter table deal_documents enable row level security;

create policy "Users manage own deal documents"
  on deal_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deal expenses — budget vs actual tracking
create table if not exists deal_expenses (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid references deal_pipelines(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  category     text not null
    check (category in ('travel','professional_fees','inspections','earnest_money',
                        'appraisal','legal','title_escrow','lender_fees','other')),
  amount       numeric(12,2) not null default 0,
  vendor       text,
  description  text,
  expense_date date,
  created_at   timestamptz default now()
);

alter table deal_expenses enable row level security;

create policy "Users manage own deal expenses"
  on deal_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists properties_user_id_idx on properties(user_id);
create index if not exists properties_status_idx on properties(user_id, status);
create index if not exists scenarios_property_id_idx on scenarios(property_id);
create index if not exists scenarios_user_id_idx on scenarios(user_id);
create index if not exists deal_pipelines_property_id_idx on deal_pipelines(property_id);
create index if not exists deal_pipelines_user_id_idx on deal_pipelines(user_id);
create index if not exists deal_documents_pipeline_id_idx on deal_documents(pipeline_id);
create index if not exists deal_expenses_pipeline_id_idx on deal_expenses(pipeline_id);
