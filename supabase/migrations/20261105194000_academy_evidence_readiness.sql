-- HPG Executive Professional Academy / Workspace Training evidence-based readiness.
-- Staff acceptance records remain EMPTY until later, genuine user testing.
create table if not exists public.academy_training_acceptance (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.academy_lessons(lesson_id) on delete restrict,
  tested_user_id uuid not null references auth.users(id) on delete restrict,
  tested_role text not null,
  outcome text not null check(outcome in ('passed','failed','blocked')),
  evidence_note text not null check(length(btrim(evidence_note))>=20),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  check(tested_user_id<>reviewed_by)
);
create index if not exists academy_training_acceptance_lesson_idx
  on public.academy_training_acceptance(lesson_id,tested_user_id,reviewed_at desc);
alter table public.academy_training_acceptance enable row level security;
revoke all on public.academy_training_acceptance from public,anon,authenticated;
grant select on public.academy_training_acceptance to authenticated;
create policy "Academy administrators read training acceptance evidence"
on public.academy_training_acceptance for select to authenticated
using ((select public.is_admin_user()));

create or replace function public.record_academy_training_acceptance(
  p_lesson_id text,p_tested_user_id uuid,p_outcome text,p_evidence_note text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare role_text text;created uuid;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Authorized Academy administrator required' using errcode='42501';
  end if;
  if p_tested_user_id=(select auth.uid()) then
    raise exception 'An administrator may not independently attest their own role test' using errcode='42501';
  end if;
  if p_outcome not in('passed','failed','blocked') or length(btrim(coalesce(p_evidence_note,'')))<20 then
    raise exception 'Choose a permitted result and provide at least twenty characters of actual test evidence' using errcode='23514';
  end if;
  select p.role into role_text from public.profiles p
  where p.id=p_tested_user_id and p.is_approved
    and lower(trim(p.approval_status))='approved'
    and p.access_status='active'
    and p.role not in('ngo_user','external_ngo');
  if not found then
    raise exception 'Only currently active, approved internal staff or Board users may be tested' using errcode='42501';
  end if;
  insert into public.academy_training_acceptance(
    lesson_id,tested_user_id,tested_role,outcome,evidence_note,reviewed_by
  ) values(
    p_lesson_id,p_tested_user_id,role_text,p_outcome,btrim(p_evidence_note),(select auth.uid())
  ) returning id into created;
  return created;
end;
$$;

create or replace function public.get_academy_training_readiness()
returns table(
  lesson_id text,track_id text,lesson_title text,
  question_count bigint,reviewed_demo_count bigint,reviewed_reference_count bigint,
  tested_role_count bigint,passed_role_count bigint,blocked_or_failed_count bigint,
  last_role_review_at timestamptz
) language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Academy readiness dashboard requires administrator access' using errcode='42501';
  end if;
  return query
  with latest as (
    select distinct on (a.lesson_id,a.tested_role)
      a.lesson_id,a.tested_role,a.outcome,a.reviewed_at
    from public.academy_training_acceptance a
    order by a.lesson_id,a.tested_role,a.reviewed_at desc,a.id desc
  )
  select
    lesson.lesson_id,lesson.track_id,lesson.title,
    (select count(*) from private.academy_assessment_questions q
      join public.academy_assessments assess on assess.assessment_id=q.assessment_id
      where assess.track_id=lesson.track_id and assess.is_active),
    (select count(*) from public.academy_lesson_resources res
      where res.lesson_id=lesson.lesson_id and res.status='published'
        and res.resource_kind='recorded_demo'),
    (select count(*) from public.academy_lesson_resources res
      where res.lesson_id=lesson.lesson_id and res.status='published'),
    (select count(*) from latest t where t.lesson_id=lesson.lesson_id),
    (select count(*) from latest t where t.lesson_id=lesson.lesson_id and t.outcome='passed'),
    (select count(*) from latest t where t.lesson_id=lesson.lesson_id and t.outcome in('blocked','failed')),
    (select max(t.reviewed_at) from latest t where t.lesson_id=lesson.lesson_id)
  from public.academy_lessons lesson
  order by lesson.track_id,lesson.title;
end;
$$;
revoke all on function public.record_academy_training_acceptance(text,uuid,text,text)
from public,anon,authenticated;
revoke all on function public.get_academy_training_readiness()
from public,anon,authenticated;
grant execute on function public.record_academy_training_acceptance(text,uuid,text,text)
to authenticated;
grant execute on function public.get_academy_training_readiness()
to authenticated;
comment on table public.academy_training_acceptance is
  'Administrator-reviewed historical staff/Board workflow tests. Never seeded or marked complete by code deployment.';
