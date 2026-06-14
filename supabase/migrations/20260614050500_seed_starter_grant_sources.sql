-- Starter grant source records for the Development Grant Tracker.

insert into public.grant_sources (name, funder_type, source_type, base_url, api_url, notes, access_notes, is_active, last_checked_at)
values
('Grants.gov', 'federal', 'public_database', 'https://www.grants.gov/', null, 'Primary federal funding opportunity discovery source.', 'Connect API/import workflow in a later ingestion PR.', true, now()),
('USAspending.gov', 'federal_awards', 'public_database', 'https://www.usaspending.gov/', null, 'Historical federal award and spending pattern source.', 'Use for award history and funder pattern intelligence.', true, now()),
('SAM.gov Assistance Listings', 'federal_programs', 'public_database', 'https://sam.gov/', null, 'Federal assistance listings and entity/program context.', 'Use for federal program context and eligibility intelligence.', true, now()),
('Manual / Foundation Source', 'foundation', 'manual', null, null, 'Manual entry source for private foundations and curated opportunities.', 'Use for foundation, GrantStation-style, Candid-style, and internal prospect records.', true, now())
on conflict (name) do update
set funder_type = excluded.funder_type,
    source_type = excluded.source_type,
    base_url = excluded.base_url,
    api_url = excluded.api_url,
    notes = excluded.notes,
    access_notes = excluded.access_notes,
    is_active = excluded.is_active,
    last_checked_at = excluded.last_checked_at,
    updated_at = now();
