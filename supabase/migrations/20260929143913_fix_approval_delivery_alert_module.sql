-- Correct the alert module name accepted by validate_controller_alert().
CREATE OR REPLACE FUNCTION private.record_approval_notification_outcome()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
