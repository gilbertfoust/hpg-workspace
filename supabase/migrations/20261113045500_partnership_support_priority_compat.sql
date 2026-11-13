-- Keep HPG's canonical work-item priority values (Low, Med, High).
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
 dept,uid,'Not Started','Med',true,false,false,'partnership_portal_support',r.id::text)
 returning id into wid;
 end if;
 update public.partnership_portal_support_requests
 set status='routed',work_item_id=wid,triaged_by=uid,updated_at=now() where id=r.id;
 return wid;
end $$;
