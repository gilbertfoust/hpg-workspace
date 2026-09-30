-- Restore self-service staff summaries without granting access to the personnel table.
-- Definitions were captured from production before this targeted repair.
CREATE OR REPLACE FUNCTION private.hr_my_staff_activity_profiles()
RETURNS TABLE(id uuid, user_id uuid, status text, updated_at timestamptz, timezone text, first_name text, last_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.hr_timekeeping_user_active(),false) THEN
    RAISE EXCEPTION 'Active workspace access required' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT s.id,s.user_id,s.status::text,s.updated_at::timestamptz,s.timezone::text,s.first_name::text,s.last_name::text
  FROM public.staff_profiles s WHERE s.user_id=auth.uid();
END;
$function$;
REVOKE ALL ON FUNCTION private.hr_my_staff_activity_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.hr_my_staff_activity_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_get_workspace_activity_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_staff record;
  v_today date;
begin
  if v_actor is null then raise exception 'Authentication is required'; end if;
  select staff.* into v_staff
  from private.hr_my_staff_activity_profiles() staff
  where staff.user_id = v_actor
  order by (staff.status = 'active') desc, staff.updated_at desc, staff.id
  limit 1;
  v_today := (now() at time zone coalesce(v_staff.timezone, 'UTC'))::date;

  return jsonb_build_object(
    'staff_id', v_staff.id,
    'staff_name', case when v_staff.id is null then null else concat(v_staff.first_name, ' ', v_staff.last_name) end,
    'tracking_eligible', coalesce(v_staff.status = 'active', false),
    'ineligible_reason', case
      when v_staff.id is null then 'No staff profile is linked to this workspace account.'
      when v_staff.status <> 'active' then 'The linked staff profile is not active.'
      else null
    end,
    'today_seconds', coalesce((
      select sum(segment.active_seconds)
      from public.workspace_activity_segments segment
      where segment.user_id = v_actor and segment.activity_date = v_today
    ), 0),
    'week_seconds', coalesce((
      select sum(segment.active_seconds)
      from public.workspace_activity_segments segment
      where segment.user_id = v_actor
        and segment.activity_date between date_trunc('week', v_today::timestamp)::date
                                      and date_trunc('week', v_today::timestamp)::date + 6
    ), 0),
    'unposted_seconds', coalesce((
      select sum(segment.active_seconds - segment.posted_seconds)
      from public.workspace_activity_segments segment
      where segment.user_id = v_actor
    ), 0),
    'last_login_at', (
      select max(session.login_at)
      from public.workspace_activity_sessions session
      where session.user_id = v_actor
    ),
    'last_heartbeat_at', (
      select max(session.last_heartbeat_at)
      from public.workspace_activity_sessions session
      where session.user_id = v_actor
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_staff_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
 v_user uuid:=auth.uid(); v_timezone text; v_today date;
 v_staff_id uuid; v_active integer; v_linked integer;
 v_history_staff_ids uuid[];
 v_profile jsonb; v_open integer; v_overdue integer; v_soon integer;
 v_completed integer; v_created integer; v_completed_cohort integer;
 v_documents integer; v_hours numeric;
BEGIN
 IF v_user IS NULL OR NOT coalesce(public.can_use_my_workspace_home(),false) THEN
   RAISE EXCEPTION 'An active approved workspace member is required' USING ERRCODE='42501';
 END IF;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_timezone_names z WHERE z.name=p.timezone)
             THEN p.timezone ELSE 'UTC' END,
   jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,
     'avatar_url',p.avatar_url,'job_title',p.job_title,'role',p.role,
     'department_id',p.department_id,'department_name',u.department_name,
     'employment_status',p.employment_status,'preferred_language',p.preferred_language,
     'timezone',p.timezone)
 INTO v_timezone,v_profile
 FROM public.profiles p LEFT JOIN public.org_units u ON u.id=p.department_id WHERE p.id=v_user;
 v_today := (now() AT TIME ZONE coalesce(v_timezone,'UTC'))::date;
 SELECT count(*),count(*)FILTER(WHERE status='active'),array_agg(id) INTO v_linked,v_active,v_history_staff_ids
 FROM private.hr_my_staff_activity_profiles() WHERE user_id=v_user;
 IF v_active=1 THEN
   SELECT id INTO v_staff_id FROM private.hr_my_staff_activity_profiles() WHERE user_id=v_user AND status='active'
   ORDER BY(status='active')DESC,updated_at DESC,id LIMIT 1;
 END IF;
 WITH mine AS(
   SELECT w.*,lower(btrim(coalesce(w.status,'')))AS normalized_status
   FROM public.work_items w
   WHERE w.deleted_at IS NULL AND w.archived_at IS NULL
     AND(w.owner_user_id=v_user OR EXISTS(SELECT 1 FROM public.work_item_assignees a
                                          WHERE a.work_item_id=w.id AND a.user_id=v_user))
 )
 SELECT count(*)FILTER(WHERE normalized_status NOT IN('complete','completed','done','canceled','cancelled')),
   count(*)FILTER(WHERE normalized_status NOT IN('complete','completed','done','canceled','cancelled') AND due_date<v_today),
   count(*)FILTER(WHERE normalized_status NOT IN('complete','completed','done','canceled','cancelled') AND due_date BETWEEN v_today AND v_today+7),
   count(*)FILTER(WHERE normalized_status IN('complete','completed','done') AND completed_at>=now()-interval '30 days'),
   count(*)FILTER(WHERE created_at>=now()-interval '30 days'),
   count(*)FILTER(WHERE created_at>=now()-interval '30 days' AND normalized_status IN('complete','completed','done'))
 INTO v_open,v_overdue,v_soon,v_completed,v_created,v_completed_cohort FROM mine;
 SELECT count(*)INTO v_documents FROM public.documents WHERE uploaded_by_user_id=v_user;
 SELECT coalesce(sum(e.hours),0)INTO v_hours
 FROM public.timesheet_entries e JOIN public.timesheets t ON t.id=e.timesheet_id
 WHERE e.staff_id=ANY(v_history_staff_ids) AND t.staff_id=e.staff_id AND e.entry_status='completed'
   AND e.entry_date BETWEEN date_trunc('month',v_today::timestamp)::date AND v_today;
 RETURN jsonb_build_object('profile',coalesce(v_profile,'{}'::jsonb),
  'work',jsonb_build_object('open',v_open,'overdue',v_overdue,'due_soon',v_soon,
    'completed_30_days',v_completed,'created_30_days',v_created,
    'completion_rate_30_days',CASE WHEN v_created=0 THEN 0 ELSE round(v_completed_cohort::numeric/v_created*100,1)END,
    'completion_rate_30_days_basis','work_created_last_30_days'),
  'hr',jsonb_build_object('staff_profile_id',v_staff_id,'hours_current_month',coalesce(v_hours,0)),
  'documents',jsonb_build_object('uploaded',v_documents));
END $function$
;
