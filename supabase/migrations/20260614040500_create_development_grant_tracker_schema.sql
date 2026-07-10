-- Production grant tracker foundation for Development.
-- Creates the tables expected by the Grants module and adds storage for STW alignment/draft results.
--
-- Historical compatibility: early HPG migrations created narrower versions of
-- grant_sources, grant_opportunities, and grant_applications. CREATE TABLE IF
-- NOT EXISTS does not add missing columns or constraints, so this migration
-- explicitly normalizes those tables before starter data and hardening run.

create table if not exists public.grant_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder_type text,
  source_type text not null default 'manual',
  base_url text,
  api_url text,
  notes text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table public.grant_sources
  add column if not exists source_type text not null default 'manual',
  add column if not exists base_url text,
  add column if not exists api_url text,
  add column if not exists notes text,
  add column if not exists last_checked_at timestamptz;

create unique index if not exists grant_sources_name_unique
  on public.grant_sources(name);

create table if not exists public.grant_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grant_sources(id) on delete set null,
  external_id text,
  title text not null,
  funder_name text,
  description text,
  eligibility_summary text,
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
  status text not null default 'open',
  url text,
  source_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

alter table public.grant_opportunities
  add column if not exists external_id text,
  add column if not exists funder_name text,
  add column if not exists eligibility_summary text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists currency text not null default 'USD',
  add column if not exists open_date date,
  add column if not exists close_date date,
  add column if not exists source_payload jsonb,
  add column if not exists last_synced_at timestamptz;

create unique index if not exists grant_opportunities_source_external_unique
  on public.grant_opportunities(source_id, external_id)
  where external_id is not null;

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.grant_opportunities(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete cascade,
  title text not null,
  stage text not null default 'prospecting',
  amount_requested numeric,
  amount_awarded numeric,
  currency text not null default 'USD',
  assigned_user_id uuid references public.profiles(id) on delete set null,
  source_match_score numeric,
  fit_notes text,
  notes text,
  due_date date,
  submitted_at timestamptz,
  awarded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grant_applications
  add column if not exists currency text not null default 'USD',
  add column if not exists source_match_score numeric,
  add column if not exists fit_notes text,
  add column if not exists due_date date;

create table if not exists public.grant_alignments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.grant_opportunities(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  score numeric not null default 0,
  theme_matches text[] not null default '{}',
  region_match boolean not null default false,
  notes text[] not null default '{}',
  alignment_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, ngo_id)
);

create table if not exists public.grant_drafts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.grant_applications(id) on delete cascade,
  alignment_id uuid references public.grant_alignments(id) on delete set null,
  title text not null,
  draft_type text not null default 'proposal',
  content_markdown text not null,
  status text not null default 'draft',
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
create index if not exists idx_grant_opportunities_country on public.grant_opportunities(country);
create index if not exists idx_grant_opportunities_focus_areas on public.grant_opportunities using gin(focus_areas);
create index if not exists idx_grant_applications_ngo_id on public.grant_applications(ngo_id);
create index if not exists idx_grant_applications_stage on public.grant_applications(stage);
create index if not exists idx_grant_applications_assigned_user_id on public.grant_applications(assigned_user_id);
create index if not exists idx_grant_alignments_score on public.grant_alignments(score desc);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignments enable row level security;
alter table public.grant_drafts enable row level security;
alter table public.grant_documents enable row level security;

drop policy if exists "Internal users can view grant sources" on public.grant_sources;
drop policy if exists "Internal users can manage grant sources" on public.grant_sources;
drop policy if exists "Internal users can view grant opportunities" on public.grant_opportunities;
drop policy if exists "Internal users can manage grant opportunities" on public.grant_opportunities;
drop policy if exists "Internal users can view grant applications" on public.grant_applications;
drop policy if exists "Internal users can manage grant applications" on public.grant_applications;
drop policy if exists "Internal users can manage grant alignments" on public.grant_alignments;
drop policy if exists "Internal users can manage grant drafts" on public.grant_drafts;
drop policy if exists "Internal users can manage grant documents" on public.grant_documents;

create policy "Internal users can view grant sources" on public.grant_sources for select to authenticated using (public.is_internal_user());
create policy "Internal users can manage grant sources" on public.grant_sources for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Internal users can view grant opportunities" on public.grant_opportunities for select to authenticated using (public.is_internal_user());
create policy "Internal users can manage grant opportunities" on public.grant_opportunities for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Internal users can view grant applications" on public.grant_applications for select to authenticated using (public.is_internal_user());
create policy "Internal users can manage grant applications" on public.grant_applications for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Internal users can manage grant alignments" on public.grant_alignments for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Internal users can manage grant drafts" on public.grant_drafts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
