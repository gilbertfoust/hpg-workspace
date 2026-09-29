-- A fresh staff approval must not automatically send while a prior approval
-- may already have reached the applicant but lacks a recorded acknowledgement.
-- Staff can reconcile the earlier delivery and explicitly release or resend the
-- held notice. Recording delivery_reconciled_at on the earlier event removes
-- that event from the guard for later, intentional approval transitions.
create or replace function private.queue_workspace_account_approval_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ambiguous boolean;
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

  -- This includes an in-flight IT Gmail send and a legacy direct send. Both
  -- outcomes are uncertain once sending has started, even if the lease ends.
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

  select exists (
    select 1 from public.workspace_admin_notification_events e
    where e.notification_kind = 'workspace_account_approved'
      and e.source_id = new.id and e.status = 'deadletter'
      and nullif(btrim(e.response_json->>'delivery_reconciled_at'), '') is null
      and (
        e.response_json->>'it_send_started' = 'true'
        or (e.response_json->>'send_started' = 'true'
            and coalesce(e.response_json->>'send_stage', '') <> 'it_wakeup')
        or e.response_json->>'acknowledgement_uncertain' = 'true'
      )
  ) into v_ambiguous;

  insert into public.workspace_admin_notification_events
    (notification_kind, source_id, recipient_email, payload_json, dedupe_key,
     status, response_json, last_error)
  values
    ('workspace_account_approved', new.id, v_email,
     jsonb_build_object('user_id', new.id, 'role', new.role),
     'workspace-account-approved:' || new.id || ':' || new.updated_at,
     case when v_ambiguous then 'deadletter' else 'queued' end,
     case when v_ambiguous then jsonb_build_object('blocked_by_prior_delivery', true)
          else '{}'::jsonb end,
     case when v_ambiguous then
       'Held pending reconciliation of earlier account approval delivery'
       else null end);
  return new;
end;
$$;

revoke all on function private.queue_workspace_account_approval_notice()
  from public, anon, authenticated;
