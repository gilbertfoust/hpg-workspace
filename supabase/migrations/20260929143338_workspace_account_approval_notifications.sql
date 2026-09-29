-- Approval notices: one queued message per access approval, a durable
-- organization correspondence record after provider acceptance, and an IT
-- escalation when delivery reaches a terminal failure.
alter table public.workspace_admin_notification_events
  drop constraint workspace_admin_notification_events_notification_kind_check;
alter table public.workspace_admin_notification_events
  add constraint workspace_admin_notification_events_notification_kind_check
  check (notification_kind in (
    'workspace_error', 'workspace_access_request', 'work_item_notice',
    'ngo_portal_approved', 'workspace_account_approved', 'approval_delivery_failed'
  ));

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
  from auth.users u
  where u.id = new.id and u.deleted_at is null;
  if v_email is null then return new; end if;

  -- A later approval supersedes an unsent earlier one.
  update public.workspace_admin_notification_events
  set status = 'cancelled', last_error = 'Superseded by a later approval',
      updated_at = now()
  where notification_kind = 'workspace_account_approved'
    and source_id = new.id and status in ('queued', 'retry');

  insert into public.workspace_admin_notification_events
    (notification_kind, source_id, recipient_email, payload_json, dedupe_key)
  values
    ('workspace_account_approved', new.id, v_email,
     jsonb_build_object('user_id', new.id, 'role', new.role),
     'workspace-account-approved:' || new.id || ':' || new.updated_at);
  return new;
end;
$$;
revoke all on function private.queue_workspace_account_approval_notice() from public;

drop trigger if exists profiles_queue_workspace_account_approval_notice on public.profiles;
create trigger profiles_queue_workspace_account_approval_notice
after update of is_approved, approval_status on public.profiles
for each row execute function private.queue_workspace_account_approval_notice();

create or replace function public.prepare_workspace_account_approval_delivery(
  p_notification_id uuid, p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare e public.workspace_admin_notification_events; recipient record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into e from public.workspace_admin_notification_events
  where id = p_notification_id and lease_token = p_lease_token
    and status = 'leased' and leased_until > clock_timestamp()
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
$$;
revoke all on function public.prepare_workspace_account_approval_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_workspace_account_approval_delivery(uuid, uuid)
  to service_role;

create or replace function private.record_approval_notification_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ngo_id uuid;
  v_org_id uuid;
  v_ngo_name text;
  v_full_name text;
  v_subject text;
  v_text text;
begin
  if new.notification_kind not in ('ngo_portal_approved', 'workspace_account_approved')
     or old.status is not distinct from new.status then
    return new;
  end if;

  if new.notification_kind = 'ngo_portal_approved' then
    select m.ngo_id, coalesce(n.common_name, n.legal_name), p.full_name
    into v_ngo_id, v_ngo_name, v_full_name
    from public.ngo_portal_memberships m
    join public.ngos n on n.id = m.ngo_id
    join public.profiles p on p.id = m.user_id
    where m.id = new.source_id;
  else
    select p.full_name into v_full_name
    from public.profiles p where p.id = new.source_id;
  end if;

  if new.status = 'sent' and v_ngo_id is not null then
    v_subject := coalesce(nullif(new.response_json->>'subject', ''),
                          'Your HPG Workspace portal account is approved');
    v_text := nullif(new.response_json->>'text', '');

    insert into public.crm_organizations
      (ngo_id, name, org_type, relationship_status, source_system, source_reference)
    values (v_ngo_id, v_ngo_name, 'partner', 'active', 'hpg_workspace',
            'ngo:' || v_ngo_id)
    on conflict (ngo_id) where ngo_id is not null do nothing;
    select id into v_org_id from public.crm_organizations where ngo_id = v_ngo_id;

    insert into public.crm_interactions
      (organization_id, interaction_type, subject, description,
       interaction_date, external_key, direction, channel, outcome,
       status, follow_up_needed, evidence_source, evidence_strength,
       source_reference, date_precision)
    values
      (v_org_id, 'email', v_subject,
       coalesce(v_text, 'Portal approval email accepted for delivery to ' ||
                            new.recipient_email ||
                            '. Full text was not retained for this earlier send.'),
       coalesce(new.sent_at, now()), 'workspace-approval-email:' || new.id,
       'outbound', 'email', 'provider_accepted', 'completed', false,
       'workspace_admin_notification_events', 6, new.id::text, 'exact')
    on conflict (external_key) do nothing;

    insert into public.ngo_activity_history
      (ngo_id, occurred_at, action, record_type, record_id,
       record_name, summary, details)
    select v_ngo_id, coalesce(new.sent_at, now()), 'email_sent',
           'workspace_admin_notification_events', new.id, v_subject,
           'Workspace portal approval email accepted for delivery to ' ||
             new.recipient_email,
           jsonb_strip_nulls(jsonb_build_object(
             'recipient_email', new.recipient_email, 'subject', v_subject,
             'body', v_text, 'provider', new.response_json->>'provider',
             'notification_id', new.id
           ))
    where not exists (
      select 1 from public.ngo_activity_history h
      where h.record_type = 'workspace_admin_notification_events'
        and h.record_id = new.id and h.action = 'email_sent'
    );
  elsif new.status = 'deadletter' then
    insert into public.controller_alerts
      (ngo_id, module, severity, message, context_json)
    values
      (v_ngo_id, 'system', 'warning',
       'Workspace approval email failed for ' || new.recipient_email ||
         '. IT should review delivery before resending.',
       jsonb_build_object('notification_id', new.id,
                          'recipient_email', new.recipient_email,
                          'last_error', new.last_error));

    insert into public.workspace_admin_notification_events
      (notification_kind, source_id, recipient_email, payload_json, dedupe_key)
    values
      ('approval_delivery_failed', new.id,
       'itsupport@humanitypathwaysglobal.com',
       jsonb_build_object('original_notification_id', new.id,
                          'recipient_email', new.recipient_email,
                          'ngo_name', v_ngo_name, 'full_name', v_full_name,
                          'last_error', new.last_error),
       'approval-delivery-failed:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.record_approval_notification_outcome() from public;

drop trigger if exists workspace_approval_notification_outcome on public.workspace_admin_notification_events;
create trigger workspace_approval_notification_outcome
after update of status on public.workspace_admin_notification_events
for each row execute function private.record_approval_notification_outcome();

-- The one approval already accepted before this workflow update is documented
-- in the organization's history without sending it a second time.
insert into public.crm_organizations
  (ngo_id, name, org_type, relationship_status, source_system, source_reference)
select distinct on (n.id) n.id, coalesce(n.common_name, n.legal_name),
       'partner', 'active', 'hpg_workspace', 'ngo:' || n.id
from public.workspace_admin_notification_events e
join public.ngo_portal_memberships m on m.id = e.source_id
join public.ngos n on n.id = m.ngo_id
where e.notification_kind = 'ngo_portal_approved' and e.status = 'sent'
on conflict (ngo_id) where ngo_id is not null do nothing;

insert into public.crm_interactions
  (organization_id, interaction_type, subject, description,
   interaction_date, external_key, direction, channel, outcome,
   status, follow_up_needed, evidence_source, evidence_strength,
   source_reference, date_precision)
select o.id, 'email',
       coalesce(nullif(e.response_json->>'subject', ''),
                'Your HPG Workspace portal account is approved'),
       coalesce(nullif(e.response_json->>'text', ''),
                'Portal approval email accepted for delivery to ' ||
                e.recipient_email ||
                '. Full text was not retained for this earlier send.'),
       coalesce(e.sent_at, e.created_at), 'workspace-approval-email:' || e.id,
       'outbound', 'email', 'provider_accepted', 'completed', false,
       'workspace_admin_notification_events', 6, e.id::text, 'exact'
from public.workspace_admin_notification_events e
join public.ngo_portal_memberships m on m.id = e.source_id
join public.crm_organizations o on o.ngo_id = m.ngo_id
where e.notification_kind = 'ngo_portal_approved' and e.status = 'sent'
on conflict (external_key) do nothing;

insert into public.ngo_activity_history
  (ngo_id, occurred_at, action, record_type, record_id,
   record_name, summary, details)
select m.ngo_id, coalesce(e.sent_at, e.created_at), 'email_sent',
       'workspace_admin_notification_events', e.id,
       coalesce(nullif(e.response_json->>'subject', ''),
                'Your HPG Workspace portal account is approved'),
       'Workspace portal approval email accepted for delivery to ' ||
         e.recipient_email,
       jsonb_strip_nulls(jsonb_build_object(
         'recipient_email', e.recipient_email,
         'subject', coalesce(nullif(e.response_json->>'subject', ''),
                             'Your HPG Workspace portal account is approved'),
         'body', nullif(e.response_json->>'text', ''),
         'provider', e.response_json->>'provider', 'notification_id', e.id))
from public.workspace_admin_notification_events e
join public.ngo_portal_memberships m on m.id = e.source_id
where e.notification_kind = 'ngo_portal_approved' and e.status = 'sent'
  and not exists (
    select 1 from public.ngo_activity_history h
    where h.record_type = 'workspace_admin_notification_events'
      and h.record_id = e.id and h.action = 'email_sent'
  );
