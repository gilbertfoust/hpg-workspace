-- Starter sources and opportunities for the Development Grant Writer Tracker.
-- These are idempotent and safe to re-run.

insert into public.grant_sources (name, funder_type, website_url, source_type, public_database, notes)
values
('Grants.gov', 'federal', 'https://www.grants.gov/', 'public_database', 'grants_gov', 'Primary federal funding opportunity discovery source.'),
('USAspending.gov', 'federal_awards', 'https://www.usaspending.gov/', 'public_database', 'usaspending', 'Historical federal award and spending pattern source.'),
('SAM.gov Assistance Listings', 'federal_programs', 'https://sam.gov/', 'public_database', 'sam_gov', 'Federal assistance listings and entity/program context.'),
('Manual / Foundation Source', 'foundation', null, 'manual', 'manual', 'Manual entry source for private foundations and curated opportunities.')
on conflict (name) do update
set funder_type = excluded.funder_type,
    website_url = excluded.website_url,
    source_type = excluded.source_type,
    public_database = excluded.public_database,
    notes = excluded.notes,
    updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, country, region, focus_areas, min_award, max_award, deadline, status, url, raw_json, last_synced_at)
select s.id, 'demo-usaid-wash', 'USAID WASH Innovation Fund', 'USAID', 'Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.', 'Regional', 'East Africa', array['water','sanitation','hygiene','innovation'], 250000, 1000000, date '2026-10-15', 'open', 'https://www.usaid.gov/', jsonb_build_object('source','Grant-Writer demo seed'), now()
from public.grant_sources s where s.name='Grants.gov'
on conflict (source_id, external_id) do update
set title=excluded.title,
    funder_name=excluded.funder_name,
    description=excluded.description,
    country=excluded.country,
    region=excluded.region,
    focus_areas=excluded.focus_areas,
    min_award=excluded.min_award,
    max_award=excluded.max_award,
    deadline=excluded.deadline,
    status=excluded.status,
    url=excluded.url,
    raw_json=excluded.raw_json,
    last_synced_at=excluded.last_synced_at,
    updated_at=now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, country, region, focus_areas, min_award, max_award, deadline, status, url, raw_json, last_synced_at)
select s.id, 'demo-gates-climate', 'Gates Foundation Climate-Smart Agriculture', 'Bill & Melinda Gates Foundation', 'Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.', 'Regional', 'South Asia', array['climate','agriculture','finance','digital'], 500000, 2000000, date '2026-11-01', 'open', 'https://www.gatesfoundation.org/', jsonb_build_object('source','Grant-Writer demo seed'), now()
from public.grant_sources s where s.name='Manual / Foundation Source'
on conflict (source_id, external_id) do update
set title=excluded.title,
    funder_name=excluded.funder_name,
    description=excluded.description,
    country=excluded.country,
    region=excluded.region,
    focus_areas=excluded.focus_areas,
    min_award=excluded.min_award,
    max_award=excluded.max_award,
    deadline=excluded.deadline,
    status=excluded.status,
    url=excluded.url,
    raw_json=excluded.raw_json,
    last_synced_at=excluded.last_synced_at,
    updated_at=now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, description, country, region, focus_areas, min_award, max_award, deadline, status, url, raw_json, last_synced_at)
select s.id, 'demo-unicef-girls-stem', 'UNICEF Girls in STEM Challenge', 'UNICEF', 'Funds education initiatives that improve girls access to STEM resources, teacher training, and community support.', 'Regional', 'West Africa', array['education','gender','technology','community'], 150000, 750000, date '2026-12-05', 'open', 'https://www.unicef.org/', jsonb_build_object('source','Grant-Writer demo seed'), now()
from public.grant_sources s where s.name='Manual / Foundation Source'
on conflict (source_id, external_id) do update
set title=excluded.title,
    funder_name=excluded.funder_name,
    description=excluded.description,
    country=excluded.country,
    region=excluded.region,
    focus_areas=excluded.focus_areas,
    min_award=excluded.min_award,
    max_award=excluded.max_award,
    deadline=excluded.deadline,
    status=excluded.status,
    url=excluded.url,
    raw_json=excluded.raw_json,
    last_synced_at=excluded.last_synced_at,
    updated_at=now();

-- Remove older demo rows that used 2024 dates and duplicate labels from earlier prototypes.
delete from public.grant_opportunities
where external_id in ('grant-usaid-wash','grant-gates-climate','grant-unicef-girls')
  and deadline < current_date;

with ranked as (
  select id,
         row_number() over (
           partition by title, funder_name, deadline
           order by case when external_id like 'demo-%' then 0 else 1 end, created_at desc
         ) as rn
  from public.grant_opportunities
)
delete from public.grant_opportunities g
using ranked r
where g.id = r.id and r.rn > 1;
