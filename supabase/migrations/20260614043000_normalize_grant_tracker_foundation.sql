-- Production grant tracker foundation for Development / Grant Writer Tracker Club.
-- This migration is additive and is designed to synthesize any existing grant tables
-- with the current Grants module expectations.

alter table public.grant_sources add column if not exists source_type text;
alter table public.grant_sources add column if not exists base_url text;
alter table public.grant_sources add column if not exists api_url text;
alter table public.grant_sources add column if not exists notes text;
alter table public.grant_sources add column if not exists access_notes text;
alter table public.grant_sources add column if not exists is_active boolean not null default true;
alter table public.grant_sources add column if not exists last_checked_at timestamptz;
alter table public.grant_sources add column if not exists created_at timestamptz not null default now();
alter table public.grant_sources add column if not exists updated_at timestamptz not null default now();

alter table public.grant_opportunities add column if not exists source_id uuid references public.grant_sources(id) on delete set null;
alter table public.grant_opportunities add column if not exists external_id text;
alter table public.grant_opportunities add column if not exists title text;
alter table public.grant_opportunities add column if not exists funder_name text;
alter table public.grant_opportunities add column if not exists funder text;
alter table public.grant_opportunities add column if not exists description text;
alter table public.grant_opportunities add column if not exists eligibility_summary text;
alter table public.grant_opportunities add column if not exists eligibility_text text;
alter table public.grant_opportunities add column if not exists country text;
alter table public.grant_opportunities add column if not exists region text;
alter table public.grant_opportunities add column if not exists focus_areas text[] not null default '{}';
alter table public.grant_opportunities add column if not exists keywords text[] not null default '{}';
alter table public.grant_opportunities add column if not exists min_award numeric;
alter table public.grant_opportunities add column if not exists max_award numeric;
alter table public.grant_opportunities add column if not exists currency text default 'USD';
alter table public.grant_opportunities add column if not exists deadline date;
alter table public.grant_opportunities add column if not exists posted_date date;
alter table public.grant_opportunities add column if not exists open_date date;
alter table public.grant_opportunities add column if not exists close_date date;
alter table public.grant_opportunities add column if not exists status text not null default 'open';
alter table public.grant_opportunities add column if not exists url text;
alter table public.grant_opportunities add column if not exists source_payload jsonb not null default '{}'::jsonb;
alter table public.grant_opportunities add column if not exists raw_source_json jsonb not null default '{}'::jsonb;
alter table public.grant_opportunities add column if not exists imported_at timestamptz;
alter table public.grant_opportunities add column if not exists last_synced_at timestamptz;
alter table public.grant_opportunities add column if not exists last_checked_at timestamptz;
alter table public.grant_opportunities add column if not exists created_at timestamptz not null default now();
alter table public.grant_opportunities add column if not exists updated_at timestamptz not null default now();

alter table public.grant_applications add column if not exists title text;
alter table public.grant_applications add column if not exists ngo_id uuid references public.ngos(id) on delete cascade;
alter table public.grant_applications add column if not exists opportunity_id uuid references public.grant_opportunities(id) on delete set null;
alter table public.grant_applications add column if not exists stage text not null default 'identified';
alter table public.grant_applications add column if not exists amount_requested numeric;
alter table public.grant_applications add column if not exists amount_awarded numeric;
alter table public.grant_applications add column if not exists currency text default 'USD';
alter table public.grant_applications add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;
alter table public.grant_applications add column if not exists source_match_score numeric;
alter table public.grant_applications add column if not exists fit_notes text;
alter table public.grant_applications add column if not exists notes text;
alter table public.grant_applications add column if not exists due_date date;
alter table public.grant_applications add column if not exists submitted_at timestamptz;
alter table public.grant_applications add column if not exists awarded_at timestamptz;
alter table public.grant_applications add column if not exists closed_at timestamptz;
alter table public.grant_applications add column if not exists work_item_id uuid references public.work_items(id) on delete set null;
alter table public.grant_applications add column if not exists deadline date;
alter table public.grant_applications add column if not exists draft_text text;
alter table public.grant_applications add column if not exists created_at timestamptz not null default now();
alter table public.grant_applications add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_grant_opportunities_status on public.grant_opportunities(status);
create index if not exists idx_grant_opportunities_deadline on public.grant_opportunities(deadline);
create index if not exists idx_grant_opportunities_country on public.grant_opportunities(country);
create index if not exists idx_grant_opportunities_focus_areas on public.grant_opportunities using gin(focus_areas);
create index if not exists idx_grant_applications_stage on public.grant_applications(stage);
create index if not exists idx_grant_applications_ngo_id on public.grant_applications(ngo_id);
create index if not exists idx_grant_alignment_scores_score on public.grant_alignment_scores(score desc);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignment_scores enable row level security;
alter table public.grant_drafts enable row level security;
alter table public.grant_documents enable row level security;
alter table public.grant_saved_searches enable row level security;

drop policy if exists "Internal users can manage grant sources" on public.grant_sources;
create policy "Internal users can manage grant sources" on public.grant_sources for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant opportunities" on public.grant_opportunities;
create policy "Internal users can manage grant opportunities" on public.grant_opportunities for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant applications" on public.grant_applications;
create policy "Internal users can manage grant applications" on public.grant_applications for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant alignments" on public.grant_alignment_scores;
create policy "Internal users can manage grant alignments" on public.grant_alignment_scores for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant drafts" on public.grant_drafts;
create policy "Internal users can manage grant drafts" on public.grant_drafts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant documents" on public.grant_documents;
create policy "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can manage grant saved searches" on public.grant_saved_searches;
create policy "Internal users can manage grant saved searches" on public.grant_saved_searches for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

insert into public.grant_sources (name, funder_type, source_type, base_url, api_url, notes, access_notes, is_active)
select 'Grants.gov', 'public_federal', 'public_database', 'https://www.grants.gov/', null, 'Federal public opportunity source for future ingestion.', 'API integration can be added in a later edge function.', true
where not exists (select 1 from public.grant_sources where name = 'Grants.gov');

insert into public.grant_sources (name, funder_type, source_type, base_url, api_url, notes, access_notes, is_active)
select 'USAspending.gov', 'public_federal_awards', 'public_database', 'https://www.usaspending.gov/', null, 'Federal award history and funder intelligence source.', 'Use for historical awards and funder pattern analysis.', true
where not exists (select 1 from public.grant_sources where name = 'USAspending.gov');

insert into public.grant_sources (name, funder_type, source_type, base_url, api_url, notes, access_notes, is_active)
select 'SAM.gov Assistance Listings', 'public_federal_programs', 'public_database', 'https://sam.gov/', null, 'Federal assistance listing and award management intelligence source.', 'Use for program/entity context in later ingestion.', true
where not exists (select 1 from public.grant_sources where name = 'SAM.gov Assistance Listings');

insert into public.grant_sources (name, funder_type, source_type, base_url, api_url, notes, access_notes, is_active)
select 'Grant STW Demo Source', 'manual_demo', 'demo', null, null, 'Demo opportunities merged from the Grant-Writer repo.', 'Replace with live source ingestion when available.', true
where not exists (select 1 from public.grant_sources where name = 'Grant STW Demo Source');
