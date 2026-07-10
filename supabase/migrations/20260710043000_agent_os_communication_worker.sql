-- Agent OS communication worker support
-- Adds atomic queue claims, retry scheduling, and stale-lock recovery.

alter table public.communication_queue
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

alter table public.communication_queue
  drop constraint if exists communication_queue_status_check;

alter table public.communication_queue
  add constraint communication_queue_status_check
  check (status in (
    'pending',
    'pending_review',
    'approved',
    'processing',
    'sent',
    'blocked',
    'failed',
    'cancelled'
  ));

create index if not exists communication_queue_worker_idx
  on public.communication_queue(status, next_attempt_at, created_at)
  where status in ('pending', 'approved', 'processing');

create or replace function public.claim_agent_os_communications(
  p_limit integer default 10,
  p_worker_id text default 'agent-os-communications'
)
returns setof public.communication_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required to claim Agent OS communications';
  end if;

  return query
  with candidates as (
    select q.id
    from public.communication_queue q
    where q.authority_level = 'automatic'
      and q.status in ('pending', 'approved')
      and (q.next_attempt_at is null or q.next_attempt_at <= now())
      and q.attempts < 3
    order by q.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.communication_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      last_attempt_at = now(),
      locked_at = now(),
      locked_by = coalesce(nullif(btrim(p_worker_id), ''), 'agent-os-communications'),
      updated_at = now()
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

revoke all on function public.claim_agent_os_communications(integer, text) from public, anon, authenticated;
grant execute on function public.claim_agent_os_communications(integer, text) to service_role;

create or replace function public.recover_stale_agent_os_communications(
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
    raise exception 'Service role is required to recover Agent OS communications';
  end if;

  with recovered as (
    update public.communication_queue q
    set status = case when q.attempts >= 3 then 'failed' else 'pending' end,
        next_attempt_at = case
          when q.attempts >= 3 then null
          else now() + interval '15 minutes'
        end,
        error_message = coalesce(q.error_message, 'Worker lock expired before completion.'),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where q.status = 'processing'
      and q.locked_at is not null
      and q.locked_at < now() - coalesce(p_lock_timeout, interval '15 minutes')
    returning q.id
  )
  select count(*) into v_count from recovered;

  return v_count;
end;
$$;

revoke all on function public.recover_stale_agent_os_communications(interval) from public, anon, authenticated;
grant execute on function public.recover_stale_agent_os_communications(interval) to service_role;

comment on function public.claim_agent_os_communications(integer, text)
  is 'Atomically claims only automatic Agent OS communications for a service-role worker.';
comment on function public.recover_stale_agent_os_communications(interval)
  is 'Releases stale communication worker locks or marks records failed after the third attempt.';
