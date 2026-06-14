-- Production grant tracker foundation for Development.
-- Supports grant source tracking, opportunity tracking, application pipeline,
-- NGO/opportunity alignment scoring, drafts, and grant-related document links.

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
  country text,
  region text,
  focus_areas text[] not null default '{}',
  eligibility_summary text,
  min_award numeric,
  max_award numeric,
  currency text not null default 'USD',
  deadline date,
  posted_date date,
  status text not null default 'open' check (status in ('open','forecasted','closed','archived','draft')),
  url text,
  raw_json jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ngo_id uuid references public.ngos(id) on delete set null,
  opportunity_id uuid references public.grant_opportunities(id) on delete set null,
  stage text not null default 'prospect' check (stage in ('prospect','researching','loi_drafting','loi_submitted','invited','proposal_drafting','internal_review','submitted','awarded','declined','closed')),
  amount_requested numeric,
  amount_awarded numeric,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  due_date date,
  submitted_at timestamptz,
  awarded_at timestamptz,
  closed_at timestamptz,
  notes text,
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

create table if not exists public.grant_drafts (
  id uuid primary key default gen_random_uuid(),
  grant_application_id uuid references public.grant_applications(id) on delete cascade,
  ngo_id uuid references public.ngos(id) on delete set null,
  opportunity_id uuid references public.grant_opportunities(id) on delete set null,
  title text not null,
  draft_markdown text not null,
  draft_status text not null default 'draft' check (draft_status in ('draft','in_review','approved','submitted','archived')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
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
create index if not exists idx_grant_alignment_scores_score on public.grant_alignment_scores(score);
create index if not exists idx_grant_drafts_application_id on public.grant_drafts(grant_application_id);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignment_scores enable row level security;
alter table public.grant_drafts enable row level security;
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

drop policy if exists "Internal users can read grant alignment scores" on public.grant_alignment_scores;
create policy "Internal users can read grant alignment scores" on public.grant_alignment_scores for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant alignment scores" on public.grant_alignment_scores;
create policy "Internal users can manage grant alignment scores" on public.grant_alignment_scores for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant drafts" on public.grant_drafts;
create policy "Internal users can read grant drafts" on public.grant_drafts for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant drafts" on public.grant_drafts;
create policy "Internal users can manage grant drafts" on public.grant_drafts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant documents" on public.grant_documents;
create policy "Internal users can read grant documents" on public.grant_documents for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant documents" on public.grant_documents;
create policy "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
