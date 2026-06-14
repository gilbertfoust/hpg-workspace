-- Seed the Grant STW demo opportunities into the production grant opportunity table.

insert into public.grant_opportunities (source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text, country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, raw_source_json, last_synced_at, imported_at)
select s.id, 'grant-usaid-wash', 'USAID WASH Innovation Fund', 'USAID', 'USAID', 'Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.', 'Demo eligibility details to be replaced by source ingestion.', 'Demo eligibility details to be replaced by source ingestion.', null, 'East Africa', array['water','sanitation','hygiene','innovation'], array['water','sanitation','hygiene','innovation','community','sustainability'], 250000, 1000000, 'USD', date '2024-10-15', 'open', 'https://www.usaid.gov/', jsonb_build_object('source','Grant STW Demo Source'), jsonb_build_object('source','Grant STW Demo Source'), now(), now()
from public.grant_sources s where s.name = 'Grant STW Demo Source'
on conflict (source_id, external_id) do update set
  title = excluded.title,
  funder_name = excluded.funder_name,
  funder = excluded.funder,
  description = excluded.description,
  eligibility_summary = excluded.eligibility_summary,
  eligibility_text = excluded.eligibility_text,
  region = excluded.region,
  focus_areas = excluded.focus_areas,
  keywords = excluded.keywords,
  min_award = excluded.min_award,
  max_award = excluded.max_award,
  currency = excluded.currency,
  deadline = excluded.deadline,
  status = excluded.status,
  url = excluded.url,
  source_payload = excluded.source_payload,
  raw_source_json = excluded.raw_source_json,
  last_synced_at = excluded.last_synced_at,
  imported_at = excluded.imported_at,
  updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text, country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, raw_source_json, last_synced_at, imported_at)
select s.id, 'grant-gates-climate', 'Gates Foundation Climate-Smart Agriculture', 'Bill & Melinda Gates Foundation', 'Bill & Melinda Gates Foundation', 'Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.', 'Demo eligibility details to be replaced by source ingestion.', 'Demo eligibility details to be replaced by source ingestion.', null, 'South Asia', array['climate','agriculture','finance','digital'], array['climate','agriculture','finance','digital','smallholder','adaptation'], 500000, 2000000, 'USD', date '2024-11-01', 'open', 'https://www.gatesfoundation.org/', jsonb_build_object('source','Grant STW Demo Source'), jsonb_build_object('source','Grant STW Demo Source'), now(), now()
from public.grant_sources s where s.name = 'Grant STW Demo Source'
on conflict (source_id, external_id) do update set
  title = excluded.title,
  funder_name = excluded.funder_name,
  funder = excluded.funder,
  description = excluded.description,
  eligibility_summary = excluded.eligibility_summary,
  eligibility_text = excluded.eligibility_text,
  region = excluded.region,
  focus_areas = excluded.focus_areas,
  keywords = excluded.keywords,
  min_award = excluded.min_award,
  max_award = excluded.max_award,
  currency = excluded.currency,
  deadline = excluded.deadline,
  status = excluded.status,
  url = excluded.url,
  source_payload = excluded.source_payload,
  raw_source_json = excluded.raw_source_json,
  last_synced_at = excluded.last_synced_at,
  imported_at = excluded.imported_at,
  updated_at = now();

insert into public.grant_opportunities (source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text, country, region, focus_areas, keywords, min_award, max_award, currency, deadline, status, url, source_payload, raw_source_json, last_synced_at, imported_at)
select s.id, 'grant-unicef-girls', 'UNICEF Girls in STEM Challenge', 'UNICEF', 'UNICEF', 'Funds education initiatives that improve girls access to STEM resources, teacher training, and community support.', 'Demo eligibility details to be replaced by source ingestion.', 'Demo eligibility details to be replaced by source ingestion.', null, 'West Africa', array['education','gender','technology','community'], array['education','gender','technology','community','stem','girls'], 150000, 750000, 'USD', date '2024-12-05', 'open', 'https://www.unicef.org/', jsonb_build_object('source','Grant STW Demo Source'), jsonb_build_object('source','Grant STW Demo Source'), now(), now()
from public.grant_sources s where s.name = 'Grant STW Demo Source'
on conflict (source_id, external_id) do update set
  title = excluded.title,
  funder_name = excluded.funder_name,
  funder = excluded.funder,
  description = excluded.description,
  eligibility_summary = excluded.eligibility_summary,
  eligibility_text = excluded.eligibility_text,
  region = excluded.region,
  focus_areas = excluded.focus_areas,
  keywords = excluded.keywords,
  min_award = excluded.min_award,
  max_award = excluded.max_award,
  currency = excluded.currency,
  deadline = excluded.deadline,
  status = excluded.status,
  url = excluded.url,
  source_payload = excluded.source_payload,
  raw_source_json = excluded.raw_source_json,
  last_synced_at = excluded.last_synced_at,
  imported_at = excluded.imported_at,
  updated_at = now();
