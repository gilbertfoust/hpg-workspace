-- CI ONLY: recreate the live Board membership schema and authorization
-- predicates required by Academy assessments. Derived from the HPG catalog
-- on 2026-11-08. This fixture contains no memberships or credentials.

create table public.bod_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  board_title text,
  term_starts_on date,
  term_ends_on date,
  is_active boolean not null default true,
  appointed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bod_memberships_appointed_by_idx
  on public.bod_memberships(appointed_by_user_id) where appointed_by_user_id is not null;
alter table public.bod_memberships enable row level security;
revoke all on public.bod_memberships from public, anon, authenticated;
grant select on public.bod_memberships to authenticated;
grant all on public.bod_memberships to service_role;

create function public.is_approved_board_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_workspace_identity_active() and exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role='board'
  );
$$;
revoke all on function public.is_approved_board_user() from public, anon;
grant execute on function public.is_approved_board_user() to authenticated, service_role;

create policy "Board roster visible to Board and administrators"
  on public.bod_memberships for select to authenticated
  using (public.is_admin_user() or public.is_approved_board_user());

create function public.can_manage_bod_meetings()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_workspace_identity_active()
    and (public.is_admin_user() or exists (
      select 1 from public.profiles where id=auth.uid() and role='executive_secretariat'
    ));
$$;
revoke all on function public.can_manage_bod_meetings() from public, anon;
grant execute on function public.can_manage_bod_meetings() to authenticated, service_role;

create function public.can_read_bod_meetings()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_workspace_identity_active()
    and (public.can_manage_bod_meetings() or exists (
      select 1 from public.bod_memberships m
      where m.user_id=auth.uid() and m.is_active
        and (m.term_starts_on is null or m.term_starts_on<=current_date)
        and (m.term_ends_on is null or m.term_ends_on>=current_date)
    ));
$$;
revoke all on function public.can_read_bod_meetings() from public, anon;
grant execute on function public.can_read_bod_meetings() to authenticated, service_role;
