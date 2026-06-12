-- Stabilize NGO portal access, document storage, form updates, and work item department/archive behavior.

create or replace function public.can_access_ngo_storage_object(object_name text)
returns boolean
language sql
security definer
stable
set search_path = public, storage
as $$
  select public.is_internal_user()
    or exists (
      select 1
      from public.contacts c
      where c.user_id = auth.uid()
        and c.ngo_id::text = split_part(object_name, '/', 1)
    );
$$;

revoke all on function public.can_access_ngo_storage_object(text) from public;
grant execute on function public.can_access_ngo_storage_object(text) to authenticated;

drop policy if exists "Authenticated users can view documents" on storage.objects;
drop policy if exists "Authenticated users can upload documents" on storage.objects;
drop policy if exists "Authenticated users can update documents" on storage.objects;
drop policy if exists "Authenticated users can delete documents" on storage.objects;

create policy "Accessible users can view NGO documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ngo-documents'
  and public.can_access_ngo_storage_object(name)
);

create policy "Accessible users can upload NGO documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ngo-documents'
  and public.can_access_ngo_storage_object(name)
);

create policy "Accessible users can update NGO documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ngo-documents'
  and public.can_access_ngo_storage_object(name)
)
with check (
  bucket_id = 'ngo-documents'
  and public.can_access_ngo_storage_object(name)
);

create policy "Accessible users can delete NGO documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ngo-documents'
  and public.can_access_ngo_storage_object(name)
);

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'text/html')
where id = 'ngo-documents'
  and not ('text/html' = any(allowed_mime_types));

drop policy if exists "External can upload to own NGO" on public.documents;
create policy "Users can upload documents for accessible NGOs"
on public.documents
for insert
to authenticated
with check (
  public.is_internal_user()
  or public.has_ngo_access(ngo_id)
);

create policy "Portal users can view linked NGO profile"
on public.ngos
for select
to authenticated
using (public.has_ngo_access(id));

create policy "Portal users can view shared NGO work items"
on public.work_items
for select
to authenticated
using (
  external_visible = true
  and ngo_id is not null
  and public.has_ngo_access(ngo_id)
);

create policy "Portal users can view submitted NGO forms"
on public.form_submissions
for select
to authenticated
using (
  ngo_id is not null
  and submission_status = 'submitted'
  and public.has_ngo_access(ngo_id)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  module text not null unique,
  google_drive_folder_url text,
  google_drive_folder_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.departments (name, module)
values
  ('NGO Coordination', 'ngo_coordination'),
  ('Administration', 'administration'),
  ('Operations', 'operations'),
  ('Program', 'program'),
  ('Curriculum', 'curriculum'),
  ('Development', 'development'),
  ('Partnership', 'partnership'),
  ('Marketing', 'marketing'),
  ('Communications', 'communications'),
  ('Human Resources', 'hr'),
  ('Information Technology', 'it'),
  ('Finance', 'finance'),
  ('Legal', 'legal')
on conflict (module) do update set
  name = excluded.name,
  updated_at = now();

alter table public.departments enable row level security;

drop policy if exists "Internal users can view departments" on public.departments;
drop policy if exists "Management can manage departments" on public.departments;
drop policy if exists "Authenticated users can view active departments" on public.departments;

create policy "Authenticated users can view active departments"
on public.departments
for select
to authenticated
using (is_active = true);

create policy "Management can manage departments"
on public.departments
for all
to authenticated
using (public.is_management())
with check (public.is_management());

alter table public.work_items
add column if not exists archived_at timestamptz,
add column if not exists archived_by_user_id uuid,
add column if not exists archive_reason text,
add column if not exists google_drive_file_url text,
add column if not exists google_drive_file_id text,
add column if not exists google_drive_exported_at timestamptz;

create index if not exists idx_work_items_department_id on public.work_items(department_id);
create index if not exists idx_work_items_archived_at on public.work_items(archived_at);

update public.work_items wi
set department_id = d.id,
    updated_at = now()
from public.departments d
where wi.department_id is null
  and wi.module = d.module;

create or replace function public.assign_work_item_department_from_module()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.department_id is null and new.module is not null then
    select id into new.department_id
    from public.departments
    where module = new.module
      and is_active = true
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_work_item_department_from_module on public.work_items;
create trigger trg_assign_work_item_department_from_module
before insert or update of module, department_id
on public.work_items
for each row
execute function public.assign_work_item_department_from_module();

create or replace function public.archive_work_item(_work_item_id uuid, _reason text default 'Archived by user')
returns public.work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  archived public.work_items;
begin
  update public.work_items
  set status = 'canceled',
      archived_at = now(),
      archived_by_user_id = auth.uid(),
      archive_reason = coalesce(_reason, 'Archived by user'),
      updated_at = now()
  where id = _work_item_id
    and (
      owner_user_id = auth.uid()
      or created_by_user_id = auth.uid()
      or public.is_management()
      or public.is_internal_user()
    )
  returning * into archived;

  if archived.id is null then
    raise exception 'Work item not found or access denied';
  end if;

  return archived;
end;
$$;

revoke all on function public.archive_work_item(uuid, text) from public;
grant execute on function public.archive_work_item(uuid, text) to authenticated;

drop policy if exists "Internal users can update form submissions" on public.form_submissions;
drop policy if exists "Internal users can view form submissions" on public.form_submissions;
drop policy if exists "Internal users can update work items" on public.work_items;

create policy "Internal users can update form submissions"
on public.form_submissions
for update
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

create policy "Internal users can view form submissions"
on public.form_submissions
for select
to authenticated
using (public.is_internal_user());

create policy "Internal users can update work items"
on public.work_items
for update
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());
