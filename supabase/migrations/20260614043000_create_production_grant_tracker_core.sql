-- Production Grant Tracker core schema.
-- Live Supabase has already received this migration; this file keeps the repo in sync.

create table if not exists public.grant_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder_type text,
  source_type text not null default 'manual',
  base_url text,
  api_url text,
  notes text,
  access_notes text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.grant_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grant_sources(id) on delete set null,
  external_id text,
  title text not null,
  funder_name text,
  funder text,
  description text,
  eligibility_summary text,
  eligibility_text text,
  country text,
  region text,
  focus_areas text[] not null default '{}',
  keywords text[] not null default '{}',
  min_award numeric,
  max_award numeric,
  currency text not null default 'USD',
  deadline date,
  open_date date,
  close_date date,
  posted_date date,
  status text not null default 'open',
  url text,
  source_payload jsonb,
  raw_source_json jsonb,
  last_synced_at timestamptz,
  imported_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.grant_opportunities(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete set null,
  title text not null,
  stage text not null default 'prospect',
  amount_requested numeric,
  amount_awarded numeric,
  currency text not null default 'USD',
  assigned_user_id uuid references public.profiles(id) on delete set null,
  source_match_score numeric,
  fit_notes text,
  notes text,
  due_date date,
  deadline date,
  submitted_at timestamptz,
  awarded_at timestamptz,
  closed_at timestamptz,
  work_item_id uuid references public.work_items(id) on delete set null,
  draft_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grant_alignment_scores (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  opportunity_id uuid not null references public.grant_opportunities(id) on delete cascade,
  score numeric not null default 0,
  theme_matches text[] not null default '{}',
  region_match boolean not null default false,
  notes text[] not null default '{}',
  calculated_at timestamptz not null default now(),
  unique (ngo_id, opportunity_id)
);

create table if not exists public.grant_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.grant_applications(id) on delete cascade,
  opportunity_id uuid references public.grant_opportunities(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  unique (application_id, document_id)
);

create index if not exists idx_grant_opportunities_status on public.grant_opportunities(status);
create index if not exists idx_grant_opportunities_deadline on public.grant_opportunities(deadline);
create index if not exists idx_grant_opportunities_focus_areas on public.grant_opportunities using gin(focus_areas);
create index if not exists idx_grant_applications_stage on public.grant_applications(stage);
create index if not exists idx_grant_applications_ngo_id on public.grant_applications(ngo_id);
create index if not exists idx_grant_applications_opportunity_id on public.grant_applications(opportunity_id);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignment_scores enable row level security;
alter table public.grant_documents enable row level security;

create policy if not exists "Internal users can read grant sources" on public.grant_sources for select to authenticated using (public.is_internal_user());
create policy if not exists "Internal users can manage grant sources" on public.grant_sources for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy if not exists "Internal users can read grant opportunities" on public.grant_opportunities for select to authenticated using (public.is_internal_user());
create policy if not exists "Internal users can manage grant opportunities" on public.grant_opportunities for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy if not exists "Internal users can read grant applications" on public.grant_applications for select to authenticated using (public.is_internal_user());
create policy if not exists "Internal users can manage grant applications" on public.grant_applications for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy if not exists "Internal users can read grant alignment scores" on public.grant_alignment_scores for select to authenticated using (public.is_internal_user());
create policy if not exists "Internal users can manage grant alignment scores" on public.grant_alignment_scores for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy if not exists "Internal users can read grant documents" on public.grant_documents for select to authenticated using (public.is_internal_user());
create policy if not exists "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
