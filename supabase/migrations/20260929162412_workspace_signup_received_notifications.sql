-- Transactional acknowledgment for new self-service registrations. Existing
-- workspace_access_request notices to the administrator remain unchanged.
alter table public.workspace_admin_notification_events
  drop constraint workspace_admin_notification_events_notification_kind_check;
alter table public.workspace_admin_notification_events
  add constraint workspace_admin_notification_events_notification_kind_check
  check (notification_kind in (
    'workspace_error', 'workspace_access_request', 'work_item_notice',
    'ngo_portal_approved', 'workspace_account_approved',
    'approval_delivery_failed', 'workspace_signup_received'
  ));

create or replace function private.queue_workspace_signup_received_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if new.is_approved is true
     or lower(btrim(new.approval_status)) <> 'pending'
     or new.access_status <> 'active'
     or new.deleted_at is not null
     or new.deletion_requested_at is not null then
    return new;
  end if;

  select nullif(btrim(u.email), '') into v_email
  from auth.users u
  where u.id = new.id
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and lower(btrim(coalesce(u.raw_app_meta_data->>'creation_source', '')))
        <> 'workspace_admin';
  if v_email is null then
    return new;
  end if;

  insert into public.workspace_admin_notification_events
    (notification_kind, source_id, recipient_email, payload_json, dedupe_key)
  values
    ('workspace_signup_received', new.id, v_email,
     jsonb_build_object('user_id', new.id, 'full_name', new.full_name,
                        'requested_at', new.created_at),
     'workspace-signup-received:' || new.id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.queue_workspace_signup_received_notice()
  from public, anon, authenticated;

drop trigger if exists profiles_queue_workspace_signup_received_notice
  on public.profiles;
create trigger profiles_queue_workspace_signup_received_notice
after insert on public.profiles
for each row execute function private.queue_workspace_signup_received_notice();

-- This receipt deliberately does not require email confirmation. It only
-- acknowledges the registration and asks the applicant to wait; it grants no
-- access and contains no verification, password-reset, or sign-in token.
-- Rechecking immediately before delivery avoids telling a rapidly approved
-- applicant to wait after their approval notice is already queued.
create or replace function public.prepare_workspace_signup_received_delivery(
  p_notification_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.workspace_admin_notification_events;
  recipient record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status = 'leased' and leased_until > clock_timestamp()
  for update;
  if not found or e.notification_kind <> 'workspace_signup_received' then
    raise exception 'Notification lease lost';
  end if;

  select u.email, p.full_name into recipient
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = e.source_id
    and p.is_approved is not true
    and lower(btrim(p.approval_status)) = 'pending'
    and p.access_status = 'active'
    and p.deleted_at is null
    and p.deletion_requested_at is null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and nullif(btrim(u.email), '') is not null
    and lower(btrim(coalesce(u.raw_app_meta_data->>'creation_source', '')))
        <> 'workspace_admin';

  if not found then
    update public.workspace_admin_notification_events
    set status = 'cancelled', lease_token = null, leased_until = null,
        last_error = 'Signup is no longer awaiting approval or account is ineligible',
        updated_at = now()
    where id = e.id;
    return jsonb_build_object('ready', false, 'reason', 'account_ineligible');
  end if;

  update public.workspace_admin_notification_events
  set recipient_email = recipient.email where id = e.id;
  return jsonb_build_object('ready', true,
                            'recipient_email', recipient.email,
                            'full_name', recipient.full_name);
end;
$$;

revoke all on function public.prepare_workspace_signup_received_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_workspace_signup_received_delivery(uuid, uuid)
  to service_role;

-- Reuse the established IT delivery-review queue without altering the existing
-- approval audit trigger. The kind in the payload lets the worker label this as
-- a signup receipt failure rather than an approval email failure.
create or replace function private.record_workspace_signup_notification_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  if new.notification_kind <> 'workspace_signup_received'
     or new.status <> 'deadletter'
     or old.status is not distinct from new.status then
    return new;
  end if;

  select p.full_name into v_full_name
  from public.profiles p where p.id = new.source_id;

  insert into public.controller_alerts
    (module, severity, message, context_json)
  select 'system', 'warning',
         'Workspace signup receipt failed for ' || new.recipient_email ||
           '. IT should review delivery before resending.',
         jsonb_build_object('notification_id', new.id,
                            'notification_kind', new.notification_kind,
                            'recipient_email', new.recipient_email,
                            'last_error', new.last_error)
  where not exists (
    select 1 from public.controller_alerts a
    where a.context_json->>'notification_id' = new.id::text
  );

  insert into public.workspace_admin_notification_events
    (notification_kind, source_id, recipient_email, payload_json, dedupe_key)
  values
    ('approval_delivery_failed', new.id,
     'itsupport@humanitypathwaysglobal.com',
     jsonb_build_object('original_notification_id', new.id,
                        'original_notification_kind', new.notification_kind,
                        'recipient_email', new.recipient_email,
                        'full_name', v_full_name,
                        'last_error', new.last_error),
     'signup-delivery-failed:' || new.id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.record_workspace_signup_notification_outcome()
  from public, anon, authenticated;

drop trigger if exists workspace_signup_notification_outcome
  on public.workspace_admin_notification_events;
create trigger workspace_signup_notification_outcome
after update of status on public.workspace_admin_notification_events
for each row execute function private.record_workspace_signup_notification_outcome();

-- No backfill: only future self-service profile inserts receive this receipt.
