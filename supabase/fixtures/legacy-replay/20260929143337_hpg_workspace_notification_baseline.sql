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

-- Source-controlled notification triggers and Academy access checks expect
-- the profile lifecycle fields and active identity predicate from live HPG.
alter table public.profiles
  add column access_status text not null default 'active'
    constraint profiles_access_status_check check (access_status in ('active', 'deactivated')),
  add column deleted_at timestamptz;

create function private.workspace_actor_is_active(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles r on r.user_id=p.id and r.role::text=p.role
    where p.id=p_user_id and p.is_approved is true
      and lower(btrim(coalesce(p.approval_status,'')))='approved'
      and p.access_status='active'
  );
$$;
revoke all on function private.workspace_actor_is_active(uuid) from public, anon, authenticated;

create function public.current_session_has_privileged_aal2()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (
      auth.uid() is not null
      and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    );
$$;
revoke all on function public.current_session_has_privileged_aal2() from public, anon;
grant execute on function public.current_session_has_privileged_aal2() to authenticated, service_role;

create function public.current_workspace_identity_active()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.workspace_actor_is_active(auth.uid())
    and exists (
      select 1 from public.profiles p where p.id=auth.uid()
      and (p.role not in (
        'super_admin','admin_pm','vp_operations','vp_programs',
        'vp_development','vp_finance','vp_communications'
      ) or public.current_session_has_privileged_aal2())
    );
$$;
revoke all on function public.current_workspace_identity_active() from public, anon;
grant execute on function public.current_workspace_identity_active() to authenticated, service_role;

-- The live NGO activity ledger also predates its first checked-in usage.
-- Source: production pg_catalog table definition and NGO-scoped RLS policy.
create table if not exists public.ngo_activity_history (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id),
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  action text not null,
  record_type text not null,
  record_id uuid,
  record_name text,
  summary text not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists ngo_activity_history_lookup
  on public.ngo_activity_history(ngo_id,occurred_at desc);
alter table public.ngo_activity_history enable row level security;
revoke all on public.ngo_activity_history from public,anon,authenticated;
grant select on public.ngo_activity_history to authenticated;
grant all on public.ngo_activity_history to service_role;
create policy "HPG staff read NGO history"
  on public.ngo_activity_history for select to authenticated
  using (public.is_internal_user() or public.is_admin_user());

-- September approval notifications attach genuine correspondence to an NGO's
-- CRM organization. The full CRM enrichment was performed on live HPG
-- separately from the early source-controlled schema. Restore only the
-- columns needed for replay, as evidenced by the November 8 production catalog.
alter table public.crm_organizations
  add column if not exists ngo_id uuid references public.ngos(id) on delete cascade,
  add column if not exists relationship_status text not null default 'prospect',
  add column if not exists source_system text not null default 'manual',
  add column if not exists source_reference text;
create unique index if not exists crm_organizations_canonical_ngo_idx
  on public.crm_organizations(ngo_id) where ngo_id is not null;

alter table public.crm_interactions
  add column if not exists external_key text,
  add column if not exists direction text not null default 'internal',
  add column if not exists channel text,
  add column if not exists outcome text,
  add column if not exists status text not null default 'completed',
  add column if not exists follow_up_needed boolean not null default false,
  add column if not exists evidence_source text,
  add column if not exists evidence_strength smallint,
  add column if not exists source_reference text,
  add column if not exists date_precision text not null default 'day';
create unique index if not exists crm_interactions_external_key_unique
  on public.crm_interactions(external_key);

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
