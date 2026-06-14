-- Starter records for Development Grant Writer Tracker Club.
-- These are safe idempotent seeds from the original Grant-Writer demo concept.

insert into public.grant_sources (name, funder_type, source_type, base_url, notes)
values
('Grants.gov', 'government', 'public_database', 'https://www.grants.gov/', 'Federal grant opportunity source. Public ingestion integration should be added in a later phase.'),
('USAspending.gov', 'government', 'public_database', 'https://www.usaspending.gov/', 'Historical federal award data source for funder intelligence and award pattern analysis.'),
('HPG Manual / Foundation Research', 'foundation', 'manual', null, 'Manual/private foundation and curated funder research source.')
on conflict (name) do update
set funder_type = excluded.funder_type,
    source_type = excluded.source_type,
    base_url = excluded.base_url,
    notes = excluded.notes,
    updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, last_synced_at)
select s.id, 'grant-usaid-wash', 'USAID WASH Innovation Fund', 'USAID',
       'Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.',
       'East Africa', array['water','sanitation','hygiene','innovation'], array['wash','water','sanitation','hygiene'],
       250000, 1000000, 'USD', '2026-10-15', 'open', 'https://www.usaid.gov/',
       jsonb_build_object('seed_source','Grant-Writer demo'), now()
from public.grant_sources s where s.name = 'HPG Manual / Foundation Research'
on conflict (source_id, external_id) do update
set title = excluded.title,
    funder_name = excluded.funder_name,
    description = excluded.description,
    region = excluded.region,
    focus_areas = excluded.focus_areas,
    keywords = excluded.keywords,
    min_award = excluded.min_award,
    max_award = excluded.max_award,
    deadline = excluded.deadline,
    status = excluded.status,
    url = excluded.url,
    source_payload = excluded.source_payload,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, last_synced_at)
select s.id, 'grant-gates-climate', 'Gates Foundation Climate-Smart Agriculture', 'Bill & Melinda Gates Foundation',
       'Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.',
       'South Asia', array['climate','agriculture','finance','digital'], array['climate','agriculture','smallholder','digital'],
       500000, 2000000, 'USD', '2026-11-01', 'open', 'https://www.gatesfoundation.org/',
       jsonb_build_object('seed_source','Grant-Writer demo'), now()
from public.grant_sources s where s.name = 'HPG Manual / Foundation Research'
on conflict (source_id, external_id) do update
set title = excluded.title,
    funder_name = excluded.funder_name,
    description = excluded.description,
    region = excluded.region,
    focus_areas = excluded.focus_areas,
    keywords = excluded.keywords,
    min_award = excluded.min_award,
    max_award = excluded.max_award,
    deadline = excluded.deadline,
    status = excluded.status,
    url = excluded.url,
    source_payload = excluded.source_payload,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, last_synced_at)
select s.id, 'grant-unicef-girls', 'UNICEF Girls in STEM Challenge', 'UNICEF',
       'Funds education initiatives that improve girls access to STEM resources, teacher training, and community support.',
       'West Africa', array['education','gender','technology','community'], array['education','gender','stem','technology'],
       150000, 750000, 'USD', '2026-12-05', 'open', 'https://www.unicef.org/',
       jsonb_build_object('seed_source','Grant-Writer demo'), now()
from public.grant_sources s where s.name = 'HPG Manual / Foundation Research'
on conflict (source_id, external_id) do update
set title = excluded.title,
    funder_name = excluded.funder_name,
    description = excluded.description,
    region = excluded.region,
    focus_areas = excluded.focus_areas,
    keywords = excluded.keywords,
    min_award = excluded.min_award,
    max_award = excluded.max_award,
    deadline = excluded.deadline,
    status = excluded.status,
    url = excluded.url,
    source_payload = excluded.source_payload,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();
