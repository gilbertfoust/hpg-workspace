-- Specialized proposal triage is not generic shared-governance work; Board motions remain separate.
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
     dept,uid,'Not Started','High',true,true,false,false,'partnership_portal_review',r.case_id::text)
   returning id into wid;
 end if;
 update public.partnership_portal_review_requests set status='routed',work_item_id=wid,
 triaged_by=uid,triaged_at=now(),updated_at=now() where id=r.id;
 update public.partnership_portal_cases set review_work_item_id=wid,updated_at=now() where id=r.case_id;
 return wid;
end $$;
revoke all on function public.partnership_portal_triage_review(uuid) from public,anon;
grant execute on function public.partnership_portal_triage_review(uuid) to authenticated;
