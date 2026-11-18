-- Publish only grant information selected for use in NGO portals. Internal catalog
-- narratives, match lists and source-system links remain in Development.
alter table public.grant_opportunities
  add column if not exists ngo_portal_copy jsonb;

comment on column public.grant_opportunities.ngo_portal_copy is
  'Funder-facing public facts approved for all NGO portals: title, funder_name, description, eligibility_summary, url. Never include applicant information.';

create or replace function public.ngo_portal_grants(
  p_ngo_id uuid, p_preview boolean default false, p_offset integer default 0, p_limit integer default 20
) returns jsonb
language plpgsql stable security definer set search_path to ''
as $function$
declare
  result jsonb;
begin
  perform public.ngo_portal_overview(p_ngo_id, p_preview);
  if p_offset is null or p_limit is null or p_offset < 0 or p_limit not between 1 and 50 then
    raise exception 'Invalid page';
  end if;

  with own_rows as (
    select a.id, a.opportunity_id, 'application'::text as kind,
      case when a.opportunity_id is null then a.title end as own_title,
      a.stage, coalesce(a.deadline, a.due_date) as case_deadline, a.amount_requested,
      a.amount_awarded, a.currency, a.submitted_at, a.updated_at
    from public.grant_applications a
    where a.ngo_id = p_ngo_id and a.deleted_at is null
    union all
    select g.id, g.opportunity_id, 'identified', null, g.pursuit_decision, null,
      null, null, null, null, g.updated_at
    from public.grant_alignments g
    join public.grant_opportunities visible on visible.id = g.opportunity_id and visible.deleted_at is null
    where g.ngo_id = p_ngo_id
      and g.pursuit_decision in ('researching', 'pursue', 'on_hold')
      and g.decided_at is not null
      and not exists (
        select 1 from public.grant_applications a
        where a.ngo_id = p_ngo_id and a.opportunity_id = g.opportunity_id and a.deleted_at is null
      )
  ), page as (
    select r.id, r.opportunity_id, r.kind,
      coalesce(nullif(o.ngo_portal_copy->>'title', ''), r.own_title, 'Funding opportunity') as title,
      o.ngo_portal_copy->>'funder_name' as funder_name,
      o.ngo_portal_copy->>'description' as description,
      o.ngo_portal_copy->>'eligibility_summary' as eligibility_summary,
      case when o.ngo_portal_copy->>'url' ~* '^https://[^[:space:]]+$'
        then o.ngo_portal_copy->>'url' end as url,
      r.stage, coalesce(r.case_deadline, o.deadline) as deadline,
      r.amount_requested, r.amount_awarded,
      case when r.kind = 'identified' then o.currency else r.currency end as currency,
      r.submitted_at, r.updated_at
    from own_rows r
    left join public.grant_opportunities o on o.id = r.opportunity_id and o.deleted_at is null
    order by r.updated_at desc, r.id offset p_offset limit p_limit
  )
  select jsonb_build_object(
    'total', (select count(*) from own_rows),
    'rows', coalesce((select jsonb_agg(to_jsonb(page) order by updated_at desc, id) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;
