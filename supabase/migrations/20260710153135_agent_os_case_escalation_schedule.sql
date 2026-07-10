-- HPG Agent OS case escalation schedule.
-- Creates internal escalation events only. It does not send email, Slack alerts,
-- Trello cards, or other external communications.

create table if not exists public.case_escalation_events (
  id uuid primary key default gen_random_uuid(),
  case_registry_id uuid not null references public.case_registry(id) on delete cascade,
  escalation_level text not null check (
    escalation_level in (
      'immediate_material_risk',
      'due_date_reminder',
      'director_1bd',
      'vp_3bd',
      'noemi_5bd',
      'ceo_10bd'
    )
  ),
  target_role text not null,
  status text not null default 'pending' check (
    status in ('pending', 'acknowledged', 'resolved', 'cancelled')
  ),
  is_material boolean not null default false,
  business_days_overdue integer not null default 0 check (business_days_overdue >= 0),
  due_at_snapshot timestamptz,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists case_escalation_events_cycle_unique
  on public.case_escalation_events(
    case_registry_id,
    escalation_level,
    coalesce(due_at_snapshot, '-infinity'::timestamptz)
  );

create index if not exists case_escalation_events_pending_idx
  on public.case_escalation_events(status, triggered_at)
  where status = 'pending';

create index if not exists case_escalation_events_case_idx
  on public.case_escalation_events(case_registry_id, triggered_at desc);

create or replace function public.agent_os_business_days_overdue(
  p_due_at timestamptz,
  p_as_of timestamptz default now()
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_due_at is null or p_as_of < p_due_at then 0
    else coalesce((
      select count(*)::integer
      from generate_series(
        (timezone('America/New_York', p_due_at)::date + 1),
        timezone('America/New_York', p_as_of)::date,
        interval '1 day'
      ) as day_value
      where extract(isodow from day_value) between 1 and 5
    ), 0)
  end;
$$;

create or replace function public.agent_os_process_overdue_escalations(
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.case_registry%rowtype;
  v_business_days integer;
  v_material boolean;
  v_immediate boolean;
  v_inserted integer;
  v_created integer := 0;
  v_existing integer := 0;
  v_cancelled integer := 0;
  v_due_snapshot timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to process Agent OS escalations';
  end if;

  update public.case_escalation_events e
     set status = 'cancelled',
         resolution_notes = coalesce(e.resolution_notes, 'Automatically cancelled because the case closed, was archived, or its due date changed.'),
         updated_at = p_as_of
    from public.case_registry c
   where e.case_registry_id = c.id
     and e.status = 'pending'
     and e.escalation_level <> 'immediate_material_risk'
     and (
       c.archived_at is not null
       or lower(coalesce(c.status, '')) in ('closed', 'completed', 'resolved', 'archived', 'cancelled')
       or c.due_at is null
       or e.due_at_snapshot is distinct from c.due_at
     );
  get diagnostics v_cancelled = row_count;

  for v_case in
    select c.*
      from public.case_registry c
     where c.archived_at is null
       and lower(coalesce(c.status, 'open')) not in ('closed', 'completed', 'resolved', 'archived', 'cancelled')
  loop
    v_material :=
      lower(coalesce(v_case.priority, '')) in ('high', 'urgent', 'critical')
      or v_case.risk_level in ('elevated', 'high')
      or lower(coalesce(v_case.metadata->>'material', 'false')) in ('true', '1', 'yes')
      or lower(coalesce(v_case.metadata->>'materiality', '')) in ('material', 'high');

    v_immediate :=
      lower(coalesce(v_case.priority, '')) in ('urgent', 'critical')
      or v_case.risk_level = 'high'
      or lower(coalesce(v_case.metadata->>'urgent_risk', 'false')) in ('true', '1', 'yes')
      or coalesce(v_case.metadata->'risk_domains', '[]'::jsonb) ?| array[
        'legal', 'financial', 'safeguarding', 'reputational', 'ngo_relationship', 'relationship', 'security'
      ];

    if v_immediate then
      v_due_snapshot := coalesce(v_case.due_at, date_trunc('day', v_case.created_at));
      insert into public.case_escalation_events(
        case_registry_id, escalation_level, target_role, is_material,
        business_days_overdue, due_at_snapshot, triggered_at, metadata
      ) values (
        v_case.id, 'immediate_material_risk', 'responsible_leadership_and_noemi', true,
        0, v_due_snapshot, p_as_of,
        jsonb_build_object(
          'reference_number', v_case.reference_number,
          'risk_level', v_case.risk_level,
          'priority', v_case.priority,
          'risk_domains', coalesce(v_case.metadata->'risk_domains', '[]'::jsonb),
          'dry_run_safe', true
        )
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;
    end if;

    if v_case.due_at is null or v_case.due_at > p_as_of then
      continue;
    end if;

    v_business_days := public.agent_os_business_days_overdue(v_case.due_at, p_as_of);
    v_due_snapshot := v_case.due_at;

    insert into public.case_escalation_events(
      case_registry_id, escalation_level, target_role, is_material,
      business_days_overdue, due_at_snapshot, triggered_at, metadata
    ) values (
      v_case.id, 'due_date_reminder', 'assignee', v_material,
      v_business_days, v_due_snapshot, p_as_of,
      jsonb_build_object('reference_number', v_case.reference_number, 'dry_run_safe', true)
    ) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;

    if v_business_days >= 1 then
      insert into public.case_escalation_events(
        case_registry_id, escalation_level, target_role, is_material,
        business_days_overdue, due_at_snapshot, triggered_at, metadata
      ) values (
        v_case.id, 'director_1bd', 'assignee_and_director', v_material,
        v_business_days, v_due_snapshot, p_as_of,
        jsonb_build_object('reference_number', v_case.reference_number, 'dry_run_safe', true)
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;
    end if;

    if v_business_days >= 3 then
      insert into public.case_escalation_events(
        case_registry_id, escalation_level, target_role, is_material,
        business_days_overdue, due_at_snapshot, triggered_at, metadata
      ) values (
        v_case.id, 'vp_3bd', 'department_vp', v_material,
        v_business_days, v_due_snapshot, p_as_of,
        jsonb_build_object('reference_number', v_case.reference_number, 'dry_run_safe', true)
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;
    end if;

    if v_business_days >= 5 then
      insert into public.case_escalation_events(
        case_registry_id, escalation_level, target_role, is_material,
        business_days_overdue, due_at_snapshot, triggered_at, metadata
      ) values (
        v_case.id, 'noemi_5bd', 'noemi_vale', v_material,
        v_business_days, v_due_snapshot, p_as_of,
        jsonb_build_object('reference_number', v_case.reference_number, 'dry_run_safe', true)
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;
    end if;

    if v_business_days >= 10 and v_material then
      insert into public.case_escalation_events(
        case_registry_id, escalation_level, target_role, is_material,
        business_days_overdue, due_at_snapshot, triggered_at, metadata
      ) values (
        v_case.id, 'ceo_10bd', 'ceo_executive_director', true,
        v_business_days, v_due_snapshot, p_as_of,
        jsonb_build_object('reference_number', v_case.reference_number, 'dry_run_safe', true)
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_created := v_created + 1; else v_existing := v_existing + 1; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'as_of', p_as_of,
    'created', v_created,
    'already_existing', v_existing,
    'cancelled_stale', v_cancelled
  );
end;
$$;

revoke all on function public.agent_os_process_overdue_escalations(timestamptz) from public;
grant execute on function public.agent_os_process_overdue_escalations(timestamptz) to authenticated, service_role;

alter table public.case_escalation_events enable row level security;

drop policy if exists "Internal users can read case escalation events" on public.case_escalation_events;
create policy "Internal users can read case escalation events"
  on public.case_escalation_events for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create case escalation events" on public.case_escalation_events;
create policy "Internal users can create case escalation events"
  on public.case_escalation_events for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update case escalation events" on public.case_escalation_events;
create policy "Internal users can update case escalation events"
  on public.case_escalation_events for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete case escalation events" on public.case_escalation_events;
create policy "Super admins can delete case escalation events"
  on public.case_escalation_events for delete to authenticated
  using ((select public.is_super_admin()));

grant select, insert, update on public.case_escalation_events to authenticated;
grant all on public.case_escalation_events to service_role;

drop trigger if exists case_escalation_events_set_updated_at on public.case_escalation_events;
create trigger case_escalation_events_set_updated_at
before update on public.case_escalation_events
for each row execute function public.agent_os_set_updated_at();

create or replace view public.agent_os_pending_escalations
with (security_invoker = true)
as
select
  e.id,
  e.case_registry_id,
  c.reference_number,
  c.case_type,
  c.organization_name,
  c.person_name,
  c.department_id,
  c.subdepartment_function,
  c.owner_user_id,
  c.supervisor_user_id,
  c.workflow_stage,
  c.priority,
  c.risk_level,
  c.due_at,
  e.escalation_level,
  e.target_role,
  e.is_material,
  e.business_days_overdue,
  e.triggered_at,
  e.metadata
from public.case_escalation_events e
join public.case_registry c on c.id = e.case_registry_id
where e.status = 'pending'
  and c.archived_at is null;

grant select on public.agent_os_pending_escalations to authenticated;

comment on table public.case_escalation_events is
  'Idempotent internal escalation events for due-date reminders, 1/3/5/10 business-day escalation, and immediate material risk.';
comment on function public.agent_os_process_overdue_escalations(timestamptz) is
  'Creates internal escalation events only; external delivery remains a separately authorized worker action.';
