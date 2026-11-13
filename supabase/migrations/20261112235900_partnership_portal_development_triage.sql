-- Separation of duties: Board portfolio holders submit requests; Development staff create governed work items.
create table if not exists public.partnership_portal_review_requests(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null unique references public.partnership_portal_cases(id) on delete cascade,
 submitted_by uuid not null references auth.users(id),
 status text not null default 'submitted' check (status in ('submitted','routed','changes_requested','closed')),
 work_item_id uuid references public.work_items(id) on delete set null,
 triaged_by uuid references auth.users(id),
 triaged_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.partnership_portal_review_requests enable row level security;
revoke all on public.partnership_portal_review_requests from anon,authenticated;
grant select on public.partnership_portal_review_requests to authenticated;
drop policy if exists partnership_review_request_read on public.partnership_portal_review_requests;
create policy partnership_review_request_read on public.partnership_portal_review_requests for select to authenticated
using (
  (public.current_workspace_identity_active() and public.can_access_workspace_area('development'))
  or (public.can_access_partnership_portal() and submitted_by=auth.uid())
);

create or replace function public.partnership_portal_submit_review(
 p_case_id uuid,p_proposal text,p_resources text,p_cost_notes text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); c public.partnership_portal_cases%rowtype;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then
   raise exception 'Case is not assigned to you';
 end if;
 if c.review_status not in ('not_submitted','changes_requested') then raise exception 'Already under review'; end if;
 if length(btrim(coalesce(p_proposal,'')))<60 or length(btrim(coalesce(p_resources,'')))<10 then
   raise exception 'Proposal and resource assessment must be complete';
 end if;
 update public.partnership_portal_cases set proposal_narrative=btrim(p_proposal),
  requested_resources=btrim(p_resources),estimated_cost_notes=coalesce(p_cost_notes,''),
  stage='review_requested',review_status='submitted',updated_at=now()
 where id=p_case_id;
 insert into public.partnership_portal_review_requests(case_id,submitted_by,status)
 values(p_case_id,uid,'submitted')
 on conflict(case_id) do update set status='submitted',submitted_by=excluded.submitted_by,
  triaged_by=null,triaged_at=null,updated_at=now();
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values(p_case_id,'review_submission',
  'Proposal submitted to Development triage; no work item, Board motion or binding agreement has been authorized.',uid);
end $$;
revoke all on function public.partnership_portal_submit_review(uuid,text,text,text) from public,anon;
grant execute on function public.partnership_portal_submit_review(uuid,text,text,text) to authenticated;

create or replace function public.partnership_portal_development_queue()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 if auth.uid() is null or not public.current_workspace_identity_active()
    or not public.can_access_workspace_area('development') or not public.is_internal_user()
 then raise exception 'Development authorization required'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into output
 from (select r.id,r.case_id,r.status,r.created_at,r.work_item_id,
 c.organization_name,c.program_alignment,c.geography,c.proposal_narrative,c.requested_resources,
 c.estimated_cost_notes,c.owner_user_id
 from public.partnership_portal_review_requests r
 join public.partnership_portal_cases c on c.id=r.case_id
 order by r.created_at desc limit 100) q;
 return output;
end $$;
revoke all on function public.partnership_portal_development_queue() from public,anon;
grant execute on function public.partnership_portal_development_queue() to authenticated;

create or replace function public.partnership_portal_triage_review(p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); r public.partnership_portal_review_requests%rowtype;
 c public.partnership_portal_cases%rowtype; dept uuid; wid uuid;
begin
 if uid is null or not public.current_workspace_identity_active() or
    not public.can_access_workspace_area('development') or not public.is_internal_user()
 then raise exception 'Development authorization required'; end if;
 select * into r from public.partnership_portal_review_requests where id=p_request_id for update;
 if not found then raise exception 'Review request not found'; end if;
 if r.status<>'submitted' then raise exception 'Review is already routed or closed'; end if;
 select * into c from public.partnership_portal_cases where id=r.case_id;
 if not found then raise exception 'Related case unavailable'; end if;
 select d.id into dept from public.departments d where d.module='development' and d.is_active order by d.id limit 1;
 if dept is null then raise exception 'Development department not configured'; end if;
 select id into wid from public.work_items
 where source_system='partnership_portal_review' and source_event_id=r.case_id::text
 and deleted_at is null limit 1;
 if wid is null then
   insert into public.work_items(module,type,title,description,department_id,created_by_user_id,
     status,priority,evidence_required,approval_required,external_visible,shared_governance_required,source_system,source_event_id)
   values('partnership','Partnership Proposal Review',left('Partnership review — '||c.organization_name,240),
     'Partnership proposal from the Board-linked portfolio. Development must coordinate Finance, Compliance, Program and General Counsel input as applicable, then executive and Board approvals where required. No legal or financial commitment authorized. Case: '||c.id::text,
     dept,uid,'Not Started','High',true,true,false,true,'partnership_portal_review',r.case_id::text)
   returning id into wid;
 end if;
 update public.partnership_portal_review_requests set status='routed',work_item_id=wid,
 triaged_by=uid,triaged_at=now(),updated_at=now() where id=r.id;
 update public.partnership_portal_cases set review_work_item_id=wid,updated_at=now() where id=r.case_id;
 return wid;
end $$;
revoke all on function public.partnership_portal_triage_review(uuid) from public,anon;
grant execute on function public.partnership_portal_triage_review(uuid) to authenticated;
