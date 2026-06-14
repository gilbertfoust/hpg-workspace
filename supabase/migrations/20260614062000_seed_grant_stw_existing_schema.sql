-- Seed Grant STW demo records into the existing production grant schema.
-- This intentionally uses the current grant_sources / grant_opportunities shape
-- instead of creating duplicate grant tables.

insert into public.grant_sources (name, funder_type, source_type, base_url, notes, is_active)
select 'USAID', 'government', 'manual_seed', 'https://www.usaid.gov/', 'Seeded from Grant-Writer STW demo data. Connect to Grants.gov/USAID source later.', true
where not exists (select 1 from public.grant_sources where name = 'USAID');

insert into public.grant_sources (name, funder_type, source_type, base_url, notes, is_active)
select 'Bill & Melinda Gates Foundation', 'foundation', 'manual_seed', 'https://www.gatesfoundation.org/', 'Seeded from Grant-Writer STW demo data. Private foundation intelligence should be curated/licensed later.', true
where not exists (select 1 from public.grant_sources where name = 'Bill & Melinda Gates Foundation');

insert into public.grant_sources (name, funder_type, source_type, base_url, notes, is_active)
select 'UNICEF', 'multilateral', 'manual_seed', 'https://www.unicef.org/', 'Seeded from Grant-Writer STW demo data.', true
where not exists (select 1 from public.grant_sources where name = 'UNICEF');

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url,
  source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'grant-usaid-wash', 'USAID WASH Innovation Fund', 'USAID', 'USAID',
       'Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.',
       'Community-led WASH programs with sustainability plans.',
       'Eligible applicants should demonstrate WASH impact, local implementation capacity, and community engagement.',
       null, 'East Africa', array['water','sanitation','hygiene','innovation'], array['wash','water','sanitation','hygiene','infrastructure'],
       250000, 1000000, 'USD', '2024-10-15'::date, 'open', 'https://www.usaid.gov/',
       jsonb_build_object('seeded_from','Grant-Writer demo data'), jsonb_build_object('seeded_from','Grant-Writer demo data'), now(), now(), now()
from public.grant_sources s
where s.name = 'USAID'
  and not exists (select 1 from public.grant_opportunities o where o.external_id = 'grant-usaid-wash');

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url,
  source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'grant-gates-climate', 'Gates Foundation Climate-Smart Agriculture', 'Bill & Melinda Gates Foundation', 'Bill & Melinda Gates Foundation',
       'Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.',
       'Climate-smart agriculture, smallholder resilience, digital advisory, and finance programs.',
       'Eligible programs should focus on agriculture, climate adaptation, resilience, and inclusive finance.',
       null, 'South Asia', array['climate','agriculture','finance','digital'], array['climate','agriculture','farmers','finance','digital'],
       500000, 2000000, 'USD', '2024-11-01'::date, 'open', 'https://www.gatesfoundation.org/',
       jsonb_build_object('seeded_from','Grant-Writer demo data'), jsonb_build_object('seeded_from','Grant-Writer demo data'), now(), now(), now()
from public.grant_sources s
where s.name = 'Bill & Melinda Gates Foundation'
  and not exists (select 1 from public.grant_opportunities o where o.external_id = 'grant-gates-climate');

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url,
  source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'grant-unicef-girls', 'UNICEF Girls in STEM Challenge', 'UNICEF', 'UNICEF',
       'Funds education initiatives that improve girls access to STEM resources, teacher training, and community support.',
       'Girls education, STEM access, teacher training, and community support programs.',
       'Eligible programs should demonstrate education equity, gender inclusion, and community implementation capacity.',
       null, 'West Africa', array['education','gender','technology','community'], array['girls','stem','education','gender','technology'],
       150000, 750000, 'USD', '2024-12-05'::date, 'open', 'https://www.unicef.org/',
       jsonb_build_object('seeded_from','Grant-Writer demo data'), jsonb_build_object('seeded_from','Grant-Writer demo data'), now(), now(), now()
from public.grant_sources s
where s.name = 'UNICEF'
  and not exists (select 1 from public.grant_opportunities o where o.external_id = 'grant-unicef-girls');
