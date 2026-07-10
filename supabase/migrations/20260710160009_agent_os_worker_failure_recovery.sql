-- Agent OS worker failure and recovery controls.
-- Records retry attempts, stops a queue item after the third failure, and creates
-- an internal Technology recovery item. It does not send alerts or create an
-- external Trello card.

create table if not exists public.agent_os_worker_failure_attempts (
  id uuid primary key default gen_random_uuid(),
  queue_type text not null check (queue_type in ('communication','trello')),
  queue_item_id uuid not null,
  case_registry_id uuid references public.case_registry(id) on delete set null,
  responsible_department_id uuid references public.departments(id) on delete set null,
  attempt_number integer not null check (attempt_number >= 1),
  outcome text not null check (outcome in ('retry_scheduled','terminal_failure')),
  error_message text not null,
  diagnostics jsonb not null default '{}'::jsonb,
  next_attempt_at timestamptz,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(queue_type, queue_item_id, attempt_number)
);

create table if not exists public.agent_os_recovery_items (
  id uuid primary key default gen_random_uuid(),
  queue_type text not null check (queue_type in ('communication','trello')),
  queue_item_id uuid not null,
  case_registry_id uuid references public.case_registry(id) on delete set null,
  responsible_department_id uuid references public.departments(id) on delete set null,
  assigned_department_id uuid references public.departments(id) on delete set null,
  assigned_role text not null default 'Technology',
  status text not null default 'pending_technology_review' check (
    status in ('pending_technology_review','authorized_retry','restored','abandoned','cancelled')
  ),
  failure_count integer not null check (failure_count >= 3),
  last_error text not null,
  diagnostics jsonb not null default '{}'::jsonb,
  is_material boolean not null default false,
  notify_roles jsonb not null default '[]'::jsonb,
  technology_work_required boolean not null default true,
  technology_work_item_id uuid references public.work_items(id) on delete set null,
  authorized_by_name text,
  authorized_at timestamptz,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(queue_type, queue_item_id),
  check (jsonb_typeof(notify_roles) = 'array')
);

create index if not exists agent_os_worker_failure_attempts_item_idx
  on public.agent_os_worker_failure_attempts(queue_type, queue_item_id, attempt_number desc);

create index if not exists agent_os_recovery_items_pending_idx
  on public.agent_os_recovery_items(status, created_at)
  where status = 'pending_technology_review';

create index if not exists agent_os_recovery_items_case_idx
  on public.agent_os_recovery_items(case_registry_id, created_at desc);

create or replace function public.agent_os_record_worker_failure(
  p_queue_type text,
  p_queue_item_id uuid,
  p_error_message text,
  p_diagnostics jsonb default '{}'::jsonb,
  p_is_material boolean default false,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_attempts integer;
  v_attempt integer;
  v_case_registry_id uuid;
  v_department_id uuid;
  v_next_attempt_at timestamptz;
  v_outcome text;
  v_recovery_id uuid;
  v_notify_roles jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to record Agent OS worker failure';
  end if;

  if p_queue_type = 'communication' then
    select q.attempts, q.case_registry_id, q.department_id
      into v_current_attempts, v_case_registry_id, v_department_id
      from public.communication_queue q
     where q.id = p_queue_item_id
     for update;
  elsif p_queue_type = 'trello' then
    select q.attempts, q.case_registry_id, c.department_id
      into v_current_attempts, v_case_registry_id, v_department_id
      from public.trello_sync_queue q
      left join public.case_registry c on c.id = q.case_registry_id
     where q.id = p_queue_item_id
     for update;
  else
    raise exception 'Unsupported queue type: %', p_queue_type;
  end if;

  if v_current_attempts is null then
    raise exception 'Queue item not found';
  end if;

  v_attempt := v_current_attempts + 1;

  if v_attempt = 1 then
    v_next_attempt_at := p_occurred_at + interval '5 minutes';
    v_outcome := 'retry_scheduled';
  elsif v_attempt = 2 then
    v_next_attempt_at := p_occurred_at + interval '30 minutes';
    v_outcome := 'retry_scheduled';
  else
    v_next_attempt_at := null;
    v_outcome := 'terminal_failure';
  end if;

  if p_queue_type = 'communication' then
    update public.communication_queue
       set attempts = v_attempt,
           last_attempt_at = p_occurred_at,
           error_message = p_error_message,
           next_attempt_at = v_next_attempt_at,
           status = case when v_outcome = 'terminal_failure' then 'failed' else 'pending' end,
           locked_at = null,
           locked_by = null,
           updated_at = p_occurred_at
     where id = p_queue_item_id;
  else
    update public.trello_sync_queue
       set attempts = v_attempt,
           last_attempt_at = p_occurred_at,
           error_message = p_error_message,
           next_attempt_at = v_next_attempt_at,
           status = case when v_outcome = 'terminal_failure' then 'failed' else 'pending' end,
           locked_at = null,
           locked_by = null,
           updated_at = p_occurred_at
     where id = p_queue_item_id;
  end if;

  insert into public.agent_os_worker_failure_attempts(
    queue_type, queue_item_id, case_registry_id, responsible_department_id,
    attempt_number, outcome, error_message, diagnostics, next_attempt_at, occurred_at
  ) values (
    p_queue_type, p_queue_item_id, v_case_registry_id, v_department_id,
    v_attempt, v_outcome, p_error_message, coalesce(p_diagnostics, '{}'::jsonb),
    v_next_attempt_at, p_occurred_at
  ) on conflict (queue_type, queue_item_id, attempt_number) do nothing;

  if v_outcome = 'terminal_failure' then
    v_notify_roles := case when p_is_material then
      jsonb_build_array('responsible_department','technology','noemi_vale')
    else
      jsonb_build_array('responsible_department','technology')
    end;

    insert into public.agent_os_recovery_items(
      queue_type, queue_item_id, case_registry_id, responsible_department_id,
      assigned_department_id, assigned_role, status, failure_count, last_error,
      diagnostics, is_material, notify_roles, technology_work_required
    ) values (
      p_queue_type, p_queue_item_id, v_case_registry_id, v_department_id,
      public.agent_os_department_id('technology'), 'Technology',
      'pending_technology_review', v_attempt, p_error_message,
      coalesce(p_diagnostics, '{}'::jsonb), p_is_material, v_notify_roles, true
    )
    on conflict (queue_type, queue_item_id) do update set
      failure_count = excluded.failure_count,
      last_error = excluded.last_error,
      diagnostics = public.agent_os_recovery_items.diagnostics || excluded.diagnostics,
      is_material = excluded.is_material,
      notify_roles = excluded.notify_roles,
      status = case
        when public.agent_os_recovery_items.status in ('restored','abandoned','cancelled')
          then 'pending_technology_review'
        else public.agent_os_recovery_items.status
      end,
      updated_at = p_occurred_at
    returning id into v_recovery_id;
  end if;

  return jsonb_build_object(
    'queue_type', p_queue_type,
    'queue_item_id', p_queue_item_id,
    'attempt_number', v_attempt,
    'outcome', v_outcome,
    'next_attempt_at', v_next_attempt_at,
    'recovery_item_id', v_recovery_id
  );
end;
$$;

create or replace function public.agent_os_authorize_worker_recovery(
  p_recovery_item_id uuid,
  p_authorized_by_name text,
  p_resolution_notes text default null,
  p_authorized_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.agent_os_recovery_items%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
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
    raise exception 'Recovery item not found';
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

revoke all on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz) from public;
grant execute on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz) to authenticated, service_role;
revoke all on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz) from public;
grant execute on function public.agent_os_authorize_worker_recovery(uuid,text,text,timestamptz) to authenticated, service_role;

alter table public.agent_os_worker_failure_attempts enable row level security;
alter table public.agent_os_recovery_items enable row level security;

drop policy if exists "Internal users can read worker failure attempts" on public.agent_os_worker_failure_attempts;
create policy "Internal users can read worker failure attempts"
  on public.agent_os_worker_failure_attempts for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create worker failure attempts" on public.agent_os_worker_failure_attempts;
create policy "Internal users can create worker failure attempts"
  on public.agent_os_worker_failure_attempts for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can read recovery items" on public.agent_os_recovery_items;
create policy "Internal users can read recovery items"
  on public.agent_os_recovery_items for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Technology can update recovery items" on public.agent_os_recovery_items;
create policy "Technology can update recovery items"
  on public.agent_os_recovery_items for update to authenticated
  using (
    (select public.is_super_admin())
    or (select public.get_my_department()) = (select public.agent_os_department_id('technology'))
  )
  with check (
    (select public.is_super_admin())
    or (select public.get_my_department()) = (select public.agent_os_department_id('technology'))
  );

grant select, insert on public.agent_os_worker_failure_attempts to authenticated;
grant select, update on public.agent_os_recovery_items to authenticated;
grant all on public.agent_os_worker_failure_attempts to service_role;
grant all on public.agent_os_recovery_items to service_role;

drop trigger if exists agent_os_recovery_items_set_updated_at on public.agent_os_recovery_items;
create trigger agent_os_recovery_items_set_updated_at
before update on public.agent_os_recovery_items
for each row execute function public.agent_os_set_updated_at();

create or replace view public.agent_os_recovery_queue
with (security_invoker = true)
as
select
  r.id,
  r.queue_type,
  r.queue_item_id,
  r.case_registry_id,
  c.reference_number,
  c.case_type,
  c.organization_name,
  c.person_name,
  r.responsible_department_id,
  r.assigned_department_id,
  r.assigned_role,
  r.status,
  r.failure_count,
  r.last_error,
  r.diagnostics,
  r.is_material,
  r.notify_roles,
  r.technology_work_required,
  r.technology_work_item_id,
  r.created_at,
  r.updated_at
from public.agent_os_recovery_items r
left join public.case_registry c on c.id = r.case_registry_id
where r.status in ('pending_technology_review','authorized_retry');

grant select on public.agent_os_recovery_queue to authenticated;

comment on table public.agent_os_recovery_items is
  'Internal recovery queue after terminal communication or Trello worker failure; external alerts and Technology work-card creation remain separate authorized actions.';
comment on function public.agent_os_record_worker_failure(text,uuid,text,jsonb,boolean,timestamptz) is
  'Schedules first and second retries, stops the item at the third failure, and creates an internal Technology recovery item.';
