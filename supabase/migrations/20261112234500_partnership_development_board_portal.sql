-- Partnership Development Board portfolio - gated operating area.
-- No director is auto-granted access. CEO/Board authorization must be recorded before assignment is activated.
create table if not exists public.partnership_portal_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  operational_title text not null default 'Partnership Development',
  is_active boolean not null default false,
  board_authorization_reference text,
  authorized_by uuid references auth.users(id),
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_assignment_active_authorization check (
    not is_active or (board_authorization_reference is not null and authorized_by is not null and authorized_at is not null)
  )
);
alter table public.partnership_portal_assignments enable row level security;
revoke all on public.partnership_portal_assignments from anon,authenticated;
grant select on public.partnership_portal_assignments to authenticated;
drop policy if exists partnership_assignment_self_read on public.partnership_portal_assignments;
create policy partnership_assignment_self_read on public.partnership_portal_assignments
for select to authenticated using (user_id=(select auth.uid()) or (select public.is_super_admin()));

create or replace function public.can_access_partnership_portal()
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
  select (select public.is_super_admin()) or exists (
    select 1 from public.partnership_portal_assignments a
    join public.bod_memberships b on b.user_id=a.user_id
    where a.user_id=(select auth.uid()) and a.is_active and b.is_active
      and (b.term_starts_on is null or b.term_starts_on<=current_date)
      and (b.term_ends_on is null or b.term_ends_on>=current_date)
  );
$$;
revoke all on function public.can_access_partnership_portal() from public,anon;
grant execute on function public.can_access_partnership_portal() to authenticated;

create table if not exists public.partnership_portal_cases (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check(length(btrim(organization_name)) between 2 and 240),
  organization_type text not null default 'community_partner',
  geography text,
  contact_name text,
  contact_email text,
  summary text not null default '',
  program_alignment text,
  source_prospect_id uuid,
  crm_organization_id uuid references public.crm_organizations(id) on delete set null,
  stage text not null default 'identified' check (stage in ('identified','outreach','discovery','proposal','review_requested','approved','active','closed')),
  next_action text,
  next_action_due_at timestamptz,
  proposal_narrative text,
  requested_resources text,
  estimated_cost_notes text,
  review_status text not null default 'not_submitted' check(review_status in ('not_submitted','submitted','changes_requested','approved','rejected')),
  board_motion_id uuid,
  owner_user_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partnership_no_self_approval check ((stage not in ('approved','active')) or (review_status='approved' and board_motion_id is not null))
);
-- Existing production tables are not all present in the repository's local replay
-- baseline. Keep optional keys soft for replay; wire real FKs wherever their
-- canonical tables exist, rather than recreating shadow Development/Board tables.
do $key$
begin
 if to_regclass('public.development_outreach_prospects') is not null and not exists (select 1 from pg_constraint where conrelid='public.partnership_portal_cases'::regclass and conname in ('partnership_portal_source_prospect_fk','partnership_portal_cases_source_prospect_id_fkey')) then
   alter table public.partnership_portal_cases add constraint partnership_portal_source_prospect_fk
   foreign key (source_prospect_id) references public.development_outreach_prospects(id) on delete set null;
 end if;
 if to_regclass('public.bod_meeting_agenda') is not null and not exists (select 1 from pg_constraint where conrelid='public.partnership_portal_cases'::regclass and conname in ('partnership_portal_board_motion_fk','partnership_portal_cases_board_motion_id_fkey')) then
   alter table public.partnership_portal_cases add constraint partnership_portal_board_motion_fk
   foreign key (board_motion_id) references public.bod_meeting_agenda(id) on delete set null;
 end if;
end $key$;

create index if not exists partnership_portal_owner_stage_idx on public.partnership_portal_cases(owner_user_id,stage,updated_at desc);
create index if not exists partnership_portal_prospect_idx on public.partnership_portal_cases(source_prospect_id);
alter table public.partnership_portal_cases enable row level security;
revoke all on public.partnership_portal_cases from anon,authenticated;
grant select on public.partnership_portal_cases to authenticated;
drop policy if exists partnership_portal_case_owner_read on public.partnership_portal_cases;
create policy partnership_portal_case_owner_read on public.partnership_portal_cases for select to authenticated
using ((select public.is_super_admin()) or ((select public.can_access_partnership_portal()) and owner_user_id=(select auth.uid())));

create table if not exists public.partnership_portal_activities (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.partnership_portal_cases(id) on delete cascade,
 activity_type text not null check(activity_type in ('outreach','meeting','follow_up','proposal','outcome','note','review_submission')),
 details text not null check (length(btrim(details)) between 3 and 10000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists partnership_portal_activities_case_date on public.partnership_portal_activities(case_id,created_at desc);
alter table public.partnership_portal_activities enable row level security;
revoke all on public.partnership_portal_activities from anon,authenticated;
grant select on public.partnership_portal_activities to authenticated;
drop policy if exists partnership_portal_activity_owner_read on public.partnership_portal_activities;
create policy partnership_portal_activity_owner_read on public.partnership_portal_activities
for select to authenticated using (exists (
 select 1 from public.partnership_portal_cases c where c.id=case_id
 and ((select public.is_super_admin()) or
    ((select public.can_access_partnership_portal()) and c.owner_user_id=(select auth.uid())))
));

-- All writes pass through authenticated operations that protect review/approval fields.
create or replace function public.partnership_portal_create_case(
 p_name text,p_type text default 'community_partner',p_geography text default null,
 p_contact_name text default null,p_contact_email text default null,
 p_program text default null,p_summary text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); cid uuid; pid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 240 then raise exception 'Organization name required'; end if;
 -- Reuse canonical Development prospect records instead of making a second outreach list.
 select id into pid from public.development_outreach_prospects
 where lower(prospect_name)=lower(btrim(p_name)) limit 1;
 if pid is null then
   insert into public.development_outreach_prospects(
    prospect_name,prospect_type,geography,contact_name,contact_email,owner_user_id,
    source_reference,notes)
   values (btrim(p_name),'community_partner',nullif(btrim(p_geography),''),nullif(btrim(p_contact_name),''),
    nullif(btrim(p_contact_email),''),uid,'partnership_portal',
    'Portfolio-specific prospect; operational authority remains governed.')
   on conflict (prospect_name) do nothing returning id into pid;
   if pid is null then select id into pid from public.development_outreach_prospects
     where prospect_name=btrim(p_name) limit 1; end if;
 end if;
 insert into public.partnership_portal_cases
 (organization_name,organization_type,geography,contact_name,contact_email,program_alignment,summary,
 source_prospect_id,owner_user_id,created_by)
 values (btrim(p_name),coalesce(nullif(btrim(p_type),''),'community_partner'),
 nullif(btrim(p_geography),''),nullif(btrim(p_contact_name),''),
 nullif(btrim(p_contact_email),''),nullif(btrim(p_program),''),coalesce(p_summary,''),
 pid,uid,uid) returning id into cid;
 return cid;
end $$;

create or replace function public.partnership_portal_import_prospect(p_prospect_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); rec record; cid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into rec from public.development_outreach_prospects where id=p_prospect_id;
 if not found then raise exception 'Prospect does not exist'; end if;
 select id into cid from public.partnership_portal_cases where source_prospect_id=p_prospect_id and owner_user_id=uid limit 1;
 if cid is not null then return cid; end if;
 insert into public.partnership_portal_cases
 (organization_name,organization_type,geography,contact_name,contact_email,summary,source_prospect_id,owner_user_id,created_by)
 values (rec.prospect_name,rec.prospect_type,rec.geography,rec.contact_name,rec.contact_email,
 coalesce(rec.notes,''),rec.id,uid,uid) returning id into cid;
 return cid;
end $$;

create or replace function public.partnership_portal_record_activity(
 p_case_id uuid,p_kind text,p_details text,p_next_action text default null,
 p_due_at timestamptz default null,p_new_stage text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); c public.partnership_portal_cases%rowtype; eid uuid;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then raise exception 'Case is not assigned to you'; end if;
 if c.review_status not in ('not_submitted','changes_requested') then raise exception 'Record is under governance review'; end if;
 if p_kind not in ('outreach','meeting','follow_up','proposal','outcome','note') then raise exception 'Unknown activity type'; end if;
 if length(btrim(coalesce(p_details,''))) not between 3 and 10000 then raise exception 'Activity details required'; end if;
 if p_new_stage is not null and p_new_stage not in ('identified','outreach','discovery','proposal','closed')
 then raise exception 'Approval stages require separate governance action'; end if;
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values(p_case_id,p_kind,btrim(p_details),uid) returning id into eid;
 update public.partnership_portal_cases set
 next_action=coalesce(nullif(btrim(p_next_action),''),next_action),
 next_action_due_at=coalesce(p_due_at,next_action_due_at),
 stage=coalesce(p_new_stage,stage),
 updated_at=now() where id=p_case_id;
 return eid;
end $$;

create or replace function public.partnership_portal_submit_review(
 p_case_id uuid,p_proposal text,p_resources text,p_cost_notes text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); c public.partnership_portal_cases%rowtype;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select * into c from public.partnership_portal_cases where id=p_case_id for update;
 if not found or (c.owner_user_id<>uid and not public.is_super_admin()) then raise exception 'Case is not assigned to you'; end if;
 if c.review_status not in ('not_submitted','changes_requested') then raise exception 'Review already submitted'; end if;
 if length(btrim(coalesce(p_proposal,'')))<60 or length(btrim(coalesce(p_resources,'')))<10
 then raise exception 'Proposal and resource assessment must be complete'; end if;
 update public.partnership_portal_cases set proposal_narrative=btrim(p_proposal),
 requested_resources=btrim(p_resources),estimated_cost_notes=coalesce(p_cost_notes,''),
 stage='review_requested',review_status='submitted',updated_at=now()
 where id=p_case_id;
 insert into public.partnership_portal_activities(case_id,activity_type,details,created_by)
 values (p_case_id,'review_submission',
 'Partnership proposal submitted for departmental and executive consideration. No agreement or Board approval implied.',uid);
end $$;

create or replace function public.partnership_portal_overview()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); output jsonb;
begin
 if uid is null or not public.can_access_partnership_portal() then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
 'cases',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc)
 from (select id,organization_name,organization_type,geography,contact_name,contact_email,
 summary,program_alignment,stage,review_status,next_action,next_action_due_at,
 proposal_narrative,requested_resources,estimated_cost_notes,source_prospect_id,created_at,updated_at
 from public.partnership_portal_cases where owner_user_id=uid or public.is_super_admin()
 order by updated_at desc limit 100) c),'[]'::jsonb),
 'activities',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
 from (select x.id,x.case_id,x.activity_type,x.details,x.created_at
 from public.partnership_portal_activities x
 join public.partnership_portal_cases c on c.id=x.case_id
 where c.owner_user_id=uid or public.is_super_admin()
 order by x.created_at desc limit 150) a),'[]'::jsonb),
 'available_prospects',coalesce((select jsonb_agg(to_jsonb(p) order by p.prospect_name)
 from (select id,prospect_name,prospect_type,geography
 from public.development_outreach_prospects d
 where not exists (select 1 from public.partnership_portal_cases c where c.source_prospect_id=d.id and c.owner_user_id=uid)
 order by prospect_name limit 100) p),'[]'::jsonb)
 ) into output;
 return output;
end $$;
revoke all on function public.partnership_portal_create_case(text,text,text,text,text,text,text) from public,anon;
revoke all on function public.partnership_portal_import_prospect(uuid) from public,anon;
revoke all on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) from public,anon;
revoke all on function public.partnership_portal_submit_review(uuid,text,text,text) from public,anon;
revoke all on function public.partnership_portal_overview() from public,anon;
grant execute on function public.partnership_portal_create_case(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.partnership_portal_import_prospect(uuid) to authenticated;
grant execute on function public.partnership_portal_record_activity(uuid,text,text,text,timestamptz,text) to authenticated;
grant execute on function public.partnership_portal_submit_review(uuid,text,text,text) to authenticated;
grant execute on function public.partnership_portal_overview() to authenticated;
comment on table public.partnership_portal_cases is 'Partnership Development operational case record linked to Development prospects; case review is not Board approval or contract execution.';
