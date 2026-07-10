-- Harden worker recovery authorization by evaluating the caller under
-- SECURITY INVOKER. This prevents SECURITY DEFINER execution context from
-- being mistaken for service-role authorization.

create or replace function public.agent_os_authorize_worker_recovery(
  p_recovery_item_id uuid,
  p_authorized_by_name text,
  p_resolution_notes text default null,
  p_authorized_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.agent_os_recovery_items%rowtype;
begin
  if current_user <> 'service_role'
     and not public.is_super_admin()
     and public.get_my_department() is distinct from public.agent_os_department_id('technology') then
    raise exception 'Technology or super-administrator authorization is required';
  end if;

  if nullif(btrim(coalesce(p_authorized_by_name,'')), '') is null then
    raise exception 'Authorized-by name is required';
  end if;

  select * into v_item
  from public.agent_os_recovery_items
  where id = p_recovery_item_id
  for update;

  if not found then
    raise exception 'Recovery item not found or not visible to the caller';
  end if;

  if v_item.status <> 'pending_technology_review' then
    raise exception 'Recovery item is not awaiting Technology review';
  end if;

  update public.agent_os_recovery_items
     set status = 'authorized_retry',
         authorized_by_name = btrim(p_authorized_by_name),
         authorized_at = p_authorized_at,
         resolution_notes = p_resolution_notes,
         updated_at = p_authorized_at
   where id = p_recovery_item_id;

  if v_item.queue_type = 'communication' then
    update public.communication_queue
       set attempts = 0,
           status = 'pending',
           next_attempt_at = p_authorized_at,
           error_message = null,
           locked_at = null,
           locked_by = null,
           updated_at = p_authorized_at
     where id = v_item.queue_item_id;
  else
    update public.trello_sync_queue
       set attempts = 0,
           status = 'pending',
           next_attempt_at = p_authorized_at,
           error_message = null,
           locked_at = null,
           locked_by = null,
           updated_at = p_authorized_at
     where id = v_item.queue_item_id;
  end if;

  return jsonb_build_object(
    'recovery_item_id', p_recovery_item_id,
    'status', 'authorized_retry',
    'queue_item_id', v_item.queue_item_id,
    'authorized_at', p_authorized_at
  );
end;
$$;

revoke all on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz) from public;
grant execute on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz) to authenticated, service_role;

comment on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz) is
  'Authorizes a stopped worker item for retry under caller permissions; only Technology, super administrators, or service role may proceed.';
