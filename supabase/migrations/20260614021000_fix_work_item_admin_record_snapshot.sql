-- Ensure completed work items can be saved to admin records before they leave active queues.

alter table public.work_item_admin_records
add column if not exists snapshot_json jsonb;

create index if not exists idx_work_item_admin_records_record_status
on public.work_item_admin_records(record_status);

create index if not exists idx_work_item_admin_records_completed_at
on public.work_item_admin_records(completed_at);

create or replace function public.complete_and_archive_work_item(
  _work_item_id uuid,
  _reason text default 'Completed and sent to admin records'
)
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
    record_status,
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
    'ready_for_records',
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
      record_status = excluded.record_status,
      snapshot_json = excluded.snapshot_json;

  return archived_item;
end;
$$;

revoke all on function public.complete_and_archive_work_item(uuid, text) from public;
grant execute on function public.complete_and_archive_work_item(uuid, text) to authenticated;
