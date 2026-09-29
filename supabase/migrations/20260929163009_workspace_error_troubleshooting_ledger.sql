-- Durable, private deduplication and results for the Gmail-triggered IT troubleshooter.
-- The model fields are required execution settings; the orchestrator must verify
-- the actual worker configuration before recording a result.
create table private.workspace_error_troubleshooting (
  notification_id uuid primary key
    references public.workspace_admin_notification_events(id) on delete cascade,
  error_event_id uuid not null unique
    references public.workspace_client_error_events(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'blocked')),
  model text not null default 'gpt-6-sol' check (model = 'gpt-6-sol'),
  reasoning_effort text not null default 'max' check (reasoning_effort = 'max'),
  attempt_count integer not null default 1 check (attempt_count > 0),
  lease_token uuid,
  lease_until timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  summary text check (char_length(summary) <= 4000),
  report_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(report_json) = 'object'
      and octet_length(report_json::text) <= 24000
      and report_json - array['evidence_refs', 'files', 'test_names',
        'test_results', 'next_steps', 'confidence', 'commit_sha']::text[] = '{}'::jsonb),
  constraint workspace_error_troubleshooting_lease_state check (
    (status = 'in_progress' and lease_token is not null and lease_until is not null
      and completed_at is null)
    or
    (status in ('completed', 'blocked') and lease_token is null and lease_until is null
      and completed_at is not null)
  )
);

comment on table private.workspace_error_troubleshooting is
  'Private IT troubleshooting ledger. Store sanitized conclusions and code/test references only; no credentials, personal data, raw messages, raw stacks, or log output.';

alter table private.workspace_error_troubleshooting enable row level security;
revoke all on table private.workspace_error_troubleshooting from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.workspace_error_troubleshooting to service_role;

create or replace function public.claim_workspace_error_troubleshooting(p_notification_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  notification public.workspace_admin_notification_events%rowtype;
  error_event public.workspace_client_error_events%rowtype;
  claimed private.workspace_error_troubleshooting%rowtype;
  existing_status text;
  claim_time timestamptz := clock_timestamp();
begin
  if current_user <> 'service_role'
    and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into notification from public.workspace_admin_notification_events
  where id = p_notification_id
    and notification_kind = 'workspace_error'
    and lower(recipient_email) = 'itsupport@humanitypathwaysglobal.com';
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_notification');
  end if;

  select * into error_event from public.workspace_client_error_events
  where id = notification.source_id;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_error_event');
  end if;

  insert into private.workspace_error_troubleshooting as ledger
    (notification_id, error_event_id, lease_token, lease_until, started_at, updated_at)
  values
    (notification.id, error_event.id, gen_random_uuid(), claim_time + interval '1 hour',
      claim_time, claim_time)
  on conflict (error_event_id) do update
    set lease_token = gen_random_uuid(), lease_until = claim_time + interval '1 hour',
        updated_at = claim_time, attempt_count = ledger.attempt_count + 1
    where ledger.status = 'in_progress' and ledger.lease_until <= claim_time
  returning * into claimed;

  if not found then
    select status into existing_status from private.workspace_error_troubleshooting
    where error_event_id = error_event.id;
    return jsonb_build_object('claimed', false,
      'reason', coalesce(existing_status, 'claim_unavailable'));
  end if;

  -- Return an explicit metadata allowlist, never notification payloads or user data.
  return jsonb_build_object(
    'claimed', true,
    'notification_id', claimed.notification_id,
    'error_event_id', claimed.error_event_id,
    'lease_token', claimed.lease_token,
    'lease_until', claimed.lease_until,
    'model', claimed.model,
    'reasoning_effort', claimed.reasoning_effort,
    'attempt_count', claimed.attempt_count,
    'error', jsonb_build_object(
      'correlation_id', error_event.correlation_id,
      'source', error_event.source,
      'route_key', error_event.route_key,
      'error_code', error_event.error_code,
      'release_id', error_event.release_id,
      'occurred_at', error_event.occurred_at,
      'client_occurred_at', error_event.client_occurred_at
    )
  );
end;
$$;

create or replace function public.finish_workspace_error_troubleshooting(
  p_notification_id uuid,
  p_lease_token uuid,
  p_status text,
  p_summary text,
  p_report_json jsonb,
  p_model text,
  p_reasoning_effort text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role'
    and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('completed', 'blocked') then
    raise exception 'Expected completed or blocked status' using errcode = '22023';
  end if;
  if p_model is distinct from 'gpt-6-sol' or p_reasoning_effort is distinct from 'max' then
    raise exception 'GPT-6 Sol with max reasoning is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_summary), '') is null or char_length(p_summary) > 4000 then
    raise exception 'A sanitized summary of 1 to 4000 characters is required' using errcode = '22023';
  end if;
  if p_report_json is null or jsonb_typeof(p_report_json) <> 'object'
    or octet_length(p_report_json::text) > 24000
    or p_report_json - array['evidence_refs', 'files', 'test_names',
      'test_results', 'next_steps', 'confidence', 'commit_sha']::text[] <> '{}'::jsonb then
    raise exception 'Report must contain only bounded, sanitized evidence fields' using errcode = '22023';
  end if;

  update private.workspace_error_troubleshooting
  set status = p_status, summary = btrim(p_summary), report_json = p_report_json,
      model = p_model, reasoning_effort = p_reasoning_effort,
      completed_at = clock_timestamp(), updated_at = clock_timestamp(),
      lease_token = null, lease_until = null
  where notification_id = p_notification_id and lease_token = p_lease_token
    and status = 'in_progress' and lease_until > clock_timestamp();
  return found;
end;
$$;

revoke all on function public.claim_workspace_error_troubleshooting(uuid) from public, anon, authenticated;
revoke all on function public.finish_workspace_error_troubleshooting(uuid, uuid, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_workspace_error_troubleshooting(uuid) to service_role;
grant execute on function public.finish_workspace_error_troubleshooting(uuid, uuid, text, text, jsonb, text, text)
  to service_role;

comment on function public.claim_workspace_error_troubleshooting(uuid) is
  'Claims one verified IT error notification for one hour; completed and blocked errors require an explicit operator decision before reprocessing.';
comment on function public.finish_workspace_error_troubleshooting(uuid, uuid, text, text, jsonb, text, text) is
  'Finishes a current troubleshooting lease. Model and effort are the required settings. Completed attests that the exact worker ran; blocked may record that it could not run, which the summary must state. Supply only sanitized findings and evidence references.';
