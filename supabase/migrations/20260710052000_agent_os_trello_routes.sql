-- Agent OS Trello route mappings and queue claims.
-- No live Trello action occurs until mappings, credentials, and live gates are configured.

create table if not exists public.trello_route_mappings (
  id uuid primary key default gen_random_uuid(),
  route_key text not null unique,
  department_module text not null,
  subdepartment_function text,
  case_type text,
  operation text not null default 'create_card',
  workspace_id text,
  board_id text not null,
  list_id text not null,
  template_card_id text,
  default_labels jsonb not null default '[]'::jsonb,
  default_members jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trello_route_mappings_lookup_idx
  on public.trello_route_mappings(department_module, case_type, subdepartment_function)
  where is_active is true;

drop trigger if exists trello_route_mappings_set_updated_at on public.trello_route_mappings;
create trigger trello_route_mappings_set_updated_at
before update on public.trello_route_mappings
for each row execute function public.agent_os_set_updated_at();

alter table public.trello_sync_queue
  add column if not exists route_key text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists external_object_id text,
  add column if not exists external_object_url text;

create index if not exists trello_sync_queue_worker_idx
  on public.trello_sync_queue(status, next_attempt_at, created_at)
  where status in ('pending','processing');

create or replace function public.claim_agent_os_trello_sync(
  p_limit integer default 10,
  p_worker_id text default 'agent-os-trello-sync'
)
returns setof public.trello_sync_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required to claim Trello synchronization work';
  end if;

  return query
  with candidates as (
    select q.id
    from public.trello_sync_queue q
    where q.status = 'pending'
      and (q.next_attempt_at is null or q.next_attempt_at <= now())
      and q.attempts < 3
    order by q.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,10),50))
  )
  update public.trello_sync_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      last_attempt_at = now(),
      locked_at = now(),
      locked_by = coalesce(nullif(btrim(p_worker_id),''),'agent-os-trello-sync'),
      updated_at = now()
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

revoke all on function public.claim_agent_os_trello_sync(integer,text) from public, anon, authenticated;
grant execute on function public.claim_agent_os_trello_sync(integer,text) to service_role;

create or replace function public.recover_stale_agent_os_trello_sync(
  p_lock_timeout interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required to recover Trello synchronization work';
  end if;

  with recovered as (
    update public.trello_sync_queue q
    set status = case when q.attempts >= 3 then 'failed' else 'pending' end,
        next_attempt_at = case when q.attempts >= 3 then null else now() + interval '15 minutes' end,
        error_message = coalesce(q.error_message,'Worker lock expired before completion.'),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where q.status = 'processing'
      and q.locked_at is not null
      and q.locked_at < now() - coalesce(p_lock_timeout,interval '15 minutes')
    returning q.id
  )
  select count(*) into v_count from recovered;

  return v_count;
end;
$$;

revoke all on function public.recover_stale_agent_os_trello_sync(interval) from public, anon, authenticated;
grant execute on function public.recover_stale_agent_os_trello_sync(interval) to service_role;

alter table public.trello_route_mappings enable row level security;

create policy "Internal users can read Trello route mappings"
  on public.trello_route_mappings for select to authenticated
  using (public.is_internal_user());
create policy "Super admins can manage Trello route mappings"
  on public.trello_route_mappings for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.trello_route_mappings to authenticated;
grant all on public.trello_route_mappings to service_role;

create or replace view public.agent_os_trello_route_readiness
with (security_invoker = true)
as
select
  q.id as queue_id,
  q.case_registry_id,
  q.operation,
  q.status,
  q.attempts,
  q.route_key,
  q.created_at,
  q.next_attempt_at,
  coalesce(q.route_key, q.payload->>'route_key') as requested_route_key,
  r.id as route_mapping_id,
  r.department_module,
  r.subdepartment_function,
  r.case_type,
  r.board_id,
  r.list_id,
  r.template_card_id,
  r.is_active,
  case
    when r.id is null then 'mapping_required'
    when not r.is_active then 'mapping_inactive'
    when r.board_id is null or r.list_id is null then 'mapping_incomplete'
    else 'ready'
  end as route_readiness
from public.trello_sync_queue q
left join public.trello_route_mappings r
  on r.route_key = coalesce(q.route_key, q.payload->>'route_key');

grant select on public.agent_os_trello_route_readiness to authenticated;

comment on table public.trello_route_mappings
  is 'Approved mapping from HPG department functions and case types to existing Trello workspaces, boards, lists, and template cards.';
comment on function public.claim_agent_os_trello_sync(integer,text)
  is 'Atomically claims pending Trello sync work for a service-role worker.';
