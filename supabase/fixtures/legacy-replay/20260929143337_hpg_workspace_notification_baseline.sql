-- CI-ONLY HISTORICAL BASELINE SNAPSHOT: original Workspace notification queue.
--
-- The public.workspace_admin_notification_events table is present in the
-- live project but its creation was not preserved in the Git migration chain.
-- Reconstructed from pg_catalog metadata on 2026-11-08.
--
-- This fixture is inserted only in disposable CI replay, immediately before
-- 20260929143338_workspace_account_approval_notifications.sql.
-- The later migrations may adjust notification_kind/status constraints.
-- No email is queued or sent by this script; the queue starts empty.

-- The production project also has this private backend function namespace.
-- It was provisioned outside migration history, and Sep 29 creates functions
-- there. A schema grant alone never authorizes calling an RPC.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated,service_role;

create table if not exists public.workspace_admin_notification_events (
  id uuid primary key default gen_random_uuid(),
  notification_kind text not null,
  source_id uuid not null,
  recipient_email text not null,
  payload_json jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'queued',
  attempt_count integer not null default 0
    constraint workspace_admin_notification_events_attempt_count_check
      check (attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  response_json jsonb not null default '{}'::jsonb,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_admin_notification_events_notification_kind_check
    check (notification_kind in (
      'workspace_error','workspace_access_request','work_item_notice',
      'ngo_portal_approved'
    )),
  constraint workspace_admin_notification_events_status_check
    check (status in(
      'queued','leased','retry','sent','deadletter','cancelled'
    ))
);

create index if not exists workspace_admin_notifications_queue_idx
  on public.workspace_admin_notification_events(status,next_attempt_at,created_at)
  where status in ('queued','retry');

alter table public.workspace_admin_notification_events enable row level security;
revoke all on public.workspace_admin_notification_events
  from public,anon,authenticated;
grant all on public.workspace_admin_notification_events to service_role;
