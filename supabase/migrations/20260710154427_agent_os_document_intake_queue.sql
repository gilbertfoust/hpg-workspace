-- Agent OS document intake preparation and Drive-placement queue.
-- This migration validates metadata, standardizes names, prepares the approved
-- Department / Function / Case / Documents destination, and records checklist
-- state. It does not upload, move, or expose any file externally.

create table if not exists public.case_document_intake (
  id uuid primary key default gen_random_uuid(),
  case_registry_id uuid not null references public.case_registry(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  source_system text not null,
  source_message_id text not null,
  source_attachment_id text not null,
  original_filename text not null,
  detected_mime_type text,
  detected_size_bytes bigint check (detected_size_bytes is null or detected_size_bytes >= 0),
  document_category text not null default 'supporting_document',
  validation_status text not null default 'pending' check (
    validation_status in ('pending','passed','failed','needs_review')
  ),
  validation_errors jsonb not null default '[]'::jsonb,
  standardized_filename text,
  drive_department_folder text,
  drive_subdepartment_folder text,
  drive_case_folder text,
  drive_target_path text,
  drive_file_id text,
  drive_file_url text,
  storage_status text not null default 'received' check (
    storage_status in ('received','placement_pending','placed','quarantined','rejected','cancelled')
  ),
  checklist_item_key text,
  checklist_status text not null default 'not_received' check (
    checklist_status in ('not_received','received','needs_review','accepted','rejected')
  ),
  requires_human_review boolean not null default false,
  created_by_agent text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  validated_at timestamptz,
  placed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, source_message_id, source_attachment_id)
);

create index if not exists case_document_intake_case_idx
  on public.case_document_intake(case_registry_id, received_at desc);

create index if not exists case_document_intake_pending_placement_idx
  on public.case_document_intake(storage_status, created_at)
  where storage_status = 'placement_pending';

create index if not exists case_document_intake_review_idx
  on public.case_document_intake(requires_human_review, created_at)
  where requires_human_review = true;

create or replace function public.agent_os_safe_file_token(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '_' from regexp_replace(
    regexp_replace(lower(coalesce(p_value, 'document')), '[^a-z0-9]+', '_', 'g'),
    '_+', '_', 'g'
  ));
$$;

create or replace function public.agent_os_prepare_document_intake(
  p_case_registry_id uuid,
  p_source_system text,
  p_source_message_id text,
  p_source_attachment_id text,
  p_original_filename text,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_document_category text default 'supporting_document',
  p_checklist_item_key text default null,
  p_created_by_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.case_registry%rowtype;
  v_department_name text;
  v_extension text;
  v_safe_category text;
  v_standardized_filename text;
  v_errors jsonb := '[]'::jsonb;
  v_valid boolean := true;
  v_requires_review boolean := false;
  v_storage_status text;
  v_validation_status text;
  v_checklist_status text;
  v_id uuid;
  v_allowed_mime_types constant text[] := array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'text/plain',
    'text/csv'
  ];
  v_dangerous_extensions constant text[] := array[
    'exe','com','bat','cmd','msi','scr','js','jse','vbs','vbe','ps1','sh','jar'
  ];
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to prepare Agent OS document intake';
  end if;

  select c.* into v_case
  from public.case_registry c
  where c.id = p_case_registry_id;

  if not found then
    raise exception 'Case registry record not found';
  end if;

  select d.name into v_department_name
  from public.departments d
  where d.id = v_case.department_id;

  if nullif(btrim(coalesce(p_source_system, '')), '') is null
     or nullif(btrim(coalesce(p_source_message_id, '')), '') is null
     or nullif(btrim(coalesce(p_source_attachment_id, '')), '') is null then
    raise exception 'Source system, message ID, and attachment ID are required';
  end if;

  if nullif(btrim(coalesce(p_original_filename, '')), '') is null then
    v_valid := false;
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('missing_original_filename');
  end if;

  v_extension := lower(substring(coalesce(p_original_filename, '') from '\.([^.]+)$'));

  if v_extension = any(v_dangerous_extensions) then
    v_valid := false;
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('dangerous_file_extension');
  end if;

  if p_size_bytes is not null and p_size_bytes > 26214400 then
    v_valid := false;
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('file_exceeds_25mb_limit');
  end if;

  if nullif(btrim(coalesce(p_mime_type, '')), '') is null then
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('mime_type_missing');
  elsif not (lower(p_mime_type) = any(v_allowed_mime_types)) then
    v_valid := false;
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('unsupported_mime_type');
  end if;

  if nullif(btrim(coalesce(v_case.reference_number, '')), '') is null then
    v_valid := false;
    v_requires_review := true;
    v_errors := v_errors || jsonb_build_array('case_reference_missing');
  end if;

  v_safe_category := public.agent_os_safe_file_token(p_document_category);
  if v_safe_category = '' then
    v_safe_category := 'supporting_document';
  end if;

  v_standardized_filename := coalesce(v_case.reference_number, 'UNMATCHED')
    || '__' || v_safe_category
    || '__' || to_char(timezone('UTC', now()), 'YYYY-MM-DD')
    || case when nullif(v_extension, '') is null then '' else '.' || v_extension end;

  if v_valid then
    v_validation_status := case when v_requires_review then 'needs_review' else 'passed' end;
    v_storage_status := 'placement_pending';
    v_checklist_status := case when v_requires_review then 'needs_review' else 'received' end;
  else
    v_validation_status := 'failed';
    v_storage_status := 'quarantined';
    v_checklist_status := 'needs_review';
  end if;

  insert into public.case_document_intake(
    case_registry_id,
    source_system,
    source_message_id,
    source_attachment_id,
    original_filename,
    detected_mime_type,
    detected_size_bytes,
    document_category,
    validation_status,
    validation_errors,
    standardized_filename,
    drive_department_folder,
    drive_subdepartment_folder,
    drive_case_folder,
    drive_target_path,
    storage_status,
    checklist_item_key,
    checklist_status,
    requires_human_review,
    created_by_agent,
    metadata,
    validated_at
  ) values (
    v_case.id,
    btrim(p_source_system),
    btrim(p_source_message_id),
    btrim(p_source_attachment_id),
    coalesce(nullif(btrim(p_original_filename), ''), 'unnamed_attachment'),
    nullif(lower(btrim(coalesce(p_mime_type, ''))), ''),
    p_size_bytes,
    coalesce(nullif(btrim(p_document_category), ''), 'supporting_document'),
    v_validation_status,
    v_errors,
    v_standardized_filename,
    coalesce(nullif(btrim(v_department_name), ''), 'Unassigned Department'),
    coalesce(nullif(btrim(v_case.subdepartment_function), ''), 'General Intake'),
    coalesce(nullif(btrim(v_case.reference_number), ''), 'Unmatched Case'),
    concat_ws(' / ',
      coalesce(nullif(btrim(v_department_name), ''), 'Unassigned Department'),
      coalesce(nullif(btrim(v_case.subdepartment_function), ''), 'General Intake'),
      coalesce(nullif(btrim(v_case.reference_number), ''), 'Unmatched Case'),
      'Documents'
    ),
    v_storage_status,
    nullif(btrim(coalesce(p_checklist_item_key, '')), ''),
    v_checklist_status,
    v_requires_review,
    nullif(btrim(coalesce(p_created_by_agent, '')), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'drive_action_authorized', false,
      'prepared_at', now()
    ),
    now()
  )
  on conflict (source_system, source_message_id, source_attachment_id)
  do update set
    case_registry_id = excluded.case_registry_id,
    detected_mime_type = excluded.detected_mime_type,
    detected_size_bytes = excluded.detected_size_bytes,
    document_category = excluded.document_category,
    checklist_item_key = coalesce(excluded.checklist_item_key, public.case_document_intake.checklist_item_key),
    metadata = public.case_document_intake.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.agent_os_prepare_document_intake(
  uuid,text,text,text,text,text,bigint,text,text,text,jsonb
) from public;
grant execute on function public.agent_os_prepare_document_intake(
  uuid,text,text,text,text,text,bigint,text,text,text,jsonb
) to authenticated, service_role;

alter table public.case_document_intake enable row level security;

drop policy if exists "Internal users can read case document intake" on public.case_document_intake;
create policy "Internal users can read case document intake"
  on public.case_document_intake for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create case document intake" on public.case_document_intake;
create policy "Internal users can create case document intake"
  on public.case_document_intake for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update case document intake" on public.case_document_intake;
create policy "Internal users can update case document intake"
  on public.case_document_intake for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete case document intake" on public.case_document_intake;
create policy "Super admins can delete case document intake"
  on public.case_document_intake for delete to authenticated
  using ((select public.is_super_admin()));

grant select, insert, update on public.case_document_intake to authenticated;
grant all on public.case_document_intake to service_role;

drop trigger if exists case_document_intake_set_updated_at on public.case_document_intake;
create trigger case_document_intake_set_updated_at
before update on public.case_document_intake
for each row execute function public.agent_os_set_updated_at();

create or replace view public.agent_os_document_placement_queue
with (security_invoker = true)
as
select
  d.id,
  d.case_registry_id,
  c.reference_number,
  c.case_type,
  c.organization_name,
  c.person_name,
  c.primary_email,
  c.department_id,
  c.subdepartment_function,
  d.source_system,
  d.source_message_id,
  d.source_attachment_id,
  d.original_filename,
  d.detected_mime_type,
  d.detected_size_bytes,
  d.document_category,
  d.validation_status,
  d.validation_errors,
  d.standardized_filename,
  d.drive_target_path,
  d.storage_status,
  d.checklist_item_key,
  d.checklist_status,
  d.requires_human_review,
  d.received_at,
  d.metadata
from public.case_document_intake d
join public.case_registry c on c.id = d.case_registry_id
where d.storage_status in ('placement_pending','quarantined')
  and c.archived_at is null;

grant select on public.agent_os_document_placement_queue to authenticated;

comment on table public.case_document_intake is
  'Validated attachment metadata, standardized file naming, checklist state, and prepared Google Drive destination. No external file action occurs here.';
comment on function public.agent_os_prepare_document_intake(
  uuid,text,text,text,text,text,bigint,text,text,text,jsonb
) is
  'Idempotently validates attachment metadata and prepares the approved Drive placement path without uploading a file.';
