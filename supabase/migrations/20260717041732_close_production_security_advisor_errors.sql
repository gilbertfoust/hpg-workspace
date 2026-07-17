-- Close the remaining production Supabase Security Advisor errors.
-- Internal counters remain service-role only. HR may read only the volunteer
-- application and outbox rows needed by the pending-email operations view.

alter table public.transaction_number_counters enable row level security;
revoke all on public.transaction_number_counters from anon, authenticated;
grant all on public.transaction_number_counters to service_role;

alter table public.hr_email_outbox enable row level security;
revoke all on public.hr_email_outbox from anon, authenticated;
grant select on public.hr_email_outbox to authenticated;
grant all on public.hr_email_outbox to service_role;

drop policy if exists "HR reads email outbox" on public.hr_email_outbox;
create policy "HR reads email outbox"
on public.hr_email_outbox
for select
to authenticated
using (
  (select public.is_admin_user())
  or (
    select public.is_department_member(
      public.resolve_work_item_department('hr')
    )
  )
);

revoke all on public.volunteer_applications from anon, authenticated;
grant select on public.volunteer_applications to authenticated;
grant all on public.volunteer_applications to service_role;

drop policy if exists "HR reads volunteer applications"
  on public.volunteer_applications;
create policy "HR reads volunteer applications"
on public.volunteer_applications
for select
to authenticated
using (
  (select public.is_admin_user())
  or (
    select public.is_department_member(
      public.resolve_work_item_department('hr')
    )
  )
);

alter view public.pending_hr_volunteer_emails
  set (security_invoker = true);
revoke all on public.pending_hr_volunteer_emails from anon, authenticated;
grant select on public.pending_hr_volunteer_emails to authenticated;

do $$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.transaction_number_counters'::regclass
  ) then
    raise exception 'transaction_number_counters RLS is not enabled';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.hr_email_outbox'::regclass
  ) then
    raise exception 'hr_email_outbox RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.pending_hr_volunteer_emails'::regclass
      and coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'pending_hr_volunteer_emails is not security invoker';
  end if;
end
$$;
