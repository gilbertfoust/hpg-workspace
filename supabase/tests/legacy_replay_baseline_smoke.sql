-- Validate authoritative shape of historical objects previously missing
-- from repository-only clean replay. This test does not create application data.
do $check$
declare
  name text;
  predicate regprocedure;
begin
  foreach name in array array[
    'volunteer_applications','hr_email_outbox','workspace_admin_notification_events','bod_memberships'
  ] loop
    if to_regclass('public.'||name) is null then
      raise exception 'Missing original production object: %',name;
    end if;
    if not coalesce((select relrowsecurity from pg_class
      where oid=('public.'||name)::regclass),false) then
      raise exception 'Legacy object % lacks RLS',name;
    end if;
    if has_table_privilege('anon','public.'||name,'SELECT') or
       has_table_privilege('anon','public.'||name,'INSERT') then
      raise exception 'Legacy object % has anonymous data access',name;
    end if;
  end loop;

  if to_regclass('public.pending_hr_volunteer_emails') is null then
    raise exception 'Pending volunteer mail view not reconstructed';
  end if;
  if not exists(select 1 from pg_class
    where oid='public.pending_hr_volunteer_emails'::regclass
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']) then
    raise exception 'Volunteer outbox view does not preserve RLS as security_invoker';
  end if;
  if not exists(select 1 from pg_constraint
    where conrelid='public.hr_email_outbox'::regclass
      and contype='f'
      and confrelid='public.volunteer_applications'::regclass) then
    raise exception 'Legacy HR outbox must retain application foreign key';
  end if;
  if not exists(select 1 from pg_constraint
    where conrelid='public.workspace_admin_notification_events'::regclass
      and conname='workspace_admin_notification_events_dedupe_key_key'
      and contype='u') then
    raise exception 'Notification event idempotency/unique dedupe constraint missing';
  end if;

  if exists(select 1 from public.hr_email_outbox limit 1)
    or exists(select 1 from public.workspace_admin_notification_events limit 1) then
    raise exception 'Historical baseline fixture should not invent emails or notification events';
  end if;

  foreach name in array array[
    'is_communications_staff', 'is_communications_approver',
    'current_workspace_identity_active', 'can_read_bod_meetings'
  ] loop
    predicate := to_regprocedure('public.' || name || '()');
    if predicate is null then
      raise exception 'Missing legacy authorization predicate: %', name;
    end if;
    if has_function_privilege('anon', predicate, 'EXECUTE')
      or not has_function_privilege('authenticated', predicate, 'EXECUTE') then
      raise exception 'Authorization predicate % has unexpected execute grants', name;
    end if;
  end loop;

  if public.is_communications_staff() is distinct from false
    or public.is_communications_approver() is distinct from false
    or public.current_workspace_identity_active() is distinct from false
    or public.can_read_bod_meetings() is distinct from false then
    raise exception 'Authorization predicates must reject a session without a user';
  end if;
end
$check$;
select 'isolated_legacy_baseline_replay_passed' as result;
