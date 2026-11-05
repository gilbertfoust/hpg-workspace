-- Persist voluntary HPG Learning Academy completion across devices.
-- This is a self-attested orientation record, NOT verified skill competency,
-- regulatory certification, official HR compliance or a graded assessment.
-- The existing profile manager/supervisor links authorize scoped team reports.

create table if not exists public.academy_lessons (
  lesson_id text primary key
    check (lesson_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(lesson_id)<=80),
  track_id text not null,
  title text not null,
  curriculum_version integer not null default 1 check (curriculum_version > 0),
  updated_at timestamptz not null default now()
);

insert into public.academy_lessons (lesson_id,track_id,title) values
  ('welcome','start','Find your dashboard'),
  ('assignments','start','Find your assigned work'),
  ('documents','start','Understand documents'),
  ('grant-search','grants','Find a funding opportunity'),
  ('grant-pipeline','grants','Track an application'),
  ('grant-draft','grants','Coordinate a proposal'),
  ('editorial-queue','communications','Create and assign an editorial pitch'),
  ('editorial-sources','communications','Document evidence for a story'),
  ('consent-review','communications','Review an interview or media consent requirement'),
  ('canonical-magazine-assembly','communications','Assemble a canonical magazine issue'),
  ('canonical-issue-release','communications','Preview and publish an approved HPG magazine issue'),
  ('canonical-public-release','communications','Release an approved Communications story'),
  ('interview','communications','Begin an interview assignment'),
  ('editorial-calendar','communications','Plan the editorial calendar'),
  ('interview-controls','communications','Document interview consent'),
  ('publish-magazine','communications','Assemble and publish an HPG magazine'),
  ('canonical-media','communications','Attach private media to a Communications story'),
  ('media-rights','communications','Manage editorial media and rights'),
  ('campaign-task','marketing','Create a Marketing campaign'),
  ('social-draft','marketing','Draft and review a social post'),
  ('marketing-channel','marketing','Connect a post to a campaign and channel'),
  ('social-publish','marketing','Schedule and publish social posts'),
  ('research-task','research','Track a research assignment'),
  ('research-files','research','Keep source evidence organized'),
  ('research-library','research','Managed research library'),
  ('budget-screen','budget','Review program budgets'),
  ('finance-operations','budget','Follow finance approvals'),
  ('receipts','accounting','Find receipts'),
  ('reconciliation','accounting','Review reconciliation'),
  ('reports','accounting','Review financial reports'),
  ('board-dashboard','board','Read organizational reports'),
  ('board-hub','board','Board meeting and voting hub')
on conflict (lesson_id) do update
set track_id=excluded.track_id,title=excluded.title,updated_at=now();

create table if not exists public.academy_lesson_progress (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  lesson_id text not null references public.academy_lessons(lesson_id)
    on delete restrict,
  completed_at timestamptz not null default now(),
  primary key (user_id,lesson_id)
);

create index if not exists academy_lesson_progress_completed_idx
  on public.academy_lesson_progress(completed_at desc);

alter table public.academy_lessons enable row level security;
alter table public.academy_lesson_progress enable row level security;

-- A board or viewer may complete their own board orientation; NGOs cannot
-- cross into the internal Academy. The predicate checks the actual approved,
-- active profile, not untrusted user_metadata or client-supplied role claims.
create or replace function public.can_participate_in_academy()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles profile
      where profile.id=(select auth.uid())
        and profile.is_approved
        and lower(trim(profile.approval_status))='approved'
        and profile.access_status='active'
        and profile.role in (
          'super_admin','admin_pm','vp_operations','vp_programs',
          'vp_development','vp_finance','vp_communications','department_lead',
          'ngo_coordinator','executive_secretariat','staff','staff_member',
          'viewer','board'
        )
    );
$$;

revoke all on function public.can_participate_in_academy() from public,anon,authenticated;
grant execute on function public.can_participate_in_academy() to authenticated;

revoke all on public.academy_lessons from public,anon,authenticated;
revoke all on public.academy_lesson_progress from public,anon,authenticated;
grant select on public.academy_lessons to authenticated;
grant select,delete on public.academy_lesson_progress to authenticated;
grant insert (lesson_id) on public.academy_lesson_progress to authenticated;

create policy "Approved Academy participants read authored lesson catalog"
on public.academy_lessons for select to authenticated
using ((select public.can_participate_in_academy()));

create policy "Participants see only their own self-attested progress"
on public.academy_lesson_progress for select to authenticated
using (
  user_id=(select auth.uid())
  and (select public.can_participate_in_academy())
);

create policy "Participants record only their own practice completion"
on public.academy_lesson_progress for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (select public.can_participate_in_academy())
);

create policy "Participants can correct only their own self-reported completion"
on public.academy_lesson_progress for delete to authenticated
using (
  user_id=(select auth.uid())
  and (select public.can_participate_in_academy())
);

-- The manager report discloses only approved active employees directly assigned
-- to this manager/supervisor. Admins with a valid privileged session may view
-- everyone in internal staff and board cohorts. Never return NGO accounts.
create or replace function public.get_academy_team_progress()
returns table (
  user_id uuid,
  full_name text,
  role text,
  department_id uuid,
  completed_count integer,
  completed_lessons text[],
  last_completed_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    p.id as user_id,
    coalesce(nullif(trim(p.full_name),''),'Unnamed colleague') as full_name,
    p.role,
    p.department_id,
    count(progress.lesson_id)::integer as completed_count,
    coalesce(
      array_agg(progress.lesson_id order by progress.completed_at)
        filter (where progress.lesson_id is not null),
      '{}'::text[]
    ) as completed_lessons,
    max(progress.completed_at) as last_completed_at
  from public.profiles p
  left join public.academy_lesson_progress progress on progress.user_id=p.id
  where (select auth.uid()) is not null
    and (select public.is_internal_user())
    and p.is_approved
    and lower(trim(p.approval_status))='approved'
    and p.access_status='active'
    and p.role in (
      'super_admin','admin_pm','vp_operations','vp_programs','vp_development',
      'vp_finance','vp_communications','department_lead','ngo_coordinator',
      'executive_secretariat','staff','staff_member','viewer','board'
    )
    and (
      (select public.is_admin_user())
      or p.supervisor_user_id=(select auth.uid())
      or p.manager_user_id=(select auth.uid())
    )
  group by p.id,p.full_name,p.role,p.department_id
  order by lower(coalesce(p.full_name,'')),p.id;
$$;

revoke all on function public.get_academy_team_progress()
from public,anon,authenticated;
grant execute on function public.get_academy_team_progress() to authenticated;

comment on table public.academy_lesson_progress is
  'Self-reported Learning Academy practice completion; not official competency certification.';
comment on function public.get_academy_team_progress() is
  'Returns only directly supervised active approved colleagues, or internal cohorts for privileged admins; self-reported practice only.';
