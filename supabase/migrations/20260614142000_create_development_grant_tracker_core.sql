-- Production grant tracker foundation for Development.
-- This migration intentionally synthesizes around the strongest current live schema:
-- sources, opportunities, applications, alignments, drafts, saved searches, and documents.

create table if not exists public.grant_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder_type text,
  website_url text,
  source_type text not null default 'manual',
  public_database text,
  api_endpoint text,
  is_active boolean not null default true,
  notes text,
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

alter table public.grant_opportunities add column if not exists funder text;
alter table public.grant_opportunities add column if not exists eligibility_text text;
alter table public.grant_opportunities add column if not exists raw_json jsonb;

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.grant_opportunities(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete set null,
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
  deadline date,
  submitted_at timestamptz,
  awarded_at timestamptz,
  closed_at timestamptz,
  work_item_id uuid references public.work_items(id) on delete set null,
  draft_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  unique (ngo_id, opportunity_id)
);

-- Backward-compatible name from earlier Grant STW phase. Keep it as a mirror-capable table,
-- but prefer public.grant_alignments for new code.
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

create table if not exists public.grant_saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  filters_json jsonb not null default '{}'::jsonb,
  notification_frequency text not null default 'weekly',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grant_documents (
  id uuid primary key default gen_random_uuid(),
  grant_application_id uuid references public.grant_applications(id) on delete cascade,
  grant_opportunity_id uuid references public.grant_opportunities(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  document_type text,
  created_at timestamptz not null default now(),
  unique (grant_application_id, document_id)
);

create index if not exists idx_grant_opportunities_status on public.grant_opportunities(status);
create index if not exists idx_grant_opportunities_deadline on public.grant_opportunities(deadline);
create index if not exists idx_grant_opportunities_focus_areas on public.grant_opportunities using gin(focus_areas);
create index if not exists idx_grant_applications_stage on public.grant_applications(stage);
create index if not exists idx_grant_applications_ngo_id on public.grant_applications(ngo_id);
create index if not exists idx_grant_applications_opportunity_id on public.grant_applications(opportunity_id);
create index if not exists idx_grant_applications_work_item_id on public.grant_applications(work_item_id);
create index if not exists idx_grant_alignments_score on public.grant_alignments(score);
create index if not exists idx_grant_alignment_scores_score on public.grant_alignment_scores(score);
create index if not exists idx_grant_drafts_application_id on public.grant_drafts(application_id);
create index if not exists idx_grant_saved_searches_owner on public.grant_saved_searches(owner_user_id);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignments enable row level security;
alter table public.grant_alignment_scores enable row level security;
alter table public.grant_drafts enable row level security;
alter table public.grant_saved_searches enable row level security;
alter table public.grant_documents enable row level security;

drop policy if exists "Internal users can read grant sources" on public.grant_sources;
create policy "Internal users can read grant sources" on public.grant_sources for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant sources" on public.grant_sources;
create policy "Internal users can manage grant sources" on public.grant_sources for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant opportunities" on public.grant_opportunities;
create policy "Internal users can read grant opportunities" on public.grant_opportunities for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant opportunities" on public.grant_opportunities;
create policy "Internal users can manage grant opportunities" on public.grant_opportunities for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant applications" on public.grant_applications;
create policy "Internal users can read grant applications" on public.grant_applications for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant applications" on public.grant_applications;
create policy "Internal users can manage grant applications" on public.grant_applications for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant alignments" on public.grant_alignments;
create policy "Internal users can read grant alignments" on public.grant_alignments for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant alignments" on public.grant_alignments;
create policy "Internal users can manage grant alignments" on public.grant_alignments for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant alignment scores" on public.grant_alignment_scores;
create policy "Internal users can read grant alignment scores" on public.grant_alignment_scores for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant alignment scores" on public.grant_alignment_scores;
create policy "Internal users can manage grant alignment scores" on public.grant_alignment_scores for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant drafts" on public.grant_drafts;
create policy "Internal users can read grant drafts" on public.grant_drafts for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant drafts" on public.grant_drafts;
create policy "Internal users can manage grant drafts" on public.grant_drafts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant saved searches" on public.grant_saved_searches;
create policy "Internal users can read grant saved searches" on public.grant_saved_searches for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant saved searches" on public.grant_saved_searches;
create policy "Internal users can manage grant saved searches" on public.grant_saved_searches for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant documents" on public.grant_documents;
create policy "Internal users can read grant documents" on public.grant_documents for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant documents" on public.grant_documents;
create policy "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
