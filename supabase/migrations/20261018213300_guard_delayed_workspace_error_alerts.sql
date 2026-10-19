-- HPG Workspace: prevent stale client-error replay and repetitive IT emails.
-- Every client error remains in public.workspace_client_error_events for diagnostics.
-- Only recent, distinct error categories enqueue IT notifications.
--
-- The previous notification trigger used each event UUID as its dedupe key,
-- which guaranteed one email per event (including historic replays).
-- This uses a 30-minute window and a stable event category instead.
--
-- Do not change the processing rules for approvals, access requests, or
-- other notification kinds.

create or replace function private.queue_workspace_client_error_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dedupe_key text;
begin
  -- The client may submit buffered September errors during an October login.
  -- Keep these errors in the diagnostic ledger, but do not label them as
  -- current incidents or enqueue individual IT emails.
  if new.client_occurred_at is not null
     and new.client_occurred_at < new.occurred_at - interval '24 hours'
  then
    return new;
  end if;

  -- Alert at most once per affected user, route, source, error code and
  -- 30-minute server-time bucket, even under simultaneous submissions.
  -- Unique(dedupe_key) enforces concurrency-safe grouping.
  v_dedupe_key := concat(
    'workspace-error-v2:', new.actor_user_id::text, ':',
    new.route_key, ':', new.source, ':', new.error_code, ':',
    floor(extract(epoch from new.occurred_at) / 1800)::text
  );

  insert into public.workspace_admin_notification_events (
    notification_kind,
    source_id,
    recipient_email,
    payload_json,
    dedupe_key
  )
  values (
    'workspace_error',
    new.id,
    'itsupport@humanitypathwaysglobal.com',
    pg_catalog.jsonb_build_object(
      'event_id', new.id,
      'actor_user_id', new.actor_user_id,
      'correlation_id', new.correlation_id,
      'source', new.source,
      'route_key', new.route_key,
      'error_code', new.error_code,
      'release_id', new.release_id,
      'occurred_at', new.occurred_at,
      'client_occurred_at', new.client_occurred_at,
      'workspace_path', '/it'
    ),
    v_dedupe_key
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;
