-- Consolidate the existing grant tracker schema instead of creating duplicate grant tables.
-- The live database already has grant_sources, grant_opportunities, grant_applications,
-- grant_alignments, grant_drafts, and grant_documents. This migration adds compatibility
-- columns, indexes, RLS policies, and public-source placeholders for future ingestion.

alter table public.grant_sources add column if not exists access_notes text;
update public.grant_sources set access_notes = notes where access_notes is null and notes is not null;

alter table public.grant_opportunities add column if not exists funder text;
update public.grant_opportunities set funder = funder_name where funder is null and funder_name is not null;

alter table public.grant_opportunities add column if not exists eligibility_text text;
update public.grant_opportunities set eligibility_text = eligibility_summary where eligibility_text is null and eligibility_summary is not null;

alter table public.grant_opportunities add column if not exists posted_date date;
update public.grant_opportunities set posted_date = open_date where posted_date is null and open_date is not null;

alter table public.grant_opportunities add column if not exists raw_source_json jsonb;
update public.grant_opportunities set raw_source_json = source_payload where raw_source_json is null and source_payload is not null;

alter table public.grant_opportunities add column if not exists imported_at timestamptz;
update public.grant_opportunities set imported_at = last_synced_at where imported_at is null and last_synced_at is not null;

alter table public.grant_opportunities add column if not exists last_checked_at timestamptz;
update public.grant_opportunities set last_checked_at = last_synced_at where last_checked_at is null and last_synced_at is not null;

alter table public.grant_applications add column if not exists work_item_id uuid references public.work_items(id) on delete set null;
alter table public.grant_applications add column if not exists deadline date;
update public.grant_applications set deadline = due_date where deadline is null and due_date is not null;
alter table public.grant_applications add column if not exists draft_text text;

create table if not exists public.grant_saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  filters_json jsonb not null default '{}',
  notification_frequency text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_grant_sources_active on public.grant_sources(is_active);
create index if not exists idx_grant_opportunities_status on public.grant_opportunities(status);
create index if not exists idx_grant_opportunities_deadline on public.grant_opportunities(deadline);
create index if not exists idx_grant_opportunities_country on public.grant_opportunities(country);
create index if not exists idx_grant_opportunities_focus_areas on public.grant_opportunities using gin(focus_areas);
create index if not exists idx_grant_applications_stage on public.grant_applications(stage);
create index if not exists idx_grant_applications_ngo_id on public.grant_applications(ngo_id);
create index if not exists idx_grant_applications_opportunity_id on public.grant_applications(opportunity_id);
create index if not exists idx_grant_applications_work_item_id on public.grant_applications(work_item_id);
create index if not exists idx_grant_alignments_ngo_id on public.grant_alignments(ngo_id);
create index if not exists idx_grant_alignments_opportunity_id on public.grant_alignments(opportunity_id);

alter table public.grant_sources enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_alignments enable row level security;
alter table public.grant_drafts enable row level security;
alter table public.grant_documents enable row level security;
alter table public.grant_saved_searches enable row level security;

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

drop policy if exists "Internal users can read grant drafts" on public.grant_drafts;
create policy "Internal users can read grant drafts" on public.grant_drafts for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant drafts" on public.grant_drafts;
create policy "Internal users can manage grant drafts" on public.grant_drafts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant documents" on public.grant_documents;
create policy "Internal users can read grant documents" on public.grant_documents for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage grant documents" on public.grant_documents;
create policy "Internal users can manage grant documents" on public.grant_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read grant saved searches" on public.grant_saved_searches;
create policy "Internal users can read grant saved searches" on public.grant_saved_searches for select to authenticated using (public.is_internal_user());
drop policy if exists "Internal users can manage own grant saved searches" on public.grant_saved_searches;
create policy "Internal users can manage own grant saved searches" on public.grant_saved_searches for all to authenticated using (public.is_internal_user() and (owner_user_id is null or owner_user_id = auth.uid())) with check (public.is_internal_user() and (owner_user_id is null or owner_user_id = auth.uid()));

insert into public.grant_sources (name, funder_type, source_type, base_url, notes, access_notes)
values
  ('Grant STW Demo Source', 'mixed', 'demo', null, 'Seeded from the legacy Grant-Writer repository demo data.', 'Seeded from the legacy Grant-Writer repository demo data.'),
  ('Grants.gov', 'federal', 'public_api', 'https://www.grants.gov/', 'Future ingestion source for federal opportunities.', 'Future ingestion source for federal opportunities.'),
  ('USAspending.gov', 'federal_awards', 'public_api', 'https://www.usaspending.gov/', 'Future source for historical award intelligence.', 'Future source for historical award intelligence.'),
  ('Manual Foundation Research', 'private_foundation', 'manual', null, 'Manual/private funder opportunities such as foundations, corporate giving, and curated research.', 'Manual/private funder opportunities such as foundations, corporate giving, and curated research.')
on conflict (name) do update set
  funder_type = excluded.funder_type,
  source_type = excluded.source_type,
  base_url = excluded.base_url,
  notes = excluded.notes,
  access_notes = excluded.access_notes,
  updated_at = now();
