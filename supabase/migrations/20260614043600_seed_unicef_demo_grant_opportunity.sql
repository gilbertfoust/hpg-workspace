-- Additional Grant-Writer demo opportunity seed.

insert into public.grant_opportunities (
  source_id, external_id, title, funder_name, funder, description, eligibility_summary, eligibility_text,
  country, region, focus_areas, keywords, min_award, max_award, currency, deadline, posted_date,
  status, url, source_payload, raw_source_json, last_synced_at, imported_at, last_checked_at
)
select s.id, 'demo-unicef-girls-stem', 'UNICEF Girls in STEM Challenge', 'UNICEF', 'UNICEF',
'Funds education initiatives that improve girls access to STEM resources, teacher training, and community support.',
'Best fit for NGOs with girls education, STEM, technology access, teacher training, or community education support.',
'Eligible applicants should show education outcomes, gender equity, STEM access, and community support structures.',
'Regional', 'West Africa', array['education','gender','technology','community'], array['girls education','STEM','technology','teacher training','community support'],
150000, 750000, 'USD', date '2026-12-05', current_date,
'open', 'https://www.unicef.org/', jsonb_build_object('source','Grant-Writer demo seed'), jsonb_build_object('source','Grant-Writer demo seed'), now(), now(), now()
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
