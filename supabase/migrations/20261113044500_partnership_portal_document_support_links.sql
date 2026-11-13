-- Complete the Board portfolio's links to canonical documents and the Development handoff.
-- No new file bucket, donor CRM or grant pipeline is created.

create table if not exists public.partnership_portal_case_resources(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.partnership_portal_cases(id) on delete cascade,
 resource_type text not null check(resource_type in ('confluence','drive','proposal','presentation','research','agreement_draft','other')),
 title text not null check(length(btrim(title)) between 2 and 160),
 url text not null check(length(url) between 9 and 2048 and url ~* '^https://[^[:space:]]+$'),
 added_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(case_id,url)
);
alter table public.partnership_portal_case_resources enable row level security;
revoke all on public.partnership_portal_case_resources from public,anon,authenticated;
grant select on public.partnership_portal_case_resources to authenticated;
drop policy if exists partnership_case_resource_read on public.partnership_portal_case_resources;
create policy partnership_case_resource_read on public.partnership_portal_case_resources for select to authenticated
using(exists(select 1 from public.partnership_portal_cases c
 where c.id=case_id and (public.is_super_admin() or
   (public.can_access_partnership_portal() and c.owner_user_id=auth.uid()))));

create or replace function public.partnership_portal_link_resource(
 p_case_id uuid,p_title text,p_url text,p_type text default 'other')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.partnership_portal_cases where id=p_case_id
  and (owner_user_id=uid or public.is_super_admin())) then raise exception 'Case not assigned'; end if;
 if p_type not in ('confluence','drive','proposal','presentation','research','agreement_draft','other')
 then raise exception 'Unknown document type'; end if;
 if length(btrim(coalesce(p_title,''))) not between 2 and 160
 or length(coalesce(p_url,'')) not between 9 and 2048
 or p_url !~* '^https://[^[:space:]]+$'
 then raise exception 'Use a title and a valid HTTPS document link'; end if;
 insert into public.partnership_portal_case_resources(case_id,title,url,resource_type,added_by)
 values(p_case_id,btrim(p_title),p_url,p_type,uid)
 on conflict(case_id,url) do update set title=excluded.title
 returning id into rid;
 return rid;
end $$;
revoke all on function public.partnership_portal_link_resource(uuid,text,text,text) from public,anon;
grant execute on function public.partnership_portal_link_resource(uuid,text,text,text) to authenticated;

create table if not exists public.partnership_portal_support_requests(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.partnership_portal_cases(id) on delete cascade,
 requested_by uuid not null references auth.users(id),
 request_type text not null check(request_type in ('research','grant_writing','budget','program','communications','legal_compliance','other')),
 details text not null check(length(btrim(details)) between 10 and 5000),
 status text not null default 'submitted' check(status in ('submitted','routed','completed','closed')),
 work_item_id uuid references public.work_items(id) on delete set null,
 triaged_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists partnership_support_one_open_kind
 on public.partnership_portal_support_requests(case_id,request_type) where status='submitted';
create index if not exists partnership_support_case_date
 on public.partnership_portal_support_requests(case_id,created_at desc);
alter table public.partnership_portal_support_requests enable row level security;
revoke all on public.partnership_portal_support_requests from public,anon,authenticated;
grant select on public.partnership_portal_support_requests to authenticated;
drop policy if exists partnership_support_read on public.partnership_portal_support_requests;
create policy partnership_support_read on public.partnership_portal_support_requests for select to authenticated
using(
 (public.current_workspace_identity_active() and public.is_internal_user() and public.can_access_workspace_area('development'))
 or (public.can_access_partnership_portal() and requested_by=auth.uid())
);

create or replace function public.partnership_portal_request_support(
 p_case_id uuid,p_kind text,p_details text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.partnership_portal_cases c where c.id=p_case_id
 and (c.owner_user_id=uid or public.is_super_admin())) then raise exception 'Case not assigned'; end if;
 if p_kind not in ('research','grant_writing','budget','program','communications','legal_compliance','other')
 then raise exception 'Unknown support request category'; end if;
 if length(btrim(coalesce(p_details,''))) not between 10 and 5000
 then raise exception 'Explain the request in 10–5000 characters'; end if;
 insert into public.partnership_portal_support_requests(case_id,requested_by,request_type,details)
 values(p_case_id,uid,p_kind,btrim(p_details))
 on conflict(case_id,request_type) where status='submitted'
 do update set details=excluded.details,updated_at=now()
 returning id into rid;
 return rid;
end $$;
revoke all on function public.partnership_portal_request_support(uuid,text,text) from public,anon;
grant execute on function public.partnership_portal_request_support(uuid,text,text) to authenticated;

create or replace function public.partnership_portal_development_support_queue()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 if auth.uid() is null or not public.current_workspace_identity_active()
 or not public.is_internal_user() or not public.can_access_workspace_area('development')
 then raise exception 'Development authorization required'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into output
 from (select s.id,s.case_id,s.request_type,s.details,s.status,s.created_at,s.work_item_id,
   c.organization_name,c.program_alignment,c.geography
 from public.partnership_portal_support_requests s
 join public.partnership_portal_cases c on c.id=s.case_id
 order by s.created_at desc limit 100) x;
 return output;
end $$;
revoke all on function public.partnership_portal_development_support_queue() from public,anon;
grant execute on function public.partnership_portal_development_support_queue() to authenticated;

create or replace function public.partnership_portal_triage_support(p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); r public.partnership_portal_support_requests%rowtype; dept uuid; wid uuid; c_name text;
begin
 if uid is null or not public.current_workspace_identity_active()
 or not public.is_internal_user() or not public.can_access_workspace_area('development')
 then raise exception 'Development authorization required'; end if;
 select * into r from public.partnership_portal_support_requests where id=p_request_id for update;
 if not found or r.status<>'submitted' then raise exception 'Support request not available for triage'; end if;
 select organization_name into c_name from public.partnership_portal_cases where id=r.case_id;
 select id into dept from public.org_units where lower(btrim(department_name))='development' order by id limit 1;
 if dept is null then raise exception 'Development organizational unit missing'; end if;
 select id into wid from public.work_items
 where source_system='partnership_portal_support' and source_event_id=r.id::text and deleted_at is null limit 1;
 if wid is null then
 insert into public.work_items(module,type,title,description,department_id,created_by_user_id,
  status,priority,evidence_required,approval_required,external_visible,source_system,source_event_id)
 values('partnership','Partnership Support Request',
 left('Partnership '||replace(r.request_type,'_',' ')||' — '||coalesce(c_name,'Case'),240),
 'Board-linked partnership support request, case '||r.case_id::text||'. '||
 left(r.details,1500)||'. Research, grant writing, budgets and other specialized work must follow assigned departmental permissions; this request does not approve any financial or contractual commitment.',
 dept,uid,'Not Started','Normal',true,false,false,'partnership_portal_support',r.id::text)
 returning id into wid;
 end if;
 update public.partnership_portal_support_requests
 set status='routed',work_item_id=wid,triaged_by=uid,updated_at=now() where id=r.id;
 return wid;
end $$;
revoke all on function public.partnership_portal_triage_support(uuid) from public,anon;
grant execute on function public.partnership_portal_triage_support(uuid) to authenticated;

create or replace function public.partnership_portal_request_changes(p_request_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); r public.partnership_portal_review_requests%rowtype;
begin
 if uid is null or not public.current_workspace_identity_active()
 or not public.is_internal_user() or not public.can_access_workspace_area('development')
 then raise exception 'Development authorization required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 10 and 2000
 then raise exception 'Explain changes in 10–2000 characters'; end if;
 select * into r from public.partnership_portal_review_requests where id=p_request_id for update;
 if not found or r.status not in ('submitted','routed') then raise exception 'Request is not in review'; end if;
 update public.partnership_portal_review_requests set status='changes_requested',updated_at=now() where id=r.id;
 update public.partnership_portal_cases set review_status='changes_requested',stage='proposal',updated_at=now() where id=r.case_id;
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values(r.case_id,'note','Development requested changes: '||btrim(p_reason),uid);
end $$;
revoke all on function public.partnership_portal_request_changes(uuid,text) from public,anon;
grant execute on function public.partnership_portal_request_changes(uuid,text) to authenticated;

create or replace function public.partnership_portal_overview()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); output jsonb;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
 'cases',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc)
 from (select id,organization_name,organization_type,geography,contact_name,contact_email,summary,
 program_alignment,stage,review_status,next_action,next_action_due_at,proposal_narrative,
 requested_resources,estimated_cost_notes,source_prospect_id,review_work_item_id,created_at,updated_at
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
 order by d.prospect_name limit 100) p),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
 from (select r.id,r.case_id,r.title,r.url,r.resource_type,r.created_at from public.partnership_portal_case_resources r
 join public.partnership_portal_cases c on c.id=r.case_id
 where c.owner_user_id=uid or public.is_super_admin() order by r.created_at desc limit 150) x),'[]'::jsonb),
 'support_requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
 from (select s.id,s.case_id,s.request_type,s.details,s.status,s.work_item_id,s.created_at
 from public.partnership_portal_support_requests s
 join public.partnership_portal_cases c on c.id=s.case_id
 where c.owner_user_id=uid or public.is_super_admin() order by s.created_at desc limit 150) x),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_overview() from public,anon;
grant execute on function public.partnership_portal_overview() to authenticated;
