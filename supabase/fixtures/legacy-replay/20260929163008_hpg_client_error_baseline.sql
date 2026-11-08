-- CI ONLY: legacy HPG client-error ledger as it existed in production.
-- The September 29 IT remediation migration references this table through a
-- foreign key but Git history did not retain its original CREATE TABLE.
-- Derived from November 8 PostgreSQL catalog metadata: no real events copied.

create table if not exists public.workspace_client_error_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  client_event_id uuid not null,
  correlation_id uuid not null,
  source text not null,
  route_key text not null,
  error_code text not null,
  release_id text not null,
  client_occurred_at timestamptz,
  occurred_at timestamptz not null default now(),
  unique(actor_user_id,client_event_id)
);
create index if not exists workspace_client_error_actor_time
  on public.workspace_client_error_events(actor_user_id,occurred_at desc);
alter table public.workspace_client_error_events enable row level security;
revoke all on public.workspace_client_error_events
  from public,anon,authenticated;
grant all on public.workspace_client_error_events to service_role;

-- Reproduce the live management-only read boundary only when its auth
-- predicates already exist at this historical point.
do $policy$
begin
  if to_regprocedure('public.current_workspace_identity_active()') is not null
     and to_regprocedure('public.is_management()') is not null then
    execute $def$
      create policy management_error_read on public.workspace_client_error_events
      for select to authenticated
      using (public.current_workspace_identity_active() and public.is_management())
    $def$;
    grant select on public.workspace_client_error_events to authenticated;
  end if;
end
$policy$;
