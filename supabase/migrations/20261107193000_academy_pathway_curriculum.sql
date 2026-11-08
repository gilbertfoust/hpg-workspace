-- Phase 1: automatic, auditable role-based Workspace Training pathways.
-- Phase 2: normalized course descriptions and lesson requirements.
-- All assignments are for INTERNAL Workspace Training; never grant platform access
-- or enroll external NGOs in unrelated Academy divisions.
create table public.academy_pathway_rules (
  track_id text primary key,
  title text not null,
  common_to_all boolean not null default false,
  profile_roles text[] not null default '{}',
  departments text[] not null default '{}',
  job_keywords text[] not null default '{}',
  deadline_days integer check(deadline_days between 1 and 365),
  sequence integer not null default 50,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.academy_course_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id text not null references public.academy_pathway_rules(track_id),
  source text not null check(source in('automatic','manual')),
  status text not null check(status in('assigned','paused','removed')),
  required boolean not null default true,
  due_at timestamptz,
  assigned_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  primary key(user_id,track_id)
);
create index academy_course_assignments_track_due_idx
on public.academy_course_assignments(status,due_at,track_id);
create table public.academy_assignment_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id text not null,
  event_type text not null,
  prior_data jsonb,
  new_data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index academy_assignment_events_actor_idx on public.academy_assignment_events(user_id,changed_at desc);

create table public.academy_course_syllabi (
  track_id text primary key references public.academy_pathway_rules(track_id),
  overview text not null,
  learning_outcomes text[] not null,
  prerequisite_tracks text[] not null default '{}',
  assessment_id text references public.academy_assessments(assessment_id),
  provisional_minutes integer not null check(provisional_minutes between 15 and 10000),
  status text not null default 'draft' check(status in('draft','approved','retired')),
  version integer not null default 1 check(version>0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.academy_lesson_standards (
  lesson_id text primary key references public.academy_lessons(lesson_id),
  objective text not null,
  practice_evidence text not null,
  required_references text[] not null default '{}',
  prerequisite_lessons text[] not null default '{}',
  planned_minutes integer not null default 20 check(planned_minutes between 5 and 480),
  editorial_state text not null default 'pending' check(editorial_state in('pending','reviewed')),
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now()
);
create table public.academy_curriculum_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  prior_data jsonb not null,
  new_data jsonb not null,
  editor_user_id uuid not null,
  edited_at timestamptz not null default now()
);

alter table public.academy_pathway_rules enable row level security;
alter table public.academy_course_assignments enable row level security;
alter table public.academy_assignment_events enable row level security;
alter table public.academy_course_syllabi enable row level security;
alter table public.academy_lesson_standards enable row level security;
alter table public.academy_curriculum_audit enable row level security;
revoke all on public.academy_pathway_rules,public.academy_course_assignments,
  public.academy_assignment_events,public.academy_course_syllabi,
  public.academy_lesson_standards,public.academy_curriculum_audit
  from public,anon,authenticated;
grant select on public.academy_pathway_rules,public.academy_course_assignments,
  public.academy_course_syllabi,public.academy_lesson_standards to authenticated;
grant select on public.academy_assignment_events,public.academy_curriculum_audit to authenticated;

create policy "Approved internal Academy learners see pathway rules"
on public.academy_pathway_rules for select to authenticated
using((select public.can_participate_in_academy()));
create policy "Own or authorized team training assignments"
on public.academy_course_assignments for select to authenticated using(
  (select public.can_participate_in_academy()) and (
    user_id=(select auth.uid()) or (select public.is_admin_user()) or
    ((select public.is_internal_user()) and exists(
      select 1 from public.profiles p
      where p.id=user_id and
      (p.supervisor_user_id=(select auth.uid()) or p.manager_user_id=(select auth.uid()))
    ))
  )
);
create policy "Academy admins see assignment audit"
on public.academy_assignment_events for select to authenticated
using((select public.is_admin_user()));
create policy "Approved learners see course syllabi"
on public.academy_course_syllabi for select to authenticated
using((select public.can_participate_in_academy()));
create policy "Approved learners see lesson expectations"
on public.academy_lesson_standards for select to authenticated
using((select public.can_participate_in_academy()));
create policy "Academy admins read curriculum change history"
on public.academy_curriculum_audit for select to authenticated
using((select public.is_admin_user()));

insert into public.academy_pathway_rules
(track_id,title,common_to_all,profile_roles,departments,job_keywords,deadline_days,sequence)
values
('start','Workspace Essentials',true,'{}','{}','{}',null,1),
('hr','Human Resources & Volunteer Care',false,'{}','{human resources,hr}','{human resources,recruit,volunteer,onboarding}',null,20),
('program','Programs & NGO Portfolio',false,'{vp_programs,ngo_coordinator}','{program,ngo coordination}','{program,ngo coordinator,program coordinator}',null,30),
('operations','Operations & Project Execution',false,'{vp_operations}','{operations,project management}','{operations,project manager}',null,40),
('technology','Technology & Information Security',false,'{}','{technology,information technology,it support}','{technology,it support,developer,information systems}',null,50),
('administration','Administration & Executive Secretariat',false,'{executive_secretariat}','{administration,executive secretariat}','{executive assistant,secretariat,administration}',null,60),
('compliance','Governance, Compliance & Risk',false,'{}','{compliance,legal,general counsel}','{compliance,legal counsel,risk manager}',null,70),
('improvement','Efficiency & Innovation',false,'{}','{efficiency,innovation,monitoring and evaluation}','{innovation,efficiency,quality assurance}',null,80),
('grants','Development & Grant Writing',false,'{vp_development}','{development}','{grant,development,fundraising}',null,90),
('research','Research & Source Evidence',false,'{}','{research}','{research,analyst,philology}',null,100),
('communications','Communications & Editorial',false,'{vp_communications}','{communications}','{communications,editor,public relations}',null,110),
('marketing','Marketing & Social Media',false,'{vp_communications}','{marketing}','{marketing,social media,campaign}',null,120),
('budget','Budgeting & Internal Controls',false,'{vp_finance}','{finance}','{budget,treasurer,controller,finance}',null,130),
('accounting','Accounting & Reconciliation',false,'{vp_finance}','{finance,accounting}','{accountant,accounting,controller,treasurer}',null,140),
('board','Board Governance',false,'{board,executive_secretariat,admin_pm,super_admin}','{board,executive secretariat}','{board secretary,board member}',null,150);

insert into public.academy_course_syllabi
(track_id,overview,learning_outcomes,prerequisite_tracks,assessment_id,provisional_minutes)
values
('start','Foundational navigation and confidentiality in the HPG Workspace.',array['Identify authorized workspace modules','Find assigned work and evidence','Distinguish self-reported learning from approval'],'{}','start',60),
('hr','Staff recruitment, onboarding, personnel confidentiality and offboarding.',array['Recognize recruitment controls','Follow least-privilege onboarding','Preserve confidential HR records'],'{start}','hr',100),
('program','NGO intake, project assignments, evidence and program reporting.',array['Distinguish NGO and project scope','Trace diligence and approval stages','Maintain supported program outcomes'],'{start}','program',120),
('operations','Task ownership, department handoffs, milestones and timelines.',array['Understand blockers and ownership','Preserve handoff evidence','Verify delivery before closing tasks'],'{start}','operations',100),
('technology','Support incidents, account permissions, audit trails and information security.',array['Classify incident requests','Recognize least privilege','Protect credentials and audit evidence'],'{start}','technology',100),
('administration','Executive coordination, records, reporting and approval documentation.',array['Organize operational records','Prepare coordinated schedules','Distinguish proposals from approved decisions'],'{start}','administration',100),
('compliance','Compliance recordkeeping, policy status, exception review and legal escalation.',array['Distinguish policy status','Trace audit evidence','Escalate issues under authorization'],'{start}','compliance',100),
('improvement','Measurement, process controls, pilot implementation and improvement evidence.',array['Describe a valid baseline','Design safe reversibility','Assess operational follow-up'],'{start}','improvement',100),
('grants','Development pipeline, funding eligibility, applications and review.',array['Verify donor eligibility','Align proposal evidence and budgets','Respect submission authority'],'{start}','grants',120),
('research','Source provenance, interpretations, literature notes and independent review.',array['Assess source quality','Distinguish primary and secondary evidence','Document limitations and review'],'{start}','research',120),
('communications','Editorial planning, consent, media rights and issue release.',array['Check consent and rights','Understand editorial review','Distinguish internal proofs from publication'],'{start}','communications',180),
('marketing','Social campaign workflow and publication evidence.',array['Track campaign ownership','Verify consent and funding','Avoid false claims of external publication'],'{start}','marketing',120),
('budget','Pre-expenditure budgets, restricted funding and financial authorizations.',array['Review detailed budgets','Explain restrictions','Recognize approval boundaries'],'{start}','budget',90),
('accounting','Receipts, account statements, reconciliation and reporting.',array['Reconcile supported transactions','Identify discrepancies','Maintain audit-ready records'],'{start}','accounting',120),
('board','Meeting agendas, quorum, recusal, voting and minutes.',array['Distinguish draft and active motions','Apply quorum and conflict procedures','Understand minutes approval and action handoff'],'{start}','board',90);
-- Lesson objectives in the application source are canonical. These database
-- placeholders are deliberately marked pending editorial approval.
insert into public.academy_lesson_standards(lesson_id,objective,practice_evidence)
select lesson_id,
  'Safely demonstrate the authorized workflow: '||title,
  'Describe the actual procedure, identify the responsible reviewer, and document why no unauthorized live record was changed.'
from public.academy_lessons;

create or replace function private.sync_academy_user_paths(p_user uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare person record;rule record;added integer:=0;elig boolean;matched_ids text[]:='{}';
begin
  select p.*,coalesce(o.department_name,'') department_name into person
  from public.profiles p left join public.org_units o on o.id=p.department_id
  where p.id=p_user;
  if not found then return 0; end if;
  elig:= person.is_approved and lower(trim(coalesce(person.approval_status,'')))='approved'
    and person.access_status='active'
    and person.role in(
      'super_admin','admin_pm','vp_operations','vp_programs','vp_development',
      'vp_finance','vp_communications','department_lead','ngo_coordinator',
      'executive_secretariat','staff','staff_member','viewer','board'
    );
  if not elig then
    update public.academy_course_assignments
    set status='paused',changed_at=now()
    where user_id=p_user and status='assigned';
    return 0;
  end if;
  for rule in select * from public.academy_pathway_rules
    where active order by sequence,track_id loop
    if rule.common_to_all or person.role=any(rule.profile_roles)
      or exists(select 1 from unnest(rule.departments) d
        where lower(person.department_name) like '%'||lower(d)||'%')
      or exists(select 1 from unnest(rule.job_keywords) k
        where lower(coalesce(person.job_title,'')) like '%'||lower(k)||'%')
    then
      matched_ids:=array_append(matched_ids,rule.track_id);
      insert into public.academy_course_assignments
        (user_id,track_id,source,status,required,due_at)
      values(p_user,rule.track_id,'automatic','assigned',true,
        case when rule.deadline_days is null then null
          else now()+make_interval(days=>rule.deadline_days) end)
      on conflict(user_id,track_id) do update
      set status='assigned',required=true,changed_at=now()
      where public.academy_course_assignments.source='automatic'
        and public.academy_course_assignments.status<>'assigned';
      added:=added+1;
    end if;
  end loop;
  update public.academy_course_assignments a set status='removed',changed_at=now()
  where a.user_id=p_user and a.source='automatic' and a.status='assigned'
    and not (a.track_id=any(matched_ids));
  return added;
end;
$$;
revoke all on function private.sync_academy_user_paths(uuid)
from public,anon,authenticated;

create or replace function private.academy_profile_changed()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform private.sync_academy_user_paths(new.id);
  return new;
end;
$$;
revoke all on function private.academy_profile_changed() from public,anon,authenticated;
create trigger academy_sync_profile_assignments
after insert or update of role,department_id,job_title,is_approved,
  approval_status,access_status on public.profiles
for each row execute function private.academy_profile_changed();

create or replace function private.audit_academy_assignment_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' or to_jsonb(old) is distinct from to_jsonb(new) then
    insert into public.academy_assignment_events
      (user_id,track_id,event_type,prior_data,new_data,changed_by)
    values(new.user_id,new.track_id,lower(tg_op),
      case when tg_op='INSERT' then null else to_jsonb(old) end,
      to_jsonb(new),(select auth.uid()));
  end if;
  return new;
end;
$$;
revoke all on function private.audit_academy_assignment_change() from public,anon,authenticated;
create trigger academy_assignments_audit
after insert or update on public.academy_course_assignments
for each row execute function private.audit_academy_assignment_change();

create or replace function public.refresh_my_academy_pathway()
returns integer language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.can_participate_in_academy()) then
    raise exception 'Approved Academy participant required' using errcode='42501';
  end if;
  return private.sync_academy_user_paths((select auth.uid()));
end;
$$;

create or replace function public.set_academy_course_assignment(
  p_user uuid,p_track text,p_state text,p_required boolean default true,
  p_due_at timestamptz default null
) returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy administrator required' using errcode='42501';
  end if;
  if p_state not in('assigned','paused','removed') or not exists(
    select 1 from public.academy_pathway_rules where track_id=p_track and active
  ) then raise exception 'Unknown pathway or invalid assignment state' using errcode='22023'; end if;
  if not exists(
    select 1 from public.profiles p where p.id=p_user and p.is_approved
      and lower(trim(p.approval_status))='approved' and p.access_status='active'
      and p.role in(
        'super_admin','admin_pm','vp_operations','vp_programs','vp_development',
        'vp_finance','vp_communications','department_lead','ngo_coordinator',
        'executive_secretariat','staff','staff_member','viewer','board'
      )
  ) then raise exception 'Only active approved internal Academy members may be assigned' using errcode='42501';end if;
  insert into public.academy_course_assignments
    (user_id,track_id,source,status,required,due_at,assigned_by)
  values (p_user,p_track,'manual',p_state,p_required,p_due_at,(select auth.uid()))
  on conflict(user_id,track_id) do update set
    source='manual',status=excluded.status,required=excluded.required,
    due_at=excluded.due_at,assigned_by=excluded.assigned_by,changed_at=now();
  return true;
end;
$$;

create or replace function public.get_my_academy_learning_plan()
returns table (
  track_id text,title text,status text,required boolean,source text,
  due_at timestamptz,lesson_count integer,completed_count integer,
  passed_exam boolean,supervisor_endorsed boolean,sequence integer
) language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.can_participate_in_academy()) then
    raise exception 'Approved Academy participant required' using errcode='42501';
  end if;
  return query
  select a.track_id,r.title,a.status,a.required,a.source,a.due_at,
    (select count(*)::integer from public.academy_lessons l
       where l.track_id=a.track_id),
    (select count(*)::integer from public.academy_lesson_progress p
       join public.academy_lessons l on l.lesson_id=p.lesson_id
       where p.user_id=a.user_id and l.track_id=a.track_id),
    exists(select 1 from public.academy_assessment_attempts attempt
      join public.academy_assessments exam on exam.assessment_id=attempt.assessment_id
      where attempt.user_id=a.user_id and exam.track_id=a.track_id and attempt.passed),
    exists(select 1 from public.academy_competency_signoffs signoff
      join public.academy_assessments exam on exam.assessment_id=signoff.assessment_id
      where signoff.user_id=a.user_id and exam.track_id=a.track_id
        and signoff.decision='endorsed'),
    r.sequence
  from public.academy_course_assignments a
  join public.academy_pathway_rules r on r.track_id=a.track_id
  where a.user_id=(select auth.uid()) and a.status='assigned'
  order by r.sequence,r.track_id;
end;
$$;

create or replace function public.get_team_academy_course_assignments()
returns table (
  user_id uuid,full_name text,staff_role text,track_id text,
  track_title text,status text,required boolean,source text,
  due_at timestamptz,assigned_at timestamptz
) language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_internal_user()) then
    raise exception 'Authorized internal supervisor required' using errcode='42501';
  end if;
  return query select p.id,coalesce(nullif(btrim(p.full_name),''),'Unnamed colleague'),
    p.role,a.track_id,r.title,a.status,a.required,a.source,a.due_at,a.assigned_at
  from public.academy_course_assignments a
  join public.profiles p on p.id=a.user_id
  join public.academy_pathway_rules r on r.track_id=a.track_id
  where p.is_approved and lower(trim(p.approval_status))='approved'
    and p.access_status='active' and a.status='assigned'
    and (
      (select public.is_admin_user()) or
      p.supervisor_user_id=(select auth.uid()) or
      p.manager_user_id=(select auth.uid())
    )
  order by lower(coalesce(p.full_name,'')),r.sequence;
end;
$$;

create or replace function public.update_academy_lesson_standard(
  p_lesson text,p_objective text,p_practice text,
  p_minutes integer,p_prerequisites text[] default '{}',
  p_references text[] default '{}',p_mark_reviewed boolean default false
) returns boolean language plpgsql security definer set search_path=''
as $$
declare prior public.academy_lesson_standards;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy curriculum administrator required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_objective,'')))<20 or
     length(btrim(coalesce(p_practice,'')))<20 or
     p_minutes not between 5 and 480 then
    raise exception 'Complete objective, practice evidence and duration are required' using errcode='23514';
  end if;
  if exists(select 1 from unnest(coalesce(p_prerequisites,'{}'::text[])) prereq
    where prereq=p_lesson or not exists (
      select 1 from public.academy_lessons where lesson_id=prereq
    )) then
    raise exception 'Prerequisite lessons must exist and cannot self-reference' using errcode='23514';
  end if;
  select * into prior from public.academy_lesson_standards where lesson_id=p_lesson for update;
  if not found then raise exception 'Unknown authored lesson' using errcode='P0002';end if;
  update public.academy_lesson_standards set
    objective=btrim(p_objective),practice_evidence=btrim(p_practice),
    planned_minutes=p_minutes,prerequisite_lessons=coalesce(p_prerequisites,'{}'),
    required_references=coalesce(p_references,'{}'),
    editorial_state=case when p_mark_reviewed then 'reviewed' else 'pending' end,
    version=version+1,updated_at=now()
  where lesson_id=p_lesson;
  insert into public.academy_curriculum_audit
    (entity_type,entity_id,prior_data,new_data,editor_user_id)
  select 'lesson',p_lesson,to_jsonb(prior),to_jsonb(s),(select auth.uid())
  from public.academy_lesson_standards s where s.lesson_id=p_lesson;
  return true;
end;
$$;

revoke all on function public.refresh_my_academy_pathway() from public,anon,authenticated;
revoke all on function public.set_academy_course_assignment(uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.get_my_academy_learning_plan() from public,anon,authenticated;
revoke all on function public.get_team_academy_course_assignments() from public,anon,authenticated;
revoke all on function public.update_academy_lesson_standard(text,text,text,integer,text[],text[],boolean)
  from public,anon,authenticated;
grant execute on function public.refresh_my_academy_pathway() to authenticated;
grant execute on function public.set_academy_course_assignment(uuid,text,text,boolean,timestamptz) to authenticated;
grant execute on function public.get_my_academy_learning_plan() to authenticated;
grant execute on function public.get_team_academy_course_assignments() to authenticated;
grant execute on function public.update_academy_lesson_standard(text,text,text,integer,text[],text[],boolean) to authenticated;

-- Existing active approved staff and directors receive paths immediately.
-- External NGO accounts are explicitly ineligible and not added.
select private.sync_academy_user_paths(p.id)
from public.profiles p where p.is_approved and p.access_status='active';

comment on table public.academy_course_assignments is
  'Internal Workspace Training paths assigned from approved HPG roles and actual departments; not access grants or external Academy enrollment.';
comment on table public.academy_course_syllabi is
  'Draft internal course syllabi; not a published nonprofit certificate or HR promotion.';
