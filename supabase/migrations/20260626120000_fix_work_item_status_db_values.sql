-- Align archive/complete RPCs with work_items_status_check (Title Case values).

CREATE OR REPLACE FUNCTION public.archive_work_item(_work_item_id uuid, _reason text DEFAULT 'Archived by user')
RETURNS public.work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived public.work_items;
BEGIN
  UPDATE public.work_items
  SET status = 'Canceled',
      archived_at = now(),
      archived_by_user_id = auth.uid(),
      archive_reason = coalesce(_reason, 'Archived by user'),
      updated_at = now()
  WHERE id = _work_item_id
    AND (
      owner_user_id = auth.uid()
      OR created_by_user_id = auth.uid()
      OR public.is_management()
      OR public.is_internal_user()
    )
  RETURNING * INTO archived;

  IF archived.id IS NULL THEN
    RAISE EXCEPTION 'Work item not found or access denied';
  END IF;

  RETURN archived;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_work_item_for_admin_records(_work_item_id uuid, _notes text DEFAULT NULL)
RETURNS public.work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.work_items;
  resolved_department_id uuid;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Internal staff access required';
  END IF;

  UPDATE public.work_items
  SET status = 'Complete',
      completed_at = COALESCE(completed_at, now()),
      archived_at = COALESCE(archived_at, now()),
      archived_by_user_id = COALESCE(archived_by_user_id, auth.uid()),
      archive_reason = COALESCE(_notes, 'Completed and sent to admin records'),
      updated_at = now()
  WHERE id = _work_item_id
  RETURNING * INTO item;

  IF item.id IS NULL THEN
    RAISE EXCEPTION 'Work item not found';
  END IF;

  resolved_department_id := item.department_id;
  IF resolved_department_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.org_units ou WHERE ou.id = resolved_department_id) THEN
    resolved_department_id := NULL;
  END IF;

  INSERT INTO public.work_item_admin_records (
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
  ) VALUES (
    item.id,
    item.title,
    item.module,
    resolved_department_id,
    item.ngo_id,
    auth.uid(),
    COALESCE(item.completed_at, now()),
    COALESCE(_notes, 'Completed and sent to admin records'),
    _notes,
    to_jsonb(item)
  )
  ON CONFLICT (work_item_id) DO UPDATE
  SET title = EXCLUDED.title,
      module = EXCLUDED.module,
      department_id = EXCLUDED.department_id,
      ngo_id = EXCLUDED.ngo_id,
      completed_by_user_id = EXCLUDED.completed_by_user_id,
      completed_at = EXCLUDED.completed_at,
      archive_reason = EXCLUDED.archive_reason,
      notes = EXCLUDED.notes,
      snapshot_json = EXCLUDED.snapshot_json;

  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_work_item(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_work_item(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_work_item_for_admin_records(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_work_item_for_admin_records(uuid, text) TO authenticated;
