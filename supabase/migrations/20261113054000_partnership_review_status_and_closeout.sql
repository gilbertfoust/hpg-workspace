-- Keep Board-facing review status synchronized with Development routing.
-- Closing a prospect also clears obsolete follow-up actions.
create or replace function public.partnership_portal_overview()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); output jsonb;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
 'cases',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc)
 from (select id,organization_name,organization_type,geography,contact_name,contact_email,summary,
 program_alignment,stage,review_status,next_action,next_action_due_at,proposal_narrative,
 requested_resources,estimated_cost_notes,source_prospect_id,review_work_item_id,partner_id,pipeline_id,created_at,updated_at
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
 'review_requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
 from (select r.id,r.case_id,r.status,r.created_at,r.work_item_id
 from public.partnership_portal_review_requests r
 join public.partnership_portal_cases c on c.id=r.case_id
 where c.owner_user_id=uid or public.is_super_admin()
 order by r.created_at desc limit 100) x),'[]'::jsonb),
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
   next_action=case when p_new_stage='closed' then null else coalesce(nullif(btrim(p_next_action),''),next_action) end,
   next_action_due_at=case when p_new_stage='closed' then null else coalesce(p_due_at,next_action_due_at) end,
   stage=coalesce(p_new_stage,stage),updated_at=now() where id=p_case_id;
 return eid;
end $$;

revoke all on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) to authenticated;
