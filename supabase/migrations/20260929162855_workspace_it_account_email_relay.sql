-- Account email relay: the application sends only an internal wakeup. The
-- applicant message is sent through the connected IT Gmail account and becomes
-- "sent" only after its Gmail message ID is acknowledged.
alter table public.workspace_admin_notification_events
  drop constraint workspace_admin_notification_events_status_check;
alter table public.workspace_admin_notification_events
  add constraint workspace_admin_notification_events_status_check
  check (status in (
    'queued', 'leased', 'retry', 'sent', 'deadletter', 'cancelled',
    'awaiting_it_delivery', 'it_delivery_leased'
  ));

create or replace function public.claim_workspace_admin_notifications(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns setof public.workspace_admin_notification_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  -- An expired internal wakeup can be retried: no applicant email was sent.
  update public.workspace_admin_notification_events
  set status = case
        when response_json->>'send_started' = 'true'
             and coalesce(response_json->>'send_stage', '') <> 'it_wakeup'
          then 'deadletter'
        else 'retry' end,
      last_error = case
        when response_json->>'send_started' = 'true'
             and coalesce(response_json->>'send_stage', '') <> 'it_wakeup'
          then 'Provider acknowledgement was not recorded before lease expiry. Reconcile delivery before any resend.'
        else 'Worker lease expired before acknowledgement; retry scheduled.' end,
      lease_token = null, leased_until = null,
      next_attempt_at = now(), updated_at = now()
  where status = 'leased' and leased_until < now();

  -- Once Gmail send has begun, an expired lease is ambiguous and must never
  -- automatically send the applicant a second copy.
  update public.workspace_admin_notification_events
  set status = case when response_json->>'it_send_started' = 'true'
                    then 'deadletter' else 'awaiting_it_delivery' end,
      last_error = case when response_json->>'it_send_started' = 'true'
        then 'IT Gmail delivery acknowledgement was not recorded before lease expiry. Reconcile Sent mail before resending.'
        else 'IT delivery lease expired before send; a new wakeup will be queued.' end,
      lease_token = null, leased_until = null,
      next_attempt_at = now(), updated_at = now()
  where status = 'it_delivery_leased' and leased_until < now();

  -- An unattended internal wakeup is repeated hourly. This does not resend
  -- anything to the applicant and never touches an active Gmail delivery.
  update public.workspace_admin_notification_events
  set status = 'retry', updated_at = now()
  where status = 'awaiting_it_delivery'
    and next_attempt_at <= now()
    and coalesce(response_json->>'it_send_started', 'false') <> 'true';

  return query
  with candidates as (
    select event.id
    from public.workspace_admin_notification_events event
    where event.status in ('queued', 'retry')
      and event.next_attempt_at <= now()
      and (event.leased_until is null or event.leased_until < now())
    order by event.created_at, event.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 25))
  ), claimed as (
    update public.workspace_admin_notification_events event
    set status = 'leased',
        lease_token = extensions.gen_random_uuid(),
        leased_until = now() + pg_catalog.make_interval(
          secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))
        ),
        attempt_count = event.attempt_count + 1,
        updated_at = now()
    from candidates
    where event.id = candidates.id
    returning event.*
  )
  select * from claimed;
end;
$$;

-- Preserve the established eligibility rules; both application preparation
-- and IT delivery preparation must hold an unexpired matching lease.

-- A new generic approval supersedes every unsent earlier approval, including
-- notices waiting for the IT relay. A send already begun is quarantined for
-- reconciliation because its outcome can no longer safely be called cancelled.
create or replace function private.queue_workspace_account_approval_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text;
begin
  if not (
    new.is_approved is true and new.approval_status = 'approved'
    and old.is_approved is distinct from true
    and old.approval_status is distinct from 'approved'
    and new.access_status = 'active' and new.deleted_at is null
    and new.role not in ('external_ngo', 'ngo_user', 'external_portal')
  ) then return new; end if;

  select u.email into v_email
  from auth.users u where u.id = new.id and u.deleted_at is null;
  if v_email is null then return new; end if;

  update public.workspace_admin_notification_events
  set status = 'deadletter',
      last_error = 'A newer account approval superseded a delivery that had already begun. Reconcile Sent mail before resending.',
      lease_token = null, leased_until = null, updated_at = now()
  where notification_kind = 'workspace_account_approved'
    and source_id = new.id
    and (
      (status = 'it_delivery_leased' and response_json->>'it_send_started' = 'true')
      or (status = 'leased' and response_json->>'send_started' = 'true'
          and coalesce(response_json->>'send_stage', '') <> 'it_wakeup')
    );

  update public.workspace_admin_notification_events
  set status = 'cancelled', last_error = 'Superseded by a later approval',
      lease_token = null, leased_until = null, updated_at = now()
  where notification_kind = 'workspace_account_approved'
    and source_id = new.id
    and (
      status in ('queued', 'retry', 'awaiting_it_delivery')
      or (status = 'it_delivery_leased'
          and coalesce(response_json->>'it_send_started', 'false') <> 'true')
      or (status = 'leased'
          and (coalesce(response_json->>'send_started', 'false') <> 'true'
               or response_json->>'send_stage' = 'it_wakeup'))
    );

  insert into public.workspace_admin_notification_events
    (notification_kind, source_id, recipient_email, payload_json, dedupe_key)
  values
    ('workspace_account_approved', new.id, v_email,
     jsonb_build_object('user_id', new.id, 'role', new.role),
     'workspace-account-approved:' || new.id || ':' || new.updated_at);
  return new;
end;
$$;
revoke all on function private.queue_workspace_account_approval_notice()
  from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_ngo_approval_delivery(p_notification_id uuid, p_lease_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.workspace_admin_notification_events; recipient record;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Unauthorized'; end if;
  select * into e from public.workspace_admin_notification_events where id=p_notification_id
    and lease_token=p_lease_token and status in ('leased', 'it_delivery_leased') and leased_until>clock_timestamp() for update;
  if not found or e.notification_kind <> 'ngo_portal_approved' then raise exception 'Notification lease lost'; end if;
  select u.email,u.email_confirmed_at,p.full_name,coalesce(n.common_name,n.legal_name) ngo_name into recipient
  from public.ngo_portal_memberships m join public.profiles p on p.id=m.user_id
  join auth.users u on u.id=p.id join public.ngos n on n.id=m.ngo_id
  where m.id=e.source_id and m.status='active' and m.approval_activation_id::text=e.payload_json->>'activation_id' and m.user_id::text=e.payload_json->>'user_id'
    and m.ngo_id::text=e.payload_json->>'ngo_id' and p.is_approved and p.approval_status='approved'
    and p.access_status='active' and p.deleted_at is null and p.role in ('external_ngo','ngo_user','external_portal')
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
    and n.archived_at is null and n.closed_at is null and n.merged_into_ngo_id is null;
  if not found then
    update public.workspace_admin_notification_events set status='cancelled',lease_token=null,leased_until=null,
      last_error='NGO portal access or verified recipient is no longer eligible',updated_at=now() where id=e.id;
    return jsonb_build_object('ready',false);
  end if;
  if recipient.email_confirmed_at is null then
    update public.workspace_admin_notification_events set status='retry',next_attempt_at=now()+interval '1 hour',attempt_count=greatest(attempt_count-1,0),lease_token=null,leased_until=null,response_json='{}',last_error='Awaiting verified account email',updated_at=now() where id=e.id;
    return jsonb_build_object('ready',false,'reason','awaiting_email_verification');
  end if;
  update public.workspace_admin_notification_events set recipient_email=recipient.email where id=e.id;
  return jsonb_build_object('ready',true,'recipient_email',recipient.email,'full_name',recipient.full_name,'ngo_name',recipient.ngo_name);
end $function$;


CREATE OR REPLACE FUNCTION public.prepare_workspace_account_approval_delivery(p_notification_id uuid, p_lease_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.workspace_admin_notification_events; recipient record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status in ('leased', 'it_delivery_leased') and leased_until > clock_timestamp()
  for update;
  if not found or e.notification_kind <> 'workspace_account_approved' then
    raise exception 'Notification lease lost';
  end if;

  select u.email, u.email_confirmed_at, p.full_name into recipient
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = e.source_id and p.is_approved and p.approval_status = 'approved'
    and p.access_status = 'active' and p.deleted_at is null
    and p.role not in ('external_ngo', 'ngo_user', 'external_portal')
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now());
  if not found then
    update public.workspace_admin_notification_events
    set status = 'cancelled', lease_token = null, leased_until = null,
        last_error = 'Workspace account is no longer eligible',
        updated_at = now()
    where id = e.id;
    return jsonb_build_object('ready', false, 'reason', 'account_ineligible');
  end if;
  if recipient.email_confirmed_at is null then
    update public.workspace_admin_notification_events
    set status = 'retry', next_attempt_at = now() + interval '1 hour',
        attempt_count = greatest(attempt_count - 1, 0),
        lease_token = null, leased_until = null, response_json = '{}',
        last_error = 'Awaiting verified account email', updated_at = now()
    where id = e.id;
    return jsonb_build_object('ready', false, 'reason', 'awaiting_email_verification');
  end if;

  update public.workspace_admin_notification_events
  set recipient_email = recipient.email where id = e.id;
  return jsonb_build_object('ready', true, 'recipient_email', recipient.email,
                            'full_name', recipient.full_name);
end;
$function$;


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
    and status in ('leased', 'it_delivery_leased') and leased_until > clock_timestamp()
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


create or replace function public.mark_workspace_it_delivery_ready(
  p_notification_id uuid,
  p_lease_token uuid,
  p_subject text,
  p_text text,
  p_wakeup_response jsonb default '{}'::jsonb
)
returns public.workspace_admin_notification_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.workspace_admin_notification_events;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if nullif(btrim(p_subject), '') is null or length(p_subject) > 500
     or nullif(btrim(p_text), '') is null or length(p_text) > 30000
     or jsonb_typeof(coalesce(p_wakeup_response, '{}'::jsonb)) <> 'object' then
    raise exception 'A valid frozen email subject and body are required.';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status = 'leased' and leased_until > clock_timestamp()
    and notification_kind in (
      'ngo_portal_approved', 'workspace_account_approved', 'workspace_signup_received'
    )
  for update;
  if not found then
    raise exception 'Notification lease is no longer valid.' using errcode = '40001';
  end if;

  update public.workspace_admin_notification_events
  set status = 'awaiting_it_delivery',
      response_json = coalesce(p_wakeup_response, '{}'::jsonb) ||
        jsonb_build_object(
          'provider', 'smtp_wakeup',
          'send_stage', 'it_wakeup',
          'send_started', false,
          'it_send_started', false,
          'it_relay_version', 1,
          'subject', p_subject,
          'text', p_text,
          'intended_from', 'itsupport@humanitypathwaysglobal.com',
          'reply_to', 'itsupport@humanitypathwaysglobal.com',
          'wakeup_accepted_at', now()
        ),
      next_attempt_at = now() + interval '1 hour',
      attempt_count = 0,
      lease_token = null, leased_until = null,
      last_error = null, sent_at = null, updated_at = now()
  where id = e.id
  returning * into e;
  return e;
end;
$$;

create or replace function public.claim_workspace_it_delivery(
  p_notification_id uuid
)
returns public.workspace_admin_notification_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.workspace_admin_notification_events;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id
    and notification_kind in (
      'ngo_portal_approved', 'workspace_account_approved', 'workspace_signup_received'
    )
  for update;
  if not found then return null; end if;

  if e.status = 'it_delivery_leased' and e.leased_until < clock_timestamp() then
    if e.response_json->>'it_send_started' = 'true' then
      update public.workspace_admin_notification_events
      set status = 'deadletter', lease_token = null, leased_until = null,
          last_error = 'IT Gmail delivery acknowledgement was not recorded before lease expiry. Reconcile Sent mail before resending.',
          updated_at = now()
      where id = e.id;
      return null;
    end if;
    -- Reclaim an expired lease only when Gmail sending never began.
  elsif e.status <> 'awaiting_it_delivery' then
    return null;
  end if;

  if e.response_json->>'it_send_started' = 'true'
     or e.response_json->>'it_relay_version' is distinct from '1'
     or e.response_json->>'intended_from' is distinct from 'itsupport@humanitypathwaysglobal.com'
     or nullif(btrim(e.response_json->>'subject'), '') is null
     or nullif(btrim(e.response_json->>'text'), '') is null then
    raise exception 'IT relay email is not ready for delivery.';
  end if;

  update public.workspace_admin_notification_events
  set status = 'it_delivery_leased',
      lease_token = extensions.gen_random_uuid(),
      leased_until = now() + interval '15 minutes',
      updated_at = now()
  where id = e.id
  returning * into e;
  return e;
end;
$$;

create or replace function public.begin_workspace_it_delivery(
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
  prepared jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status = 'it_delivery_leased' and leased_until > clock_timestamp()
  for update;
  if not found then
    raise exception 'IT delivery lease is no longer valid.' using errcode = '40001';
  end if;
  if e.response_json->>'it_send_started' = 'true' then
    raise exception 'IT send has already begun. Reconcile Sent mail; do not send again.';
  end if;

  case e.notification_kind
    when 'ngo_portal_approved' then
      prepared := public.prepare_ngo_approval_delivery(e.id, p_lease_token);
    when 'workspace_account_approved' then
      prepared := public.prepare_workspace_account_approval_delivery(e.id, p_lease_token);
    when 'workspace_signup_received' then
      prepared := public.prepare_workspace_signup_received_delivery(e.id, p_lease_token);
    else
      raise exception 'This notification is not an IT account email.';
  end case;
  if coalesce((prepared->>'ready')::boolean, false) is not true then
    return prepared;
  end if;

  if e.response_json->>'it_relay_version' is distinct from '1'
     or e.response_json->>'intended_from' is distinct from 'itsupport@humanitypathwaysglobal.com'
     or nullif(btrim(e.response_json->>'subject'), '') is null
     or nullif(btrim(e.response_json->>'text'), '') is null
     or nullif(btrim(prepared->>'recipient_email'), '') is null then
    raise exception 'IT relay email is incomplete.';
  end if;

  update public.workspace_admin_notification_events
  set response_json = response_json ||
        jsonb_build_object('it_send_started', true, 'it_send_started_at', now()),
      updated_at = now()
  where id = e.id;

  return prepared || jsonb_build_object(
    'notification_id', e.id,
    'notification_kind', e.notification_kind,
    'subject', e.response_json->>'subject',
    'text', e.response_json->>'text',
    'from_email', 'itsupport@humanitypathwaysglobal.com',
    'reply_to', 'itsupport@humanitypathwaysglobal.com'
  );
end;
$$;

create or replace function public.finish_workspace_it_delivery(
  p_notification_id uuid,
  p_lease_token uuid,
  p_gmail_message_id text
)
returns public.workspace_admin_notification_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.workspace_admin_notification_events;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if nullif(btrim(p_gmail_message_id), '') is null
     or length(p_gmail_message_id) > 500 then
    raise exception 'The actual IT Gmail message ID is required.';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id
  for update;
  if not found then
    raise exception 'Notification not found.';
  end if;
  -- The same successful acknowledgement can be repeated safely after a lost
  -- RPC response; a different Gmail message ID is never silently accepted.
  if e.status = 'sent'
     and e.response_json->>'provider' = 'gmail_it'
     and e.response_json->>'gmail_message_id' = p_gmail_message_id then
    return e;
  end if;
  if e.status <> 'it_delivery_leased'
     or e.lease_token is distinct from p_lease_token
     or e.leased_until is null
     or e.leased_until <= clock_timestamp()
     or e.response_json->>'it_send_started' is distinct from 'true'
     or e.response_json->>'intended_from' is distinct from 'itsupport@humanitypathwaysglobal.com'
     or e.notification_kind not in (
       'ngo_portal_approved', 'workspace_account_approved', 'workspace_signup_received'
     ) then
    raise exception 'IT delivery acknowledgement has no valid started lease.' using errcode = '40001';
  end if;

  update public.workspace_admin_notification_events
  set status = 'sent', sent_at = now(), last_error = null,
      response_json = response_json || jsonb_build_object(
        'provider', 'gmail_it',
        'gmail_message_id', p_gmail_message_id,
        'from_email', 'itsupport@humanitypathwaysglobal.com',
        'reply_to', 'itsupport@humanitypathwaysglobal.com',
        'it_acknowledged_at', now()
      ),
      lease_token = null, leased_until = null, updated_at = now()
  where id = e.id
  returning * into e;
  return e;
end;
$$;

create or replace function public.fail_workspace_it_delivery(
  p_notification_id uuid,
  p_lease_token uuid,
  p_error text
)
returns public.workspace_admin_notification_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.workspace_admin_notification_events;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status = 'it_delivery_leased' and leased_until > clock_timestamp()
  for update;
  if not found then
    raise exception 'IT delivery lease is no longer valid.' using errcode = '40001';
  end if;

  update public.workspace_admin_notification_events
  set status = case when e.response_json->>'it_send_started' = 'true'
                    then 'deadletter' else 'awaiting_it_delivery' end,
      last_error = left(coalesce(nullif(p_error, ''), 'IT delivery could not be completed.'), 2000),
      next_attempt_at = now() + interval '1 hour',
      lease_token = null, leased_until = null, updated_at = now()
  where id = e.id
  returning * into e;
  return e;
end;
$$;

-- One acknowledged Gmail message cannot be credited to two applicant notices.
create unique index if not exists workspace_account_it_gmail_message_unique
  on public.workspace_admin_notification_events ((response_json->>'gmail_message_id'))
  where response_json->>'provider' = 'gmail_it'
    and response_json->>'gmail_message_id' is not null;

revoke all on function public.claim_workspace_admin_notifications(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_workspace_admin_notifications(integer, integer)
  to service_role;
revoke all on function public.prepare_ngo_approval_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_ngo_approval_delivery(uuid, uuid)
  to service_role;
revoke all on function public.prepare_workspace_account_approval_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_workspace_account_approval_delivery(uuid, uuid)
  to service_role;
revoke all on function public.prepare_workspace_signup_received_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_workspace_signup_received_delivery(uuid, uuid)
  to service_role;

revoke all on function public.mark_workspace_it_delivery_ready(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_workspace_it_delivery_ready(uuid, uuid, text, text, jsonb)
  to service_role;
revoke all on function public.claim_workspace_it_delivery(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_workspace_it_delivery(uuid)
  to service_role;
revoke all on function public.begin_workspace_it_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_workspace_it_delivery(uuid, uuid)
  to service_role;
revoke all on function public.finish_workspace_it_delivery(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finish_workspace_it_delivery(uuid, uuid, text)
  to service_role;
revoke all on function public.fail_workspace_it_delivery(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_workspace_it_delivery(uuid, uuid, text)
  to service_role;
