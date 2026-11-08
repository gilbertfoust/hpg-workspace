-- Close the remaining production Supabase Security Advisor errors.
-- The HR outbox, volunteer application table and pending-email view can be
-- provisioned externally or later in fresh installations. Harden each only
-- when it already exists; do not manufacture HR data or stub HR objects.
-- Existing installations receive the exact original grants and policies.

alter table public.transaction_number_counters enable row level security;
revoke all on public.transaction_number_counters from anon, authenticated;
grant all on public.transaction_number_counters to service_role;

do $harden_hr$
begin
  if to_regclass('public.hr_email_outbox') is not null then
    execute 'alter table public.hr_email_outbox enable row level security';
    execute 'revoke all on public.hr_email_outbox from anon, authenticated';
    execute 'grant select on public.hr_email_outbox to authenticated';
    execute 'grant all on public.hr_email_outbox to service_role';
    execute 'drop policy if exists "HR reads email outbox" on public.hr_email_outbox';
    execute $outbox_policy$
      create policy "HR reads email outbox"
      on public.hr_email_outbox for select to authenticated
      using (
        (select public.is_admin_user())
        or (select public.is_department_member(
          public.resolve_work_item_department('hr')
        ))
      )
    $outbox_policy$;
  end if;

  if to_regclass('public.volunteer_applications') is not null then
    execute 'revoke all on public.volunteer_applications from anon, authenticated';
    execute 'grant select on public.volunteer_applications to authenticated';
    execute 'grant all on public.volunteer_applications to service_role';
    execute 'drop policy if exists "HR reads volunteer applications" on public.volunteer_applications';
    execute $volunteer_policy$
      create policy "HR reads volunteer applications"
      on public.volunteer_applications for select to authenticated
      using (
        (select public.is_admin_user())
        or (select public.is_department_member(
          public.resolve_work_item_department('hr')
        ))
      )
    $volunteer_policy$;
  end if;

  if to_regclass('public.pending_hr_volunteer_emails') is not null then
    execute 'alter view public.pending_hr_volunteer_emails set (security_invoker = true)';
    execute 'revoke all on public.pending_hr_volunteer_emails from anon, authenticated';
    execute 'grant select on public.pending_hr_volunteer_emails to authenticated';
  end if;

  if not (
    select relrowsecurity from pg_class
    where oid='public.transaction_number_counters'::regclass
  ) then
    raise exception 'transaction_number_counters RLS is not enabled';
  end if;

  if to_regclass('public.hr_email_outbox') is not null and not (
    select relrowsecurity from pg_class
    where oid=to_regclass('public.hr_email_outbox')
  ) then
    raise exception 'hr_email_outbox RLS is not enabled';
  end if;

  if to_regclass('public.pending_hr_volunteer_emails') is not null
    and not exists (
      select 1 from pg_class
      where oid=to_regclass('public.pending_hr_volunteer_emails')
        and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']
    )
  then
    raise exception 'pending_hr_volunteer_emails is not security invoker';
  end if;
end;
$harden_hr$;
