-- HPG Forms 100 MVP
--
-- Completes the HPG-specific form lifecycle: governed templates, NGO/user
-- assignments, private drafts, server-side validation, file evidence,
-- atomic department routing, reviewer decisions, and an auditable version
-- history. Existing public RPC signatures remain available for compatibility.

-- ---------------------------------------------------------------------------
-- Template governance and immutable version evidence
-- ---------------------------------------------------------------------------

create table if not exists public.form_template_versions (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references public.form_templates(id) on delete cascade,
  version integer not null,
  name text not null,
  module public.module_type not null,
  description text,
  schema_json jsonb not null default '{"fields":[]}'::jsonb,
  mapping_json jsonb not null default '{}'::jsonb,
  form_audience text not null default 'staff',
  intake_module public.module_type not null default 'ngo_coordination',
  is_active boolean not null default true,
  published_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique(form_template_id, version)
);

alter table public.form_template_versions enable row level security;

create policy "Authenticated users read form template versions"
on public.form_template_versions for select to authenticated
using (
  public.is_internal_user()
  or exists (
    select 1 from public.form_templates ft
    where ft.id = form_template_versions.form_template_id
      and ft.is_active
      and ft.form_audience = 'ngo_portal'
  )
);

-- Version rows are immutable from the Data API. The governed publishing RPC
-- writes the snapshot after it has completed its own administrator check.

-- NGO portal users must be able to read the active templates that HPG has
-- explicitly published for them. Template definitions contain no private data.
drop policy if exists "Active NGO portal templates are readable" on public.form_templates;
create policy "Active NGO portal templates are readable"
on public.form_templates for select to authenticated
using (is_active and form_audience = 'ngo_portal');

create or replace function public.admin_upsert_form_template(
  p_template_id uuid,
  p_name text,
  p_module public.module_type,
  p_description text,
  p_schema_json jsonb,
  p_mapping_json jsonb default '{}'::jsonb,
  p_form_audience text default 'staff',
  p_intake_module public.module_type default 'ngo_coordination',
  p_is_active boolean default true
)
returns public.form_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.form_templates;
  field_row jsonb;
  field_name text;
  field_type text;
  seen_names text[] := '{}';
  next_version integer;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Administrator access required';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Form name is required'; end if;
  if p_form_audience not in ('staff','ngo_portal') then
    raise exception 'Invalid form audience';
  end if;
  if jsonb_typeof(p_schema_json) <> 'object'
     or jsonb_typeof(coalesce(p_schema_json->'fields','[]'::jsonb)) <> 'array' then
    raise exception 'Form schema must contain a fields array';
  end if;

  for field_row in select value from jsonb_array_elements(coalesce(p_schema_json->'fields','[]'::jsonb))
  loop
    field_name := nullif(trim(field_row->>'name'), '');
    field_type := lower(coalesce(field_row->>'type', ''));
    if field_name is null or nullif(trim(field_row->>'label'), '') is null then
      raise exception 'Every field needs a name and label';
    end if;
    if field_name = any(seen_names) then raise exception 'Duplicate field name: %', field_name; end if;
    if field_type not in ('text','textarea','email','tel','url','number','date','select','multiselect','checkbox','file') then
      raise exception 'Unsupported field type: %', field_type;
    end if;
    if field_type in ('select','multiselect')
       and jsonb_array_length(coalesce(field_row->'options','[]'::jsonb)) = 0 then
      raise exception 'Field % requires at least one option', field_name;
    end if;
    seen_names := array_append(seen_names, field_name);
  end loop;

  if p_template_id is null then
    insert into public.form_templates(
      name, module, description, schema_json, mapping_json, version, is_active,
      created_by_user_id, form_audience, intake_module, portal_visible
    ) values (
      trim(p_name), p_module, nullif(trim(p_description), ''), p_schema_json,
      coalesce(p_mapping_json,'{}'::jsonb), 1, coalesce(p_is_active,true),
      auth.uid(), p_form_audience, p_intake_module,
      p_form_audience = 'ngo_portal'
    ) returning * into row_out;
  else
    select coalesce(version,0) + 1 into next_version
    from public.form_templates where id = p_template_id for update;
    if next_version is null then raise exception 'Form template not found'; end if;

    update public.form_templates
    set name = trim(p_name), module = p_module,
        description = nullif(trim(p_description), ''),
        schema_json = p_schema_json,
        mapping_json = coalesce(p_mapping_json,'{}'::jsonb),
        version = next_version,
        is_active = coalesce(p_is_active,true),
        form_audience = p_form_audience,
        intake_module = p_intake_module,
        portal_visible = p_form_audience = 'ngo_portal',
        updated_at = now()
    where id = p_template_id
    returning * into row_out;
  end if;

  insert into public.form_template_versions(
    form_template_id, version, name, module, description, schema_json,
    mapping_json, form_audience, intake_module, is_active, published_by_user_id
  ) values (
    row_out.id, coalesce(row_out.version,1), row_out.name, row_out.module,
    row_out.description, row_out.schema_json, coalesce(row_out.mapping_json,'{}'::jsonb),
    row_out.form_audience, row_out.intake_module, coalesce(row_out.is_active,true), auth.uid()
  ) on conflict (form_template_id, version) do nothing;

  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (
    auth.uid(), case when p_template_id is null then 'create' else 'publish_version' end,
    'form_template', row_out.id, 'HPG governed form template saved',
    jsonb_build_object('version', row_out.version, 'module', row_out.module, 'audience', row_out.form_audience)
  );

  return row_out;
end;
$$;

revoke all on function public.admin_upsert_form_template(uuid,text,public.module_type,text,jsonb,jsonb,text,public.module_type,boolean) from public, anon;
grant execute on function public.admin_upsert_form_template(uuid,text,public.module_type,text,jsonb,jsonb,text,public.module_type,boolean) to authenticated;

-- Capture the currently published forms as version 1 evidence without changing
-- the live template rows.
insert into public.form_template_versions(
  form_template_id, version, name, module, description, schema_json,
  mapping_json, form_audience, intake_module, is_active, published_by_user_id, published_at
)
select id, coalesce(version,1), name, module, description, schema_json,
       coalesce(mapping_json,'{}'::jsonb), form_audience, intake_module,
       coalesce(is_active,true), created_by_user_id, coalesce(updated_at,created_at,now())
from public.form_templates
on conflict (form_template_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- Assign forms to an NGO, user, or department
-- ---------------------------------------------------------------------------

create table if not exists public.form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references public.form_templates(id) on delete restrict,
  ngo_id uuid references public.ngos(id) on delete cascade,
  assigned_to_user_id uuid references public.profiles(id) on delete cascade,
  department_id uuid references public.org_units(id) on delete set null,
  assigned_by_user_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  instructions text,
  due_at timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned','in_progress','submitted','accepted','needs_revision','waived','cancelled')),
  submission_id uuid,
  external_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ngo_id is not null or assigned_to_user_id is not null or department_id is not null)
);

alter table public.form_submissions
  add column if not exists assignment_id uuid references public.form_assignments(id) on delete set null,
  add column if not exists reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

alter table public.form_assignments
  drop constraint if exists form_assignments_submission_id_fkey;
alter table public.form_assignments
  add constraint form_assignments_submission_id_fkey
  foreign key (submission_id) references public.form_submissions(id) on delete set null;

create index if not exists form_assignments_ngo_status_idx
  on public.form_assignments(ngo_id, status, due_at);
create index if not exists form_assignments_user_status_idx
  on public.form_assignments(assigned_to_user_id, status, due_at);
create index if not exists form_assignments_department_status_idx
  on public.form_assignments(department_id, status, due_at);
create index if not exists form_assignments_template_idx
  on public.form_assignments(form_template_id);
create index if not exists form_assignments_assigned_by_idx
  on public.form_assignments(assigned_by_user_id);
create index if not exists form_assignments_submission_idx
  on public.form_assignments(submission_id);
create index if not exists form_submissions_assignment_idx
  on public.form_submissions(assignment_id);
create index if not exists form_submissions_template_idx
  on public.form_submissions(form_template_id);
create index if not exists form_submissions_ngo_idx
  on public.form_submissions(ngo_id);
create index if not exists form_submissions_reviewer_idx
  on public.form_submissions(reviewed_by_user_id);
create index if not exists form_submissions_work_item_idx
  on public.form_submissions(work_item_id);
create index if not exists form_template_versions_publisher_idx
  on public.form_template_versions(published_by_user_id);

alter table public.form_assignments enable row level security;

create policy "Authorized users read form assignments"
on public.form_assignments for select to authenticated
using (
  public.is_admin_user()
  or assigned_to_user_id = (select auth.uid())
  or (ngo_id is not null and public.has_ngo_access(ngo_id))
  or (department_id is not null and public.is_department_member(department_id))
);

create policy "Internal users create form assignments"
on public.form_assignments for insert to authenticated
with check (public.is_internal_user() and assigned_by_user_id = (select auth.uid()));

create policy "Authorized staff update form assignments"
on public.form_assignments for update to authenticated
using (
  public.is_admin_user()
  or (public.is_internal_user() and department_id is not null and public.is_department_member(department_id))
  or assigned_by_user_id = (select auth.uid())
)
with check (public.is_internal_user());

create policy "Administrators delete form assignments"
on public.form_assignments for delete to authenticated
using (public.is_admin_user());

create or replace function public.link_form_assignment_submission(
  p_assignment_id uuid,
  p_submission_id uuid
)
returns public.form_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.form_assignments;
  submission_row public.form_submissions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into assignment_row from public.form_assignments where id = p_assignment_id for update;
  if assignment_row.id is null then raise exception 'Form assignment not found'; end if;
  if not (
    public.is_admin_user()
    or assignment_row.assigned_to_user_id = auth.uid()
    or (assignment_row.ngo_id is not null and public.has_ngo_access(assignment_row.ngo_id))
    or (assignment_row.department_id is not null and public.is_department_member(assignment_row.department_id))
  ) then raise exception 'Form assignment access denied'; end if;

  select * into submission_row from public.form_submissions where id = p_submission_id;
  if submission_row.id is null or submission_row.submitted_by_user_id <> auth.uid() then
    raise exception 'Submission access denied';
  end if;
  if submission_row.form_template_id <> assignment_row.form_template_id then
    raise exception 'Submission does not use the assigned form template';
  end if;
  if assignment_row.ngo_id is not null and submission_row.ngo_id is distinct from assignment_row.ngo_id then
    raise exception 'Submission NGO does not match the form assignment';
  end if;

  update public.form_submissions set assignment_id = assignment_row.id, updated_at = now()
  where id = submission_row.id;

  update public.form_assignments
  set submission_id = submission_row.id,
      status = case when submission_row.submission_status = 'submitted' then 'submitted' else 'in_progress' end,
      updated_at = now()
  where id = assignment_row.id
  returning * into assignment_row;

  return assignment_row;
end;
$$;

revoke all on function public.link_form_assignment_submission(uuid,uuid) from public, anon;
grant execute on function public.link_form_assignment_submission(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-side schema validation (UI validation alone is bypassable)
-- ---------------------------------------------------------------------------

create or replace function public.validate_form_payload(
  p_form_template_id uuid,
  p_payload_json jsonb,
  p_require_complete boolean default true
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  template_schema jsonb;
  field_row jsonb;
  field_name text;
  field_label text;
  field_type text;
  field_value jsonb;
  required_field boolean;
  missing_value boolean;
  errors jsonb := '[]'::jsonb;
begin
  select schema_json into template_schema from public.form_templates where id = p_form_template_id;
  if template_schema is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array(jsonb_build_object('field','_form','message','Form template not found')));
  end if;

  if jsonb_typeof(coalesce(p_payload_json,'{}'::jsonb)) <> 'object' then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array(jsonb_build_object('field','_form','message','Form payload must be an object')));
  end if;

  for field_row in select value from jsonb_array_elements(coalesce(template_schema->'fields','[]'::jsonb))
  loop
    field_name := field_row->>'name';
    field_label := coalesce(field_row->>'label', field_name);
    field_type := lower(coalesce(field_row->>'type','text'));
    required_field := coalesce((field_row->>'required')::boolean,false);
    field_value := p_payload_json->field_name;
    missing_value := field_value is null or field_value = 'null'::jsonb
      or (jsonb_typeof(field_value) = 'string' and nullif(trim(field_value #>> '{}'),'') is null)
      or (jsonb_typeof(field_value) = 'array' and jsonb_array_length(field_value) = 0)
      or (field_type = 'checkbox' and required_field and field_value <> 'true'::jsonb);

    if p_require_complete and required_field and missing_value then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' is required'));
      continue;
    end if;
    if missing_value then continue; end if;

    if field_type = 'number'
       and not (
         jsonb_typeof(field_value) = 'number'
         or (jsonb_typeof(field_value) = 'string' and (field_value #>> '{}') ~ '^-?[0-9]+([.][0-9]+)?$')
       ) then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' must be a number'));
    elsif field_type = 'email'
       and (field_value #>> '{}') !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' must be a valid email address'));
    elsif field_type = 'url'
       and (field_value #>> '{}') !~* '^https?://' then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' must start with http:// or https://'));
    elsif field_type = 'date'
       and (field_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' must be a valid date'));
    elsif field_type = 'select'
       and not exists (
         select 1 from jsonb_array_elements_text(coalesce(field_row->'options','[]'::jsonb)) option_value
         where option_value = (field_value #>> '{}')
       ) then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' contains an invalid option'));
    elsif field_type = 'multiselect'
       and (
         jsonb_typeof(field_value) <> 'array'
         or exists (
           select 1 from jsonb_array_elements_text(field_value) selected_value
           where not exists (
             select 1 from jsonb_array_elements_text(coalesce(field_row->'options','[]'::jsonb)) option_value
             where option_value = selected_value
           )
         )
       ) then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' contains an invalid selection'));
    elsif field_type = 'file'
       and (jsonb_typeof(field_value) <> 'object' or nullif(field_value->>'document_id','') is null) then
      errors := errors || jsonb_build_array(jsonb_build_object('field',field_name,'message',field_label || ' must contain an uploaded file'));
    end if;
  end loop;

  return jsonb_build_object('valid', jsonb_array_length(errors) = 0, 'errors', errors);
end;
$$;

revoke all on function public.validate_form_payload(uuid,jsonb,boolean) from public, anon;
grant execute on function public.validate_form_payload(uuid,jsonb,boolean) to authenticated;

create or replace function public.enforce_form_payload_before_submit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  validation_result jsonb;
begin
  if new.submission_status in ('submitted','accepted') then
    validation_result := public.validate_form_payload(new.form_template_id, new.payload_json, true);
    if not coalesce((validation_result->>'valid')::boolean,false) then
      raise exception 'Form validation failed: %', validation_result->'errors';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_form_payload_before_submit on public.form_submissions;
create trigger trg_enforce_form_payload_before_submit
before insert or update of submission_status, payload_json on public.form_submissions
for each row execute function public.enforce_form_payload_before_submit();

-- ---------------------------------------------------------------------------
-- File fields: evidence belongs to the draft/submission and creates no work
-- item until the form itself is submitted.
-- ---------------------------------------------------------------------------

alter table public.documents
  add column if not exists form_submission_id uuid references public.form_submissions(id) on delete cascade,
  add column if not exists form_field_name text;

create index if not exists documents_form_submission_idx
  on public.documents(form_submission_id, form_field_name);

create or replace function public.route_ngo_portal_document_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_module public.module_type;
  created_work_item_id uuid;
begin
  -- Files embedded in a private form draft are routed only by the atomic form
  -- submit action. Creating a document work item here would leak draft state.
  if new.form_submission_id is not null then return new; end if;
  if new.work_item_id is not null or new.ngo_id is null then return new; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.uploaded_by_user_id
      and p.role in ('ngo_user','external_ngo')
  ) then return new; end if;

  target_module := case new.category::text
    when 'finance' then 'finance'::public.module_type
    when 'hr' then 'hr'::public.module_type
    when 'marketing' then 'marketing'::public.module_type
    when 'communications' then 'communications'::public.module_type
    when 'program' then 'program'::public.module_type
    when 'curriculum' then 'curriculum'::public.module_type
    when 'it' then 'it'::public.module_type
    when 'legal' then 'legal'::public.module_type
    when 'compliance' then 'legal'::public.module_type
    else 'ngo_coordination'::public.module_type
  end;

  insert into public.work_items(
    ngo_id, module, type, title, description, department_id,
    created_by_user_id, status, priority, evidence_required,
    evidence_status, external_visible, source_system, source_event_id
  ) values (
    new.ngo_id, target_module, 'ngo_document_upload',
    'Review NGO upload — ' || new.file_name,
    'An NGO portal user uploaded a document for departmental review.',
    public.resolve_work_item_department(target_module::text),
    new.uploaded_by_user_id, 'Not Started', 'Med', true,
    'uploaded', true, 'ngo_portal_document', new.id::text
  ) returning id into created_work_item_id;

  new.work_item_id := created_work_item_id;
  return new;
end;
$$;

-- When a form is submitted, attach every draft file to the one department work
-- item created by the atomic submission RPC.
create or replace function public.link_form_files_to_submitted_work_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submission_status = 'submitted' and new.work_item_id is not null
     and (old.submission_status is distinct from new.submission_status
          or old.work_item_id is distinct from new.work_item_id) then
    update public.documents
    set work_item_id = new.work_item_id, updated_at = now()
    where form_submission_id = new.id and work_item_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_form_files_to_submitted_work_item on public.form_submissions;
create trigger trg_link_form_files_to_submitted_work_item
after update of submission_status, work_item_id on public.form_submissions
for each row execute function public.link_form_files_to_submitted_work_item();

-- ---------------------------------------------------------------------------
-- Department review and acceptance
-- ---------------------------------------------------------------------------

create or replace function public.review_form_submission(
  p_submission_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.form_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.form_submissions;
  work_row public.work_items;
  decision_text text := lower(trim(coalesce(p_decision,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if decision_text not in ('accepted','rejected') then raise exception 'Decision must be accepted or rejected'; end if;

  select wi.* into work_row
  from public.form_submissions fs
  join public.work_items wi on wi.id = fs.work_item_id
  where fs.id = p_submission_id and fs.submission_status = 'submitted';
  if work_row.id is null then raise exception 'Submitted form not found'; end if;
  if not (public.is_admin_user() or public.is_department_member(work_row.department_id)) then
    raise exception 'Responsible department access required';
  end if;

  update public.form_submissions
  set submission_status = decision_text,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      review_notes = nullif(trim(p_notes),''),
      updated_at = now()
  where id = p_submission_id
  returning * into row_out;

  update public.work_items
  set status = case when decision_text = 'accepted' then 'Complete' else 'Waiting on NGO' end,
      completed_at = case when decision_text = 'accepted' then now() else null end,
      updated_at = now()
  where id = work_row.id;

  if row_out.assignment_id is not null then
    update public.form_assignments
    set status = case when decision_text = 'accepted' then 'accepted' else 'needs_revision' end,
        updated_at = now()
    where id = row_out.assignment_id;
  end if;

  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (
    auth.uid(), 'review', 'form_submission', row_out.id,
    nullif(trim(p_notes),''),
    jsonb_build_object('decision',decision_text,'work_item_id',work_row.id,'assignment_id',row_out.assignment_id)
  );
  return row_out;
end;
$$;

revoke all on function public.review_form_submission(uuid,text,text) from public, anon;
grant execute on function public.review_form_submission(uuid,text,text) to authenticated;

create or replace function public.create_form_revision(p_submission_id uuid)
returns public.form_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_row public.form_submissions;
  revision_row public.form_submissions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into prior_row from public.form_submissions where id = p_submission_id for update;
  if prior_row.id is null or prior_row.submission_status <> 'rejected' then
    raise exception 'A rejected submission is required to create a revision';
  end if;
  if not (
    prior_row.submitted_by_user_id = auth.uid()
    or (prior_row.ngo_id is not null and public.has_ngo_access(prior_row.ngo_id))
  ) then raise exception 'Submission access denied'; end if;

  insert into public.form_submissions(
    form_template_id, ngo_id, submitted_by_user_id, payload_json,
    submission_status, submitted_at, work_item_id, draft_progress, assignment_id
  ) values (
    prior_row.form_template_id, prior_row.ngo_id, auth.uid(), prior_row.payload_json,
    'draft', null, null, prior_row.draft_progress, prior_row.assignment_id
  ) returning * into revision_row;

  if prior_row.assignment_id is not null then
    update public.form_assignments
    set submission_id = revision_row.id, status = 'in_progress', updated_at = now()
    where id = prior_row.assignment_id;
  end if;

  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (
    auth.uid(), 'create_revision', 'form_submission', revision_row.id,
    'Revision created from rejected form submission',
    jsonb_build_object('prior_submission_id',prior_row.id,'prior_work_item_id',prior_row.work_item_id)
  );
  return revision_row;
end;
$$;

revoke all on function public.create_form_revision(uuid) from public, anon;
grant execute on function public.create_form_revision(uuid) to authenticated;

-- Explicit grants for Data API access; RLS remains authoritative.
grant select on public.form_template_versions to authenticated;
grant select, insert, update, delete on public.form_assignments to authenticated;

comment on table public.form_assignments is
  'Governed HPG assignments of a form template to an NGO, user, or department.';
comment on function public.validate_form_payload(uuid,jsonb,boolean) is
  'Server-side validation for HPG form schemas; submission cannot bypass it.';
