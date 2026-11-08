-- Phase 5: enforce actual profile-based course eligibility at the database
-- boundary. UI navigation never grants a new employment role or data access.
create or replace function public.can_view_assigned_academy_track(p_track text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select public.can_participate_in_academy())
    and (p_track<>'board' or (select public.can_read_bod_meetings()))
    and (
      (select public.is_admin_user()) or
      exists(select 1 from public.academy_course_assignments a
        where a.user_id=(select auth.uid()) and a.track_id=p_track
          and a.status='assigned')
    );
$$;
create or replace function public.can_record_assigned_academy_lesson(p_lesson text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select public.can_participate_in_academy())
    and exists(
      select 1 from public.academy_lessons lesson
      join public.academy_course_assignments a on a.track_id=lesson.track_id
      where lesson.lesson_id=p_lesson and a.user_id=(select auth.uid())
        and a.status='assigned'
        and (lesson.track_id<>'board' or (select public.can_read_bod_meetings()))
    );
$$;
revoke all on function public.can_view_assigned_academy_track(text) from public,anon,authenticated;
revoke all on function public.can_record_assigned_academy_lesson(text) from public,anon,authenticated;
grant execute on function public.can_view_assigned_academy_track(text) to authenticated;
grant execute on function public.can_record_assigned_academy_lesson(text) to authenticated;

drop policy if exists "Approved Academy participants read authored lesson catalog"
on public.academy_lessons;
create policy "Lesson catalog limited to assigned internal training or administrators"
on public.academy_lessons for select to authenticated
using ((select public.can_view_assigned_academy_track(track_id)));

drop policy if exists "Approved learners see course syllabi"
on public.academy_course_syllabi;
create policy "Only assigned courses or authorized administrators read syllabi"
on public.academy_course_syllabi for select to authenticated
using ((select public.can_view_assigned_academy_track(track_id)));

drop policy if exists "Approved learners see lesson expectations"
on public.academy_lesson_standards;
create policy "Only assigned lesson standards or administrators are visible"
on public.academy_lesson_standards for select to authenticated
using (
  exists(select 1 from public.academy_lessons lesson
    where lesson.lesson_id=academy_lesson_standards.lesson_id
      and (select public.can_view_assigned_academy_track(lesson.track_id)))
);

drop policy if exists "Academy learners read available assessments"
on public.academy_assessments;
create policy "Assessment catalog is scoped to assigned courses"
on public.academy_assessments for select to authenticated
using (
  is_active and (select public.can_view_assigned_academy_track(track_id))
);

drop policy if exists "Learners view only reviewed Academy lesson media"
on public.academy_lesson_resources;
create policy "Reviewed lesson media is scoped by assigned course"
on public.academy_lesson_resources for select to authenticated
using (
  ((select public.is_admin_user()))
  or (
    status='published' and exists(
      select 1 from public.academy_lessons lesson
      where lesson.lesson_id=academy_lesson_resources.lesson_id
        and (select public.can_view_assigned_academy_track(lesson.track_id))
    )
  )
);

drop policy if exists "Participants record only their own practice completion"
on public.academy_lesson_progress;
create policy "Only assigned internal lessons may be self-reported complete"
on public.academy_lesson_progress for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (select public.can_record_assigned_academy_lesson(lesson_id))
);

-- Prevent a user from importing fabricated lesson completion for unassigned
-- courses, while retaining existing historical completions for correction.
comment on function public.can_record_assigned_academy_lesson(text) is
'Server-side guard for self-reported internal Workspace Training only. No job skill, HR certificate or departmental access is granted.';
