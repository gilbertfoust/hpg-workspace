-- Link accepted Board proposals into the EXISTING Partnerships operational pipeline.
-- No duplicate pipeline or second user-maintained CRM is created.
alter table public.partnership_portal_cases
 add column if not exists partner_id uuid,
 add column if not exists pipeline_id uuid;
do $$
begin
 if to_regclass('public.partners') is not null and not exists
 (select 1 from pg_constraint where conrelid='public.partnership_portal_cases'::regclass and conname='board_portal_partner_fk') then
   alter table public.partnership_portal_cases add constraint board_portal_partner_fk
     foreign key(partner_id) references public.partners(id) on delete set null;
 end if;
 if to_regclass('public.partnership_pipeline') is not null and not exists
 (select 1 from pg_constraint where conrelid='public.partnership_portal_cases'::regclass and conname='board_portal_pipeline_fk') then
   alter table public.partnership_portal_cases add constraint board_portal_pipeline_fk
     foreign key(pipeline_id) references public.partnership_pipeline(id) on delete set null;
 end if;
end $$;

create or replace function public.partnership_portal_triage_review(p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); r public.partnership_portal_review_requests%rowtype;
 c public.partnership_portal_cases%rowtype; dept uuid; wid uuid; partner uuid; pipe uuid;
begin
 if uid is null or not public.current_workspace_identity_active() or
    not public.can_access_workspace_area('development') or not public.is_internal_user()
 then raise exception 'Development authorization required'; end if;
 select * into r from public.partnership_portal_review_requests where id=p_request_id for update;
 if not found then raise exception 'Review request not found'; end if;
 if r.status<>'submitted' then raise exception 'Review is already routed or closed'; end if;
 select * into c from public.partnership_portal_cases where id=r.case_id;
 if not found then raise exception 'Related case unavailable'; end if;
 select d.id into dept from public.org_units d where lower(btrim(d.department_name))='development' order by d.id limit 1;
 if dept is null then raise exception 'Development department not configured'; end if;
 select id into wid from public.work_items
 where source_system='partnership_portal_review' and source_event_id=r.case_id::text
 and deleted_at is null limit 1;
 if wid is null then
   insert into public.work_items(module,type,title,description,department_id,created_by_user_id,
     status,priority,evidence_required,approval_required,external_visible,source_system,source_event_id)
   values('partnership','Partnership Proposal Review',left('Partnership review — '||c.organization_name,240),
     'Partnership proposal from the Board-linked portfolio. Development must coordinate Finance, Compliance, Program and General Counsel input as applicable, then executive and Board approvals where required. No legal or financial commitment authorized. Case: '||c.id::text,
     dept,uid,'Not Started','High',true,true,false,'partnership_portal_review',r.case_id::text)
   returning id into wid;
 end if;
 -- The existing Partnership Pipeline is the Development team's canonical operational view.
 -- The Board portal keeps case-specific outreach and proposals without creating a second independent pipeline.
 select p.id into partner from public.partners p
 where lower(btrim(p.name))=lower(btrim(c.organization_name)) order by p.id limit 1;
 if partner is null then
   insert into public.partners(name,type,region,status,primary_contact,notes)
   values(c.organization_name,c.organization_type,c.geography,'Prospect',c.contact_name,
   'Linked to a Board-led partnership proposal routed through Development review.')
   returning id into partner;
 end if;
 select id into pipe from public.partnership_pipeline
 where partner_id=partner and ngo_id is null order by created_at limit 1;
 if pipe is null then
   insert into public.partnership_pipeline(partner_id,stage,notes)
   values(partner,'Prospect','Origin: Board Partnership Development case '||c.id::text)
   returning id into pipe;
 end if;
 update public.partnership_portal_review_requests set status='routed',work_item_id=wid,
 triaged_by=uid,triaged_at=now(),updated_at=now() where id=r.id;
 update public.partnership_portal_cases set review_work_item_id=wid,partner_id=partner,pipeline_id=pipe,updated_at=now() where id=r.case_id;
 return wid;
end $$;
revoke all on function public.partnership_portal_triage_review(uuid) from public,anon;
grant execute on function public.partnership_portal_triage_review(uuid) to authenticated;

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
 'support_requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
 from (select s.id,s.case_id,s.request_type,s.details,s.status,s.work_item_id,s.created_at
 from public.partnership_portal_support_requests s
 join public.partnership_portal_cases c on c.id=s.case_id
 where c.owner_user_id=uid or public.is_super_admin() order by s.created_at desc limit 150) x),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_overview() from public,anon;

