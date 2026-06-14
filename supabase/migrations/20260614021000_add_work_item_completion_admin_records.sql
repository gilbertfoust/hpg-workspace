-- Completed work items should become admin records and leave active queues.

create table if not exists public.work_item_admin_records (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  title text not null,
  module module_type,
  department_id uuid references public.departments(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete set null,
  completed_by_user_id uuid,
  completed_at timestamptz not null default now(),
  archive_reason text not null default 'Completed and sent to admin records',
  record_status text not null default 'queued' check (record_status in ('queued','reviewed','filed')),
  notes text,
  created_at timestamptz not null default now(),
  unique (work_item_id)
);

alter table public.work_item_admin_records enable row level security;

drop policy if exists "internal users can read work item admin records" on public.work_item_admin_records;
create policy "internal users can read work item admin records"
on public.work_item_admin_records
for select
to authenticated
using (public.is_internal_user());

drop policy if exists "admin users can manage work item admin records" on public.work_item_admin_records;
create policy "admin users can manage work item admin records"
on public.work_item_admin_records
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','admin_pm','executive_secretariat')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','admin_pm','executive_secretariat')
  )
);

create or replace function public.complete_work_item_for_admin_records(_work_item_id uuid, _notes text default null)
returns public.work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.work_items;
begin
  if not public.is_internal_user() then
    raise exception 'Internal staff access required';
  end if;

  update public.work_items
  set status = 'complete',
      completed_at = coalesce(completed_at, now()),
      archived_at = coalesce(archived_at, now()),
      archived_by_user_id = coalesce(archived_by_user_id, auth.uid()),
      archive_reason = coalesce(_notes, 'Completed and sent to admin records'),
      updated_at = now()
  where id = _work_item_id
  returning * into item;

  if item.id is null then
    raise exception 'Work item not found';
  end if;

  insert into public.work_item_admin_records (
    work_item_id,
    title,
    module,
    department_id,
    ngo_id,
    completed_by_user_id,
    completed_at,
    archive_reason,
    notes
  ) values (
    item.id,
    item.title,
    item.module,
    item.department_id,
    item.ngo_id,
    auth.uid(),
    coalesce(item.completed_at, now()),
    coalesce(_notes, 'Completed and sent to admin records'),
    _notes
  )
  on conflict (work_item_id) do update
  set title = excluded.title,
      module = excluded.module,
      department_id = excluded.department_id,
      ngo_id = excluded.ngo_id,
      completed_by_user_id = excluded.completed_by_user_id,
      completed_at = excluded.completed_at,
      archive_reason = excluded.archive_reason,
      notes = excluded.notes;

  return item;
end;
$$;

revoke all on function public.complete_work_item_for_admin_records(uuid, text) from public;
grant execute on function public.complete_work_item_for_admin_records(uuid, text) to authenticated;
