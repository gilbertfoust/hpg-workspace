-- HPG Agent OS runtime foundation
-- Defines the permanent case registry, workflow history, agent runs,
-- controlled communications, and Trello synchronization queues.
-- This migration does not activate external connectors or send communications.

create table if not exists public.case_reference_counters (
  counter_key text primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

revoke all on table public.case_reference_counters from anon, authenticated;

create or replace function public.next_hpg_reference_number(p_case_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year text := to_char(current_date, 'YYYY');
  v_counter_key text;
  v_next bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to generate an HPG reference number';
  end if;

  v_prefix := case lower(coalesce(p_case_type, ''))
    when 'sponsorship' then 'NGO'
    when 'ngo' then 'NGO'
    when 'ngo_inquiry' then 'NGO'
    when 'volunteer' then 'VOL'
    when 'board' then 'BRD'
    when 'it_support' then 'IT'
    when 'finance' then 'FIN'
    when 'administration' then 'ADM'
    else 'CASE'
  end;

  v_counter_key := v_prefix || '-' || v_year;

  insert into public.case_reference_counters(counter_key, last_value, updated_at)
  values (v_counter_key, 1, now())
  on conflict (counter_key)
  do update set last_value = public.case_reference_counters.last_value + 1,
                updated_at = now()
  returning last_value into v_next;

  return v_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.next_hpg_reference_number(text) from public;
grant execute on function public.next_hpg_reference_number(text) to authenticated, service_role;

create table if not exists public.case_registry (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  case_type text not null,
  source_system text,
  source_table text,
  source_record_id text,
  source_event_id text,
  ngo_id uuid references public.ngos(id) on delete set null,
  person_name text,
  organization_name text,
  primary_email text,
  department_id uuid references public.departments(id) on delete set null,
  subdepartment_function text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  supervisor_user_id uuid references public.profiles(id) on delete set null,
  workflow_stage text not null default 'new_intake',
  status text not null default 'open',
  priority text not null default 'routine',
  risk_level text not null default 'insufficient_information'
    check (risk_level in ('low', 'moderate', 'elevated', 'high', 'insufficient_information')),
  match_confidence text not null default 'unknown'
    check (match_confidence in ('high', 'moderate', 'low', 'unknown')),
  approval_required boolean not null default false,
  external_visible boolean not null default false,
  drive_folder_id text,
  drive_folder_url text,
  trello_workspace_id text,
  trello_board_id text,
  trello_list_id text,
  trello_card_id text,
  gmail_thread_id text,
  confluence_url text,
  next_action text,
  due_at timestamptz,
  unmatched_reason text,
  last_agent_run_at timestamptz,
  last_human_review_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists case_registry_source_record_unique
  on public.case_registry(source_table, source_record_id)
  where source_table is not null and source_record_id is not null;
create index if not exists case_registry_ngo_idx on public.case_registry(ngo_id);
create index if not exists case_registry_department_idx on public.case_registry(department_id);
create index if not exists case_registry_owner_idx on public.case_registry(owner_user_id);
create index if not exists case_registry_stage_status_idx on public.case_registry(workflow_stage, status);
create index if not exists case_registry_due_idx on public.case_registry(due_at) where archived_at is null;
create index if not exists case_registry_unmatched_idx on public.case_registry(match_confidence, status)
  where match_confidence = 'low' or unmatched_reason is not null;

create or replace function public.agent_os_assign_reference_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference_number is null or btrim(new.reference_number) = '' then
    new.reference_number := public.next_hpg_reference_number(new.case_type);
  end if;
  return new;
end;
$$;

create or replace function public.agent_os_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists case_registry_assign_reference_number on public.case_registry;
create trigger case_registry_assign_reference_number
before insert on public.case_registry
for each row execute function public.agent_os_assign_reference_number();

drop trigger if exists case_registry_set_updated_at on public.case_registry;
create trigger case_registry_set_updated_at
before update on public.case_registry
for each row execute function public.agent_os_set_updated_at();

create table if not exists public.case_stage_history (
  id uuid primary key default gen_random_uuid(),
  case_registry_id uuid not null references public.case_registry(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  from_status text,
  to_status text,
  reason text,
  changed_by_user_id uuid references public.profiles(id) on delete set null,
  changed_by_agent text,
  approval_id uuid references public.approvals(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_stage_history_case_idx
  on public.case_stage_history(case_registry_id, created_at desc);

create or replace function public.agent_os_record_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_stage is distinct from old.workflow_stage
     or new.status is distinct from old.status then
    insert into public.case_stage_history(
      case_registry_id, from_stage, to_stage, from_status, to_status,
      reason, changed_by_user_id, evidence
    ) values (
      new.id, old.workflow_stage, new.workflow_stage, old.status, new.status,
      'case_registry_update', auth.uid(),
      jsonb_build_object('updated_at', now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists case_registry_stage_history on public.case_registry;
create trigger case_registry_stage_history
after update on public.case_registry
for each row execute function public.agent_os_record_stage_change();

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text unique,
  agent_name text not null,
  agent_role text,
  department_id uuid references public.departments(id) on delete set null,
  case_registry_id uuid references public.case_registry(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  trigger_type text not null,
  source_event_id text,
  status text not null default 'running',
  confidence text not null default 'unknown'
    check (confidence in ('high', 'moderate', 'low', 'unknown')),
  systems_consulted jsonb not null default '[]'::jsonb,
  sources_used jsonb not null default '[]'::jsonb,
  action_attempted text,
  approval_required boolean not null default false,
  approval_id uuid references public.approvals(id) on delete set null,
  communication_status text,
  records_changed jsonb not null default '[]'::jsonb,
  result_summary text,
  error_detail text,
  retry_count integer not null default 0 check (retry_count >= 0),
  supervisor_user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_case_idx on public.agent_runs(case_registry_id, started_at desc);
create index if not exists agent_runs_status_idx on public.agent_runs(status, started_at desc);
create index if not exists agent_runs_source_event_idx on public.agent_runs(source_event_id)
  where source_event_id is not null;

create table if not exists public.communication_queue (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  case_registry_id uuid references public.case_registry(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  communication_type text not null,
  authority_level text not null
    check (authority_level in ('automatic', 'draft_for_review', 'human_only')),
  channel text not null default 'email',
  recipient_name text,
  recipient_address text,
  subject text,
  body text,
  status text not null default 'pending'
    check (status in ('pending', 'pending_review', 'approved', 'sent', 'blocked', 'failed', 'cancelled')),
  requires_human_review boolean not null default false,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  external_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  error_message text,
  source_context jsonb not null default '{}'::jsonb,
  created_by_agent text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communication_queue_status_idx
  on public.communication_queue(status, created_at);
create index if not exists communication_queue_case_idx
  on public.communication_queue(case_registry_id, created_at desc);

drop trigger if exists communication_queue_set_updated_at on public.communication_queue;
create trigger communication_queue_set_updated_at
before update on public.communication_queue
for each row execute function public.agent_os_set_updated_at();

create table if not exists public.trello_sync_queue (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  case_registry_id uuid references public.case_registry(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  direction text not null default 'supabase_to_trello'
    check (direction in ('supabase_to_trello', 'trello_to_supabase')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'blocked', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trello_sync_queue_status_idx
  on public.trello_sync_queue(status, next_attempt_at, created_at);
create index if not exists trello_sync_queue_case_idx
  on public.trello_sync_queue(case_registry_id, created_at desc);

drop trigger if exists trello_sync_queue_set_updated_at on public.trello_sync_queue;
create trigger trello_sync_queue_set_updated_at
before update on public.trello_sync_queue
for each row execute function public.agent_os_set_updated_at();

alter table public.work_items
  add column if not exists case_registry_id uuid references public.case_registry(id) on delete set null,
  add column if not exists hpg_reference_number text,
  add column if not exists workflow_stage text,
  add column if not exists supervisor_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists source_system text,
  add column if not exists source_event_id text,
  add column if not exists match_confidence text,
  add column if not exists risk_level text,
  add column if not exists next_action text,
  add column if not exists trello_workspace_id text,
  add column if not exists trello_board_id text,
  add column if not exists trello_list_id text,
  add column if not exists last_agent_run_at timestamptz;

create index if not exists work_items_case_registry_idx on public.work_items(case_registry_id);
create index if not exists work_items_reference_idx on public.work_items(hpg_reference_number)
  where hpg_reference_number is not null;
create index if not exists work_items_source_event_idx on public.work_items(source_event_id)
  where source_event_id is not null;

alter table public.ngos
  add column if not exists hpg_profile_number text,
  add column if not exists master_drive_folder_id text,
  add column if not exists master_drive_folder_url text,
  add column if not exists activated_at timestamptz,
  add column if not exists confirmation_letter_issued_at timestamptz,
  add column if not exists onboarding_fee_verified_at timestamptz;

create unique index if not exists ngos_hpg_profile_number_unique
  on public.ngos(hpg_profile_number)
  where hpg_profile_number is not null;

alter table public.case_registry enable row level security;
alter table public.case_stage_history enable row level security;
alter table public.agent_runs enable row level security;
alter table public.communication_queue enable row level security;
alter table public.trello_sync_queue enable row level security;
alter table public.case_reference_counters enable row level security;

create policy "Internal users can read Agent OS cases"
  on public.case_registry for select to authenticated
  using (public.is_internal_user());
create policy "Internal users can create Agent OS cases"
  on public.case_registry for insert to authenticated
  with check (public.is_internal_user());
create policy "Internal users can update Agent OS cases"
  on public.case_registry for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Super admins can delete Agent OS cases"
  on public.case_registry for delete to authenticated
  using (public.is_super_admin());

create policy "Internal users can read case stage history"
  on public.case_stage_history for select to authenticated
  using (public.is_internal_user());
create policy "Internal users can create case stage history"
  on public.case_stage_history for insert to authenticated
  with check (public.is_internal_user());

create policy "Internal users can read agent runs"
  on public.agent_runs for select to authenticated
  using (public.is_internal_user());
create policy "Internal users can create agent runs"
  on public.agent_runs for insert to authenticated
  with check (public.is_internal_user());
create policy "Internal users can update agent runs"
  on public.agent_runs for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

create policy "Internal users can read communication queue"
  on public.communication_queue for select to authenticated
  using (public.is_internal_user());
create policy "Internal users can create communication queue"
  on public.communication_queue for insert to authenticated
  with check (public.is_internal_user());
create policy "Internal users can update communication queue"
  on public.communication_queue for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Super admins can delete communication queue records"
  on public.communication_queue for delete to authenticated
  using (public.is_super_admin());

create policy "Internal users can read Trello sync queue"
  on public.trello_sync_queue for select to authenticated
  using (public.is_internal_user());
create policy "Internal users can create Trello sync queue"
  on public.trello_sync_queue for insert to authenticated
  with check (public.is_internal_user());
create policy "Internal users can update Trello sync queue"
  on public.trello_sync_queue for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());
create policy "Super admins can delete Trello sync queue records"
  on public.trello_sync_queue for delete to authenticated
  using (public.is_super_admin());

grant select, insert, update on public.case_registry to authenticated;
grant select, insert on public.case_stage_history to authenticated;
grant select, insert, update on public.agent_runs to authenticated;
grant select, insert, update on public.communication_queue to authenticated;
grant select, insert, update on public.trello_sync_queue to authenticated;

grant all on public.case_registry, public.case_stage_history, public.agent_runs,
  public.communication_queue, public.trello_sync_queue, public.case_reference_counters
  to service_role;

create or replace view public.agent_os_unmatched_case_queue
with (security_invoker = true)
as
select
  id,
  reference_number,
  case_type,
  source_system,
  source_table,
  source_record_id,
  person_name,
  organization_name,
  primary_email,
  department_id,
  subdepartment_function,
  workflow_stage,
  status,
  priority,
  risk_level,
  match_confidence,
  unmatched_reason,
  created_at,
  updated_at
from public.case_registry
where archived_at is null
  and (match_confidence = 'low' or unmatched_reason is not null);

grant select on public.agent_os_unmatched_case_queue to authenticated;

comment on table public.case_registry is 'Universal permanent case and profile-link registry for the HPG Agent OS.';
comment on table public.agent_runs is 'Reconstructable log of material agent processing runs and outcomes.';
comment on table public.communication_queue is 'Controlled outbound communications queue enforcing automatic, review, and human-only authority levels.';
comment on table public.trello_sync_queue is 'Idempotent queue for future Supabase and Trello synchronization.';
