-- Phase 3: randomized knowledge check order and evidence-based remediation.
-- Phase 4: automatically queued, internal-only course notices and reporting.
create table public.academy_assessment_policies(
  assessment_id text primary key references public.academy_assessments(assessment_id),
  cooldown_after_failures integer not null default 3 check(cooldown_after_failures between 1 and 10),
  cooldown_minutes integer not null default 20 check(cooldown_minutes between 1 and 1440),
  daily_attempt_limit integer not null default 10 check(daily_attempt_limit between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.academy_assessment_policies(assessment_id)
select assessment_id from public.academy_assessments;
alter table public.academy_assessment_policies enable row level security;
revoke all on public.academy_assessment_policies from public,anon,authenticated;
grant select on public.academy_assessment_policies to authenticated;
create policy "Internal Academy learners see assessment retry rules"
on public.academy_assessment_policies for select to authenticated
using((select public.can_participate_in_academy()));

create table public.academy_remediation_plans(
  attempt_id uuid primary key references public.academy_assessment_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null references public.academy_assessments(assessment_id),
  recommended_track text not null,
  status text not null default 'review_required' check(status in('review_required','completed_by_later_pass')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index academy_remediation_user_idx
  on public.academy_remediation_plans(user_id,assessment_id,created_at desc);
alter table public.academy_remediation_plans enable row level security;
revoke all on public.academy_remediation_plans from public,anon,authenticated;
grant select on public.academy_remediation_plans to authenticated;
create policy "Learners see only their own remediation"
on public.academy_remediation_plans for select to authenticated
using(user_id=(select auth.uid()) and (select public.can_participate_in_academy()));

create or replace function private.academy_attempt_remediation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare track text;
begin
  select a.track_id into track from public.academy_assessments a
  where a.assessment_id=new.assessment_id;
  if not new.passed then
    insert into public.academy_remediation_plans
      (attempt_id,user_id,assessment_id,recommended_track)
    values(new.id,new.user_id,new.assessment_id,track);
  else
    update public.academy_remediation_plans set
      status='completed_by_later_pass',resolved_at=new.submitted_at
    where user_id=new.user_id and assessment_id=new.assessment_id
      and status='review_required';
  end if;
  return new;
end;
$$;
revoke all on function private.academy_attempt_remediation()
from public,anon,authenticated;
create trigger academy_remediation_on_attempt
after insert on public.academy_assessment_attempts
for each row execute function private.academy_attempt_remediation();

create table public.academy_course_notifications(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id text not null references public.academy_pathway_rules(track_id),
  kind text not null check(kind in('due_soon','overdue')),
  due_date date not null,
  message text not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique(user_id,track_id,kind,due_date)
);
create index academy_course_notifications_user_idx
on public.academy_course_notifications(user_id,seen_at,created_at desc);
alter table public.academy_course_notifications enable row level security;
revoke all on public.academy_course_notifications from public,anon,authenticated;
grant select on public.academy_course_notifications to authenticated;
create policy "Learners can see only their own training reminders"
on public.academy_course_notifications for select to authenticated
using(user_id=(select auth.uid()) and (select public.can_participate_in_academy()));

create or replace function private.queue_academy_course_notifications()
returns integer language plpgsql security definer set search_path=''
as $$
declare notices integer;
begin
  insert into public.academy_course_notifications
    (user_id,track_id,kind,due_date,message)
  select a.user_id,a.track_id,
    case when a.due_at<now() then 'overdue' else 'due_soon' end,
    a.due_at::date,
    case when a.due_at<now() then
      'Your assigned HPG Workspace Training course is past its proposed due date: '||r.title
    else
      'Your assigned HPG Workspace Training course approaches its proposed due date: '||r.title end
  from public.academy_course_assignments a
  join public.academy_pathway_rules r on r.track_id=a.track_id
  join public.profiles p on p.id=a.user_id
  where a.status='assigned' and a.required and a.due_at is not null
    and a.due_at<=now()+interval '7 days'
    and p.is_approved and lower(trim(p.approval_status))='approved'
    and p.access_status='active'
    and p.role not in('external_ngo','external_portal','ngo_user')
    and (
      (select count(*) from public.academy_lessons l where l.track_id=a.track_id)>
      (select count(*) from public.academy_lesson_progress pr
        join public.academy_lessons l on l.lesson_id=pr.lesson_id
        where pr.user_id=a.user_id and l.track_id=a.track_id)
      or not exists(select 1 from public.academy_assessment_attempts at
        join public.academy_assessments ass on ass.assessment_id=at.assessment_id
        where at.user_id=a.user_id and ass.track_id=a.track_id and at.passed)
    )
  on conflict(user_id,track_id,kind,due_date) do nothing;
  get diagnostics notices=row_count;
  return notices;
end;
$$;
revoke all on function private.queue_academy_course_notifications()
from public,anon,authenticated;

create or replace function public.get_my_academy_course_notifications()
returns table(id bigint,track_id text,kind text,due_date date,message text,created_at timestamptz,seen_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.can_participate_in_academy()) then
    raise exception 'Approved Academy participant required' using errcode='42501';
  end if;
  return query
  select n.id,n.track_id,n.kind,n.due_date,n.message,n.created_at,n.seen_at
  from public.academy_course_notifications n where n.user_id=(select auth.uid())
  order by n.created_at desc limit 100;
end;
$$;
create or replace function public.acknowledge_academy_course_notification(p_id bigint)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.can_participate_in_academy()) then
    raise exception 'Approved Academy participant required' using errcode='42501';
  end if;
  update public.academy_course_notifications
  set seen_at=coalesce(seen_at,now()) where id=p_id and user_id=(select auth.uid());
  return found;
end;
$$;

create or replace function public.get_my_academy_assessment_recovery(p_assessment text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare total_today integer;latest record;rule record;ready_after timestamptz;
begin
  if not private.academy_assessment_eligible(p_assessment) then
    raise exception 'Assessment unavailable for this learner' using errcode='42501';
  end if;
  select * into rule from public.academy_assessment_policies
    where assessment_id=p_assessment;
  select count(*) into total_today from public.academy_assessment_attempts a
    where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
      and a.submitted_at>now()-interval '24 hours';
  select submitted_at,passed into latest from public.academy_assessment_attempts a
    where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
    order by submitted_at desc limit 1;
  if total_today>=rule.cooldown_after_failures and latest.passed=false
    and latest.submitted_at>now()-make_interval(mins=>rule.cooldown_minutes) then
    ready_after:=latest.submitted_at+make_interval(mins=>rule.cooldown_minutes);
  end if;
  return jsonb_build_object(
    'assessment_id',p_assessment,'attempts_last_24h',total_today,
    'daily_attempt_limit',rule.daily_attempt_limit,
    'retry_after',ready_after,
    'review_required',exists(select 1 from public.academy_remediation_plans r
      where r.user_id=(select auth.uid()) and r.assessment_id=p_assessment
      and r.status='review_required'),
    'suggested_lessons',coalesce((
      select jsonb_agg(jsonb_build_object('id',l.lesson_id,'title',l.title)
        order by l.title)
      from public.academy_lessons l
      join public.academy_assessments ass on ass.track_id=l.track_id
      where ass.assessment_id=p_assessment
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_academy_course_notifications() from public,anon,authenticated;
revoke all on function public.acknowledge_academy_course_notification(bigint) from public,anon,authenticated;
revoke all on function public.get_my_academy_assessment_recovery(text) from public,anon,authenticated;
grant execute on function public.get_my_academy_course_notifications() to authenticated;
grant execute on function public.acknowledge_academy_course_notification(bigint) to authenticated;
grant execute on function public.get_my_academy_assessment_recovery(text) to authenticated;

-- Server-generated daily notifications, using the existing pg_cron installation.
-- No external emails or SMS are sent, and accounts without approved due dates
-- receive no reminder. Repeated jobs are idempotent by (user,course,type,due).
do $schedule$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') and
    not exists(select 1 from cron.job where jobname='hpg-academy-due-notices') then
    perform cron.schedule('hpg-academy-due-notices','5 14 * * *',
      'select private.queue_academy_course_notifications();');
  end if;
end;
$schedule$;

comment on table public.academy_course_notifications is
'Internal Academy due notices, not external mail delivery. Dates require explicit administrator assignment.';
comment on table public.academy_remediation_plans is
'Formative remedial course review after a failed knowledge check; not a disciplinary finding.';

-- Assessment eligibility must reflect assigned internal course tracks.
CREATE OR REPLACE FUNCTION private.academy_assessment_eligible(p_assessment text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select public.can_participate_in_academy())
  and exists(select 1 from public.academy_assessments a where a.assessment_id=p_assessment and a.is_active)
  and exists(
    select 1 from public.academy_course_assignments assignment
    join public.academy_assessments exam on exam.track_id=assignment.track_id
    where exam.assessment_id=p_assessment
      and assignment.user_id=(select auth.uid())
      and assignment.status='assigned'
  )
  and (
    p_assessment<>'board' or (select public.can_read_bod_meetings())
  );
$function$

-- Change only question display order, never the private answer keys.
CREATE OR REPLACE FUNCTION public.get_academy_assessment(p_assessment text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare paper public.academy_assessments;
begin
  if not private.academy_assessment_eligible(p_assessment) then
    raise exception 'Assessment unavailable for this learner' using errcode='42501';
  end if;
  select * into paper from public.academy_assessments where assessment_id=p_assessment;
  return jsonb_build_object(
    'id',paper.assessment_id,'title',paper.title,'track_id',paper.track_id,
    'passing_percent',paper.passing_percent,
    'questions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',q.question_id,'prompt',q.prompt,'options',q.options
    ) order by md5(q.question_id||':'||(select auth.uid())::text||':'||current_date::text))
    from private.academy_assessment_questions q
    where q.assessment_id=p_assessment),'[]'::jsonb)
  );
end;
$function$

-- Enforce the documented retry limits and study interval server-side.
CREATE OR REPLACE FUNCTION public.submit_academy_assessment(p_assessment text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q record;correct integer:=0;total integer:=0;result public.academy_assessment_attempts;
  passing integer;percentage integer;chosen jsonb;
begin
  if not private.academy_assessment_eligible(p_assessment) then
    raise exception 'Assessment unavailable for this learner' using errcode='42501';
  end if;
  -- The same question IDs remain used in server grading after randomized display.
  -- Repeated failures require a short study interval, not access elevation.
  if (select count(*) from public.academy_assessment_attempts a
      where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
        and a.submitted_at>now()-interval '24 hours'
        and not a.passed)>=
        (select cooldown_after_failures from public.academy_assessment_policies
          where assessment_id=p_assessment)
     and exists(select 1 from public.academy_assessment_attempts a
       where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
         and not a.passed and a.submitted_at>
           now()-make_interval(mins=>(
             select cooldown_minutes from public.academy_assessment_policies
             where assessment_id=p_assessment
           ))) then
    raise exception 'Review recommended lessons before retrying this knowledge check'
      using errcode='23514';
  end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Submit one selected option per question' using errcode='22023';
  end if;
  if (select count(*) from public.academy_assessment_attempts a
    where a.user_id=(select auth.uid()) and a.assessment_id=p_assessment
      and a.submitted_at>now()-interval '24 hours')>=
    (select daily_attempt_limit from public.academy_assessment_policies where assessment_id=p_assessment) then
    raise exception 'The daily practice-attempt limit has been reached' using errcode='23514';
  end if;
  select passing_percent into passing from public.academy_assessments
  where assessment_id=p_assessment;
  for q in select question_id,correct_index from private.academy_assessment_questions
    where assessment_id=p_assessment order by position loop
    total:=total+1;
    chosen:=p_answers->q.question_id;
    if chosen is null or jsonb_typeof(chosen)<>'number'
      or chosen::text !~ '^[0-3]$' then
      raise exception 'Each question needs one valid response (0-3)' using errcode='22023';
    end if;
    if (chosen::text)::integer=q.correct_index then correct:=correct+1; end if;
  end loop;
  if total=0 or (select count(*) from jsonb_object_keys(p_answers))<>total then
    raise exception 'Question set is incomplete or has unknown identifiers' using errcode='22023';
  end if;
  percentage:=(100*correct)/total;
  insert into public.academy_assessment_attempts
    (user_id,assessment_id,score,total,passing_percent,passed,answers)
  values ((select auth.uid()),p_assessment,correct,total,passing,percentage>=passing,p_answers)
  returning * into result;
  return jsonb_build_object('id',result.id,'score',correct,'total',total,
    'percent',percentage,'passed',result.passed,'submitted_at',result.submitted_at);
end;
$function$;

