-- Starter grant sources and demo opportunities for the Development Grant Writer Tracker Club.
-- Live Supabase has already received this seed; this file keeps the repo in sync.

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

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, posted_date,
  status, url, source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'demo-usaid-wash', 'USAID WASH Innovation Fund', 'USAID', 'USAID',
'Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.',
'Best fit for NGOs with WASH, infrastructure, hygiene, and community sustainability work.',
'Eligible applicants should show community engagement, sustainability, implementation capacity, and measurable outcomes.',
'Regional', 'East Africa', array['water','sanitation','hygiene','innovation'], array['WASH','boreholes','hygiene','community engagement','water access'],
250000, 1000000, 'USD', date '2026-10-15', current_date,
'open', 'https://www.usaid.gov/', jsonb_build_object('source','Grant-Writer demo seed'), jsonb_build_object('source','Grant-Writer demo seed'), now(), now(), now()
from public.grant_sources s where s.name='Grants.gov'
on conflict (source_id, external_id) do update
set title=excluded.title,
    funder_name=excluded.funder_name,
    funder=excluded.funder,
    description=excluded.description,
    eligibility_summary=excluded.eligibility_summary,
    eligibility_text=excluded.eligibility_text,
    country=excluded.country,
    region=excluded.region,
    focus_areas=excluded.focus_areas,
    keywords=excluded.keywords,
    min_award=excluded.min_award,
    max_award=excluded.max_award,
    currency=excluded.currency,
    deadline=excluded.deadline,
    posted_date=excluded.posted_date,
    status=excluded.status,
    url=excluded.url,
    source_payload=excluded.source_payload,
    raw_source_json=excluded.raw_source_json,
    last_synced_at=excluded.last_synced_at,
    imported_at=excluded.imported_at,
    last_checked_at=excluded.last_checked_at,
    updated_at=now();

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, posted_date,
  status, url, source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'demo-gates-climate', 'Gates Foundation Climate-Smart Agriculture', 'Bill & Melinda Gates Foundation', 'Bill & Melinda Gates Foundation',
'Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.',
'Best fit for NGOs with climate, agriculture, farmer resilience, digital advisory, or inclusive finance work.',
'Eligible applicants should show agricultural impact, adaptation strategy, measurable farmer outcomes, and scalable delivery partners.',
'Regional', 'South Asia', array['climate','agriculture','finance','digital'], array['smallholder farmers','climate adaptation','agriculture','digital advisory','inclusive finance'],
500000, 2000000, 'USD', date '2026-11-01', current_date,
'open', 'https://www.gatesfoundation.org/', jsonb_build_object('source','Grant-Writer demo seed'), jsonb_build_object('source','Grant-Writer demo seed'), now(), now(), now()
from public.grant_sources s where s.name='Manual / Foundation Source'
on conflict (source_id, external_id) do update
set title=excluded.title,
    funder_name=excluded.funder_name,
    funder=excluded.funder,
    description=excluded.description,
    eligibility_summary=excluded.eligibility_summary,
    eligibility_text=excluded.eligibility_text,
    country=excluded.country,
    region=excluded.region,
    focus_areas=excluded.focus_areas,
    keywords=excluded.keywords,
    min_award=excluded.min_award,
    max_award=excluded.max_award,
    currency=excluded.currency,
    deadline=excluded.deadline,
    posted_date=excluded.posted_date,
    status=excluded.status,
    url=excluded.url,
    source_payload=excluded.source_payload,
    raw_source_json=excluded.raw_source_json,
    last_synced_at=excluded.last_synced_at,
    imported_at=excluded.imported_at,
    last_checked_at=excluded.last_checked_at,
    updated_at=now();
