-- Store completed work items for admin record keeping while removing them from active queues.

create table if not exists public.work_item_admin_records (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  title text not null,
  module module_type,
  department_id uuid references public.departments(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete set null,
  completed_by_user_id uuid,
  completed_at timestamptz not null default now(),
  archive_reason text,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (work_item_id)
);

alter table public.work_item_admin_records enable row level security;

drop policy if exists "Internal users can view work item admin records" on public.work_item_admin_records;
create policy "Internal users can view work item admin records"
on public.work_item_admin_records
for select
to authenticated
using (public.is_internal_user());

drop policy if exists "Internal users can create work item admin records" on public.work_item_admin_records;
create policy "Internal users can create work item admin records"
on public.work_item_admin_records
for insert
to authenticated
with check (public.is_internal_user());

create or replace function public.complete_and_archive_work_item(_work_item_id uuid, _reason text default 'Completed and sent to admin records')
returns public.work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.work_items;
  archived_item public.work_items;
begin
  if not public.is_internal_user() then
    raise exception 'Internal staff access required';
  end if;

  select * into item
  from public.work_items
  where id = _work_item_id;

  if item.id is null then
    raise exception 'Work item not found';
  end if;

  update public.work_items
  set status = 'complete',
      completed_at = coalesce(completed_at, now()),
      archived_at = coalesce(archived_at, now()),
      archived_by_user_id = auth.uid(),
      archive_reason = _reason,
      updated_at = now()
  where id = _work_item_id
  returning * into archived_item;

  insert into public.work_item_admin_records (
    work_item_id,
    title,
    module,
    department_id,
    ngo_id,
    completed_by_user_id,
    completed_at,
    archive_reason,
    snapshot_json
  ) values (
    archived_item.id,
    archived_item.title,
    archived_item.module,
    archived_item.department_id,
    archived_item.ngo_id,
    auth.uid(),
    coalesce(archived_item.completed_at, now()),
    _reason,
    to_jsonb(archived_item)
  )
  on conflict (work_item_id) do update
  set title = excluded.title,
      module = excluded.module,
      department_id = excluded.department_id,
      ngo_id = excluded.ngo_id,
      completed_by_user_id = excluded.completed_by_user_id,
      completed_at = excluded.completed_at,
      archive_reason = excluded.archive_reason,
      snapshot_json = excluded.snapshot_json;

  return archived_item;
end;
$$;

revoke all on function public.complete_and_archive_work_item(uuid, text) from public;
grant execute on function public.complete_and_archive_work_item(uuid, text) to authenticated;

create index if not exists idx_work_item_admin_records_work_item_id on public.work_item_admin_records(work_item_id);
create index if not exists idx_work_item_admin_records_completed_at on public.work_item_admin_records(completed_at desc);
create index if not exists idx_work_item_admin_records_module on public.work_item_admin_records(module);
