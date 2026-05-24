-- Restrict form workflow routing records to internal HPG users.
-- Applied to the connected Supabase project before this migration was tracked.

create or replace function public.is_hpg_internal_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in (
        'staff',
        'super_admin',
        'admin_pm',
        'ngo_coordinator',
        'department_lead',
        'executive_secretariat'
      )
  );
$$;

revoke all on function public.is_hpg_internal_user() from public;
grant execute on function public.is_hpg_internal_user() to authenticated;

alter function public.queue_form_submission_notification_events() security definer;
alter function public.queue_form_submission_notification_events() set search_path = public;

drop policy if exists "department notification routes readable by authenticated users" on public.department_notification_routes;
drop policy if exists "department notification routes writable by authenticated users" on public.department_notification_routes;
drop policy if exists "form notification events readable by authenticated users" on public.form_notification_events;
drop policy if exists "form notification events insertable by authenticated users" on public.form_notification_events;
drop policy if exists "form notification events updatable by authenticated users" on public.form_notification_events;

create policy "internal users can read department workflow routes"
on public.department_notification_routes
for select
to authenticated
using (public.is_hpg_internal_user());

create policy "internal users can update department workflow routes"
on public.department_notification_routes
for update
to authenticated
using (public.is_hpg_internal_user())
with check (public.is_hpg_internal_user());

create policy "internal users can read form workflow events"
on public.form_notification_events
for select
to authenticated
using (public.is_hpg_internal_user());
