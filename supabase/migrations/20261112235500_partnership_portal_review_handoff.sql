-- Strengthen identity gates and route submitted proposals into the existing Development work queue.
-- The work item is a request for review, never an approval or automatic Board motion.
create or replace function public.can_access_partnership_portal()
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
  select public.current_workspace_identity_active() and (
    public.is_super_admin() or exists (
      select 1 from public.partnership_portal_assignments a
      join public.bod_memberships b on b.user_id=a.user_id
      where a.user_id=(select auth.uid()) and a.is_active and b.is_active
        and (b.term_starts_on is null or b.term_starts_on<=current_date)
        and (b.term_ends_on is null or b.term_ends_on>=current_date)
    )
  );
$$;
revoke all on function public.can_access_partnership_portal() from public,anon;
grant execute on function public.can_access_partnership_portal() to authenticated;

alter table public.partnership_portal_cases
 add column if not exists review_work_item_id uuid references public.work_items(id) on delete set null;

create or replace function public.partnership_portal_submit_review(
 p_case_id uuid,p_proposal text,p_resources text,p_cost_notes text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
 uid uuid:=auth.uid();
 c public.partnership_portal_cases%rowtype;
 dept uuid;
 wid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then
   raise exception 'Not authorized';
 end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then
   raise exception 'Case is not assigned to you';
 end if;
 if c.review_status not in ('not_submitted','changes_requested') then
   raise exception 'Review already submitted';
 end if;
 if length(btrim(coalesce(p_proposal,'')))<60 or length(btrim(coalesce(p_resources,'')))<10 then
   raise exception 'Proposal and resource assessment must be complete';
 end if;
 select d.id into dept from public.departments d
 where d.module='development' and d.is_active order by d.id limit 1;
 if dept is null then raise exception 'Development review routing is unavailable'; end if;
 -- One canonical work item per partnership case to avoid duplicate Board requests.
 select w.id into wid from public.work_items w
 where w.source_system='partnership_portal_review' and w.source_event_id=p_case_id::text
 and w.deleted_at is null limit 1;
 if wid is null then
   insert into public.work_items (
     module,type,title,description,department_id,created_by_user_id,status,priority,
     evidence_required,approval_required,external_visible,shared_governance_required,
     source_system,source_event_id
   ) values (
     'partnership','Partnership Proposal Review',
     left('Partnership review — '||c.organization_name,240),
     'New partnership proposal requires Development triage, Program and Finance/Compliance/General Counsel reviews as applicable, executive decision and any Board motion required by approved bylaws. No binding commitments before authorization. Case ID: '||p_case_id::text,
     dept,uid,'Not Started','High',true,true,false,true,
     'partnership_portal_review',p_case_id::text
   ) returning id into wid;
 end if;
 update public.partnership_portal_cases set proposal_narrative=btrim(p_proposal),
 requested_resources=btrim(p_resources),estimated_cost_notes=coalesce(p_cost_notes,''),
 stage='review_requested',review_status='submitted',review_work_item_id=wid,
 updated_at=now() where id=p_case_id;
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values(p_case_id,'review_submission',
 'Partnership proposal submitted to Development review queue ('||wid::text||'). No Board motion, approval or agreement execution implied.',uid);
end $$;
revoke all on function public.partnership_portal_submit_review(uuid,text,text,text) from public,anon;
grant execute on function public.partnership_portal_submit_review(uuid,text,text,text) to authenticated;

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
 from (select id,prospect_name,prospect_type,geography
 from public.development_outreach_prospects d
 where not exists (select 1 from public.partnership_portal_cases c
 where c.source_prospect_id=d.id and c.owner_user_id=uid)
 order by prospect_name limit 100) p),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_overview() from public,anon;
grant execute on function public.partnership_portal_overview() to authenticated;