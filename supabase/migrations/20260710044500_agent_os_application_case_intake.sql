-- Agent OS website application intake
-- Registers new sponsorship, volunteer, and board applications as permanent cases.
-- Failures are contained so a runtime issue cannot block a public application submission.

create or replace function public.agent_os_next_reference_unchecked(p_case_type text)
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

revoke all on function public.agent_os_next_reference_unchecked(text) from public, anon, authenticated;
grant execute on function public.agent_os_next_reference_unchecked(text) to service_role;

create or replace function public.next_hpg_reference_number(p_case_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to generate an HPG reference number';
  end if;

  return public.agent_os_next_reference_unchecked(p_case_type);
end;
$$;

create or replace function public.agent_os_assign_reference_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference_number is null or btrim(new.reference_number) = '' then
    new.reference_number := public.agent_os_next_reference_unchecked(new.case_type);
  end if;
  return new;
end;
$$;

create or replace function public.agent_os_department_id(p_module text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.departments d
  where d.module = p_module
    and d.is_active is true
  order by d.created_at asc
  limit 1
$$;

revoke all on function public.agent_os_department_id(text) from public, anon, authenticated;
grant execute on function public.agent_os_department_id(text) to service_role;

create or replace function public.agent_os_enqueue_trello_case_creation(
  p_case_id uuid,
  p_reference_number text,
  p_case_type text,
  p_title text,
  p_department_module text,
  p_source_table text,
  p_source_record_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trello_sync_queue(
    idempotency_key,
    case_registry_id,
    entity_type,
    entity_id,
    operation,
    direction,
    payload,
    status
  ) values (
    'case:' || p_case_id::text || ':create_card',
    p_case_id,
    'case_registry',
    p_case_id::text,
    'create_card',
    'supabase_to_trello',
    jsonb_build_object(
      'reference_number', p_reference_number,
      'case_type', p_case_type,
      'title', p_title,
      'department_module', p_department_module,
      'source_table', p_source_table,
      'source_record_id', p_source_record_id
    ),
    'pending'
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.agent_os_enqueue_trello_case_creation(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.agent_os_enqueue_trello_case_creation(uuid, text, text, text, text, text, text)
  to service_role;

create or replace function public.agent_os_register_sponsorship_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_reference text;
  v_title text;
begin
  v_title := 'Sponsorship Application — ' || coalesce(nullif(btrim(new.organization_name), ''), 'Unnamed Organization');

  insert into public.case_registry(
    reference_number,
    case_type,
    source_system,
    source_table,
    source_record_id,
    source_event_id,
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
    approval_required,
    external_visible,
    next_action,
    metadata
  ) values (
    null,
    'sponsorship',
    'website_application',
    'sponsorship_applications',
    new.id::text,
    'sponsorship_application:' || new.id::text,
    new.representative_name,
    new.organization_name,
    new.email,
    public.agent_os_department_id('development'),
    'Partnership Development & Sponsorships',
    'application_received',
    'open',
    'routine',
    'insufficient_information',
    'high',
    false,
    false,
    'Send acknowledgment, assess completeness, and request the standard document set.',
    jsonb_build_object(
      'application_status', new.application_status,
      'sponsorship_model', new.sponsorship_model,
      'country_of_registration', new.country_of_registration,
      'country_of_operation', new.country_of_operation
    )
  )
  on conflict (source_table, source_record_id)
    where source_table is not null and source_record_id is not null
  do update set
    person_name = excluded.person_name,
    organization_name = excluded.organization_name,
    primary_email = excluded.primary_email,
    updated_at = now()
  returning id, reference_number into v_case_id, v_reference;

  perform public.agent_os_enqueue_trello_case_creation(
    v_case_id,
    v_reference,
    'sponsorship',
    v_title,
    'development',
    'sponsorship_applications',
    new.id::text
  );

  return new;
exception when others then
  raise warning 'Agent OS sponsorship case registration failed for application %: %', new.id, sqlerrm;
  return new;
end;
$$;

create or replace function public.agent_os_register_volunteer_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_reference text;
  v_title text;
begin
  v_title := 'Volunteer Application — ' || coalesce(nullif(btrim(new.full_name), ''), 'Unnamed Applicant');

  insert into public.case_registry(
    reference_number,
    case_type,
    source_system,
    source_table,
    source_record_id,
    source_event_id,
    person_name,
    primary_email,
    department_id,
    subdepartment_function,
    workflow_stage,
    status,
    priority,
    risk_level,
    match_confidence,
    approval_required,
    external_visible,
    next_action,
    metadata
  ) values (
    null,
    'volunteer',
    'website_application',
    'volunteer_applications',
    new.id::text,
    'volunteer_application:' || new.id::text,
    new.full_name,
    new.email,
    public.agent_os_department_id('hr'),
    'Recruitment',
    'application_received',
    'open',
    'routine',
    'insufficient_information',
    'high',
    false,
    false,
    'Send acknowledgment, confirm résumé status, review completeness, and request availability.',
    jsonb_build_object(
      'position', new.position,
      'recruitment_status', new.recruitment_status,
      'resume_received', (new.resume_file_path is not null or new.resume_link is not null)
    )
  )
  on conflict (source_table, source_record_id)
    where source_table is not null and source_record_id is not null
  do update set
    person_name = excluded.person_name,
    primary_email = excluded.primary_email,
    updated_at = now()
  returning id, reference_number into v_case_id, v_reference;

  perform public.agent_os_enqueue_trello_case_creation(
    v_case_id,
    v_reference,
    'volunteer',
    v_title,
    'hr',
    'volunteer_applications',
    new.id::text
  );

  return new;
exception when others then
  raise warning 'Agent OS volunteer case registration failed for application %: %', new.id, sqlerrm;
  return new;
end;
$$;

create or replace function public.agent_os_register_board_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_reference text;
  v_title text;
begin
  v_title := 'Board Application — ' || coalesce(nullif(btrim(new.full_name), ''), 'Unnamed Applicant');

  insert into public.case_registry(
    reference_number,
    case_type,
    source_system,
    source_table,
    source_record_id,
    source_event_id,
    person_name,
    primary_email,
    department_id,
    subdepartment_function,
    workflow_stage,
    status,
    priority,
    risk_level,
    match_confidence,
    approval_required,
    external_visible,
    next_action,
    metadata
  ) values (
    null,
    'board',
    'website_application',
    'board_applications',
    new.id::text,
    'board_application:' || new.id::text,
    new.full_name,
    new.email,
    public.agent_os_department_id('administration'),
    'Nominations Committee Intake',
    'application_received',
    'open',
    'routine',
    'insufficient_information',
    'high',
    true,
    false,
    'Send acknowledgment, review completeness, and route to the Nominations process.',
    jsonb_build_object(
      'role_interest', new.role_interest,
      'professional_sector', new.professional_sector,
      'resume_received', (new.resume_file_path is not null or new.resume_link is not null),
      'conflict_status', new.conflict_status
    )
  )
  on conflict (source_table, source_record_id)
    where source_table is not null and source_record_id is not null
  do update set
    person_name = excluded.person_name,
    primary_email = excluded.primary_email,
    updated_at = now()
  returning id, reference_number into v_case_id, v_reference;

  perform public.agent_os_enqueue_trello_case_creation(
    v_case_id,
    v_reference,
    'board',
    v_title,
    'administration',
    'board_applications',
    new.id::text
  );

  return new;
exception when others then
  raise warning 'Agent OS board case registration failed for application %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists sponsorship_applications_agent_os_case on public.sponsorship_applications;
create trigger sponsorship_applications_agent_os_case
after insert on public.sponsorship_applications
for each row execute function public.agent_os_register_sponsorship_application();

drop trigger if exists volunteer_applications_agent_os_case on public.volunteer_applications;
create trigger volunteer_applications_agent_os_case
after insert on public.volunteer_applications
for each row execute function public.agent_os_register_volunteer_application();

drop trigger if exists board_applications_agent_os_case on public.board_applications;
create trigger board_applications_agent_os_case
after insert on public.board_applications
for each row execute function public.agent_os_register_board_application();

create or replace view public.agent_os_unlinked_applications
with (security_invoker = true)
as
select
  'sponsorship_applications'::text as source_table,
  s.id::text as source_record_id,
  'sponsorship'::text as case_type,
  s.organization_name as display_name,
  s.email as primary_email,
  s.created_at
from public.sponsorship_applications s
left join public.case_registry c
  on c.source_table = 'sponsorship_applications'
 and c.source_record_id = s.id::text
where c.id is null
union all
select
  'volunteer_applications'::text,
  v.id::text,
  'volunteer'::text,
  v.full_name,
  v.email,
  v.created_at
from public.volunteer_applications v
left join public.case_registry c
  on c.source_table = 'volunteer_applications'
 and c.source_record_id = v.id::text
where c.id is null
union all
select
  'board_applications'::text,
  b.id::text,
  'board'::text,
  b.full_name,
  b.email,
  b.created_at
from public.board_applications b
left join public.case_registry c
  on c.source_table = 'board_applications'
 and c.source_record_id = b.id::text
where c.id is null;

grant select on public.agent_os_unlinked_applications to authenticated;

comment on view public.agent_os_unlinked_applications
  is 'Existing website applications that require controlled Agent OS case backfill; no automatic historical numbering is performed.';
