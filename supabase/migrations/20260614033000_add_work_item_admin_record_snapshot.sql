-- Store a full work-item snapshot when sending completed work items to Admin Records.

alter table public.work_item_admin_records
add column if not exists snapshot_json jsonb;

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
    notes,
    snapshot_json
  ) values (
    item.id,
    item.title,
    item.module,
    item.department_id,
    item.ngo_id,
    auth.uid(),
    coalesce(item.completed_at, now()),
    coalesce(_notes, 'Completed and sent to admin records'),
    _notes,
    to_jsonb(item)
  )
  on conflict (work_item_id) do update
  set title = excluded.title,
      module = excluded.module,
      department_id = excluded.department_id,
      ngo_id = excluded.ngo_id,
      completed_by_user_id = excluded.completed_by_user_id,
      completed_at = excluded.completed_at,
      archive_reason = excluded.archive_reason,
      notes = excluded.notes,
      snapshot_json = excluded.snapshot_json;

  return item;
end;
$$;

revoke all on function public.complete_work_item_for_admin_records(uuid, text) from public;
grant execute on function public.complete_work_item_for_admin_records(uuid, text) to authenticated;
