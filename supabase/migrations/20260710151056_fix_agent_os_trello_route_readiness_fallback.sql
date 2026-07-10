-- Keep the Trello dry-run readiness view aligned with the live worker's
-- explicit-route and department/case fallback resolution.
-- This migration does not enable live Trello actions or create external cards.

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
  coalesce(r.department_module, q.payload->>'department_module') as department_module,
  coalesce(r.subdepartment_function, q.payload->>'subdepartment_function') as subdepartment_function,
  coalesce(r.case_type, q.payload->>'case_type') as case_type,
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
left join lateral (
  select candidate.*
  from public.trello_route_mappings candidate
  where (
    coalesce(q.route_key, q.payload->>'route_key') is not null
    and candidate.route_key = coalesce(q.route_key, q.payload->>'route_key')
  ) or (
    coalesce(q.route_key, q.payload->>'route_key') is null
    and candidate.department_module = q.payload->>'department_module'
    and candidate.operation = q.operation
    and (
      nullif(q.payload->>'case_type','') is null
      or candidate.case_type = q.payload->>'case_type'
      or candidate.case_type is null
    )
  )
  order by
    case when candidate.is_active then 0 else 1 end,
    case
      when candidate.case_type = q.payload->>'case_type' then 0
      when candidate.case_type is null then 1
      else 2
    end,
    candidate.created_at asc
  limit 1
) r on true;

grant select on public.agent_os_trello_route_readiness to authenticated;

comment on view public.agent_os_trello_route_readiness is
  'Dry-run Trello route readiness using the same explicit-route and department/case fallback rules as the Agent OS Trello worker.';
