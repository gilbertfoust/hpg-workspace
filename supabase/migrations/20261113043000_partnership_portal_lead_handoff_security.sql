-- Security and de-duplication QA hardening for the Board portfolio.
-- Not an operational access grant; George and all other unassigned users remain blocked.

create table if not exists public.partnership_portal_lead_shares(
 prospect_id uuid not null references public.development_outreach_prospects(id) on delete cascade,
 portfolio_user_id uuid not null references auth.users(id) on delete cascade,
 shared_by uuid not null references auth.users(id),
 shared_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(prospect_id,portfolio_user_id)
);
alter table public.partnership_portal_lead_shares enable row level security;
revoke all on public.partnership_portal_lead_shares from public,anon,authenticated;
grant select on public.partnership_portal_lead_shares to authenticated;
drop policy if exists partnership_lead_share_read on public.partnership_portal_lead_shares;
create policy partnership_lead_share_read on public.partnership_portal_lead_shares for select to authenticated
using(
 (public.current_workspace_identity_active() and public.is_internal_user() and public.can_access_workspace_area('development'))
 or ((select public.can_access_partnership_portal()) and portfolio_user_id=(select auth.uid()))
);

-- A Board member may have a detailed work case for one canonical Development prospect;
-- it must not make a second work case for that same organization.
create unique index if not exists partnership_portal_owner_organization_unique
on public.partnership_portal_cases(owner_user_id,lower(btrim(organization_name)));
create unique index if not exists partnership_portal_owner_prospect_unique
on public.partnership_portal_cases(owner_user_id,source_prospect_id)
where source_prospect_id is not null;

create or replace function public.partnership_portal_share_lead(p_prospect_id uuid,p_portfolio_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not public.current_workspace_identity_active()
   or not public.is_internal_user() or not public.can_access_workspace_area('development')
 then raise exception 'Development authorization required'; end if;
 if not exists(select 1 from public.development_outreach_prospects where id=p_prospect_id)
 then raise exception 'Prospect not found'; end if;
 if not exists(select 1 from public.partnership_portal_assignments a
   join public.bod_memberships b on b.user_id=a.user_id
   where a.user_id=p_portfolio_user_id and a.is_active and b.is_active)
 then raise exception 'Board portfolio assignment must be authorized first'; end if;
 insert into public.partnership_portal_lead_shares(prospect_id,portfolio_user_id,shared_by,revoked_at,shared_at)
 values(p_prospect_id,p_portfolio_user_id,uid,null,now())
 on conflict(prospect_id,portfolio_user_id) do update
   set revoked_at=null,shared_at=now(),shared_by=excluded.shared_by;
end $$;
revoke all on function public.partnership_portal_share_lead(uuid,uuid) from public,anon;
grant execute on function public.partnership_portal_share_lead(uuid,uuid) to authenticated;

create or replace function public.partnership_portal_development_leads()
returns jsonb language plpgsql security definer stable set search_path=public,pg_temp as $$
declare output jsonb;
begin
 if auth.uid() is null or not public.current_workspace_identity_active()
   or not public.is_internal_user() or not public.can_access_workspace_area('development')
 then raise exception 'Development authorization required'; end if;
 select jsonb_build_object(
   'prospects',coalesce((select jsonb_agg(to_jsonb(x) order by x.prospect_name)
     from (select id,prospect_name,prospect_type,geography
       from public.development_outreach_prospects order by prospect_name limit 150) x),'[]'::jsonb),
   'portfolio_users',coalesce((select jsonb_agg(to_jsonb(y) order by y.full_name)
     from (select a.user_id,p.full_name,a.operational_title
     from public.partnership_portal_assignments a
     join public.bod_memberships b on b.user_id=a.user_id and b.is_active
     join public.profiles p on p.id=a.user_id
     where a.is_active and p.access_status='active'
     order by p.full_name limit 30) y),'[]'::jsonb),
   'shared',coalesce((select jsonb_agg(jsonb_build_object(
     'prospect_id',s.prospect_id,'user_id',s.portfolio_user_id,'revoked_at',s.revoked_at))
     from public.partnership_portal_lead_shares s),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_development_leads() from public,anon;
grant execute on function public.partnership_portal_development_leads() to authenticated;

create or replace function public.partnership_portal_create_case(
 p_name text,p_type text default 'community_partner',p_geography text default null,
 p_contact_name text default null,p_contact_email text default null,
 p_program text default null,p_summary text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); cid uuid; pid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 240 then raise exception 'Organization name required'; end if;
 select id into cid from public.partnership_portal_cases
  where owner_user_id=uid and lower(btrim(organization_name))=lower(btrim(p_name)) limit 1;
 if cid is not null then return cid; end if;
 select id into pid from public.development_outreach_prospects
 where lower(btrim(prospect_name))=lower(btrim(p_name)) order by id limit 1;
 if pid is not null and not public.is_super_admin()
   and not exists(select 1 from public.partnership_portal_lead_shares
        where prospect_id=pid and portfolio_user_id=uid and revoked_at is null)
 then raise exception 'An existing Development prospect requires an explicit portfolio handoff'; end if;
 if pid is null then
   insert into public.development_outreach_prospects(
    prospect_name,prospect_type,geography,contact_name,contact_email,owner_user_id,
    source_reference,notes)
   values (btrim(p_name),
    case when p_type='foundation' then 'foundation' else 'community_partner' end,
    nullif(btrim(p_geography),''),nullif(btrim(p_contact_name),''),
    nullif(btrim(p_contact_email),''),uid,'partnership_portal',
    'Board relationship prospect; research and agreements remain separately controlled.')
   on conflict (prospect_name) do nothing returning id into pid;
   if pid is null then
     select id into pid from public.development_outreach_prospects
     where lower(btrim(prospect_name))=lower(btrim(p_name)) order by id limit 1;
   end if;
 end if;
 insert into public.partnership_portal_cases
 (organization_name,organization_type,geography,contact_name,contact_email,program_alignment,summary,
  source_prospect_id,owner_user_id,created_by)
 values(btrim(p_name),coalesce(nullif(btrim(p_type),''),'community_partner'),
   nullif(btrim(p_geography),''),nullif(btrim(p_contact_name),''),
   nullif(btrim(p_contact_email),''),nullif(btrim(p_program),''),
   coalesce(p_summary,''),pid,uid,uid)
 on conflict do nothing returning id into cid;
 if cid is null then
   select id into cid from public.partnership_portal_cases
    where owner_user_id=uid and lower(btrim(organization_name))=lower(btrim(p_name)) limit 1;
 end if;
 if cid is null then raise exception 'Unable to create case without duplication'; end if;
 return cid;
end $$;
revoke all on function public.partnership_portal_create_case(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.partnership_portal_create_case(text,text,text,text,text,text,text) to authenticated;

create or replace function public.partnership_portal_import_prospect(p_prospect_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); rec record; cid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 if not public.is_super_admin() and not exists(
  select 1 from public.partnership_portal_lead_shares s
  where s.portfolio_user_id=uid and s.prospect_id=p_prospect_id and s.revoked_at is null)
 then raise exception 'This lead was not assigned to the Board portfolio'; end if;
 select * into rec from public.development_outreach_prospects where id=p_prospect_id;
 if not found then raise exception 'Prospect not found'; end if;
 select id into cid from public.partnership_portal_cases where owner_user_id=uid
 and (source_prospect_id=p_prospect_id or lower(btrim(organization_name))=lower(btrim(rec.prospect_name))) limit 1;
 if cid is not null then return cid; end if;
 insert into public.partnership_portal_cases
 (organization_name,organization_type,geography,contact_name,contact_email,summary,
 source_prospect_id,owner_user_id,created_by)
 values(rec.prospect_name,rec.prospect_type,rec.geography,rec.contact_name,rec.contact_email,
 'Imported from an explicitly assigned Development prospect',rec.id,uid,uid)
 on conflict do nothing returning id into cid;
 if cid is null then
 select id into cid from public.partnership_portal_cases
 where owner_user_id=uid and source_prospect_id=p_prospect_id limit 1; end if;
 if cid is null then raise exception 'Unable to import lead without duplication'; end if;
 return cid;
end $$;
revoke all on function public.partnership_portal_import_prospect(uuid) from public,anon;
grant execute on function public.partnership_portal_import_prospect(uuid) to authenticated;

-- Research continues even while a partnership proposal is under review.
create or replace function public.partnership_portal_record_activity(
 p_case_id uuid,p_kind text,p_details text,p_next_action text default null,
 p_due_at timestamptz default null,p_new_stage text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); c public.partnership_portal_cases%rowtype; eid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then
  raise exception 'Case is not assigned to you'; end if;
 if p_kind not in ('outreach','meeting','follow_up','proposal','outcome','note') then
  raise exception 'Unknown activity type'; end if;
 if length(btrim(coalesce(p_details,''))) not between 3 and 10000 then
  raise exception 'Activity details required'; end if;
 if p_new_stage is not null and
   (p_new_stage not in ('identified','outreach','discovery','proposal','closed')
    or c.review_status not in ('not_submitted','changes_requested'))
 then raise exception 'Approval stages and cases under review cannot be changed by activity'; end if;
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values(p_case_id,p_kind,btrim(p_details),uid) returning id into eid;
 update public.partnership_portal_cases set
   next_action=coalesce(nullif(btrim(p_next_action),''),next_action),
   next_action_due_at=coalesce(p_due_at,next_action_due_at),
   stage=coalesce(p_new_stage,stage),updated_at=now() where id=p_case_id;
 return eid;
end $$;
revoke all on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) to authenticated;

create or replace function public.partnership_portal_overview()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); output jsonb;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
 'cases',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc)
 from (select id,organization_name,organization_type,geography,contact_name,contact_email,
 summary,program_alignment,stage,review_status,next_action,next_action_due_at,
 proposal_narrative,requested_resources,estimated_cost_notes,source_prospect_id,review_work_item_id,created_at,updated_at
 from public.partnership_portal_cases where owner_user_id=uid or public.is_super_admin()
 order by updated_at desc limit 100) c),'[]'::jsonb),
 'activities',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
 from (select x.id,x.case_id,x.activity_type,x.details,x.created_at
 from public.partnership_portal_activities x join public.partnership_portal_cases c on c.id=x.case_id
 where c.owner_user_id=uid or public.is_super_admin()
 order by x.created_at desc limit 150) a),'[]'::jsonb),
 'available_prospects',coalesce((select jsonb_agg(to_jsonb(p) order by p.prospect_name)
 from (select d.id,d.prospect_name,d.prospect_type,d.geography
 from public.partnership_portal_lead_shares s
 join public.development_outreach_prospects d on d.id=s.prospect_id
 where s.portfolio_user_id=uid and s.revoked_at is null
 and not exists(select 1 from public.partnership_portal_cases c where c.source_prospect_id=d.id and c.owner_user_id=uid)
 order by d.prospect_name limit 100) p),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_overview() from public,anon;
grant execute on function public.partnership_portal_overview() to authenticated;
