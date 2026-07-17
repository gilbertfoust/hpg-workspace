\set ON_ERROR_STOP on

begin;

do $$
declare
  missing text[] := '{}';
  actor_id uuid;
  target_module public.module_type;
  template_row public.form_templates;
  result_json jsonb;
  submission_id uuid;
  work_item_id uuid;
  work_status text;
  work_priority text;
  reviewed_status text;
begin
  if to_regclass('public.form_template_versions') is null then missing := array_append(missing, 'form_template_versions'); end if;
  if to_regclass('public.form_assignments') is null then missing := array_append(missing, 'form_assignments'); end if;
  if to_regprocedure('public.admin_upsert_form_template(uuid,text,public.module_type,text,jsonb,jsonb,text,public.module_type,boolean)') is null then missing := array_append(missing, 'admin_upsert_form_template'); end if;
  if to_regprocedure('public.validate_form_payload(uuid,jsonb,boolean)') is null then missing := array_append(missing, 'validate_form_payload'); end if;
  if to_regprocedure('public.link_form_assignment_submission(uuid,uuid)') is null then missing := array_append(missing, 'link_form_assignment_submission'); end if;
  if to_regprocedure('public.review_form_submission(uuid,text,text)') is null then missing := array_append(missing, 'review_form_submission'); end if;
  if to_regprocedure('public.create_form_revision(uuid)') is null then missing := array_append(missing, 'create_form_revision'); end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='form_submission_id'
  ) then missing := array_append(missing, 'documents.form_submission_id'); end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='form_submissions' and column_name='assignment_id'
  ) then missing := array_append(missing, 'form_submissions.assignment_id'); end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.form_submissions'::regclass
      and tgname='trg_enforce_form_payload_before_submit' and not tgisinternal
  ) then missing := array_append(missing, 'trg_enforce_form_payload_before_submit'); end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.work_items'::regclass
      and tgname='trg_normalize_work_item_labels' and not tgisinternal
  ) then missing := array_append(missing, 'trg_normalize_work_item_labels'); end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='form_assignments'
      and policyname='Authorized users read form assignments'
  ) then missing := array_append(missing, 'form_assignments RLS'); end if;

  if cardinality(missing) > 0 then
    raise exception 'Forms 100 contracts missing: %', array_to_string(missing, ', ');
  end if;

  -- Exercise the production transaction without retaining test records.
  select id into actor_id
  from public.profiles
  where role = 'super_admin'
  order by created_at
  limit 1;
  if actor_id is null then raise exception 'Forms 100 smoke requires a super_admin profile'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text, true);

  select ft.module into target_module
  from public.form_templates ft
  where ft.is_active and public.resolve_work_item_department(ft.module::text) is not null
  order by ft.created_at
  limit 1;
  if target_module is null then raise exception 'Forms 100 smoke requires one configured department route'; end if;

  select * into template_row
  from public.admin_upsert_form_template(
    null,
    'Forms 100 transactional smoke ' || txid_current()::text,
    target_module,
    'Rolled back automatically',
    '{"fields":[{"name":"summary","label":"Summary","type":"text","required":true}]}'::jsonb,
    '{}'::jsonb,
    'staff',
    target_module,
    true
  );

  if (public.validate_form_payload(template_row.id, '{}'::jsonb, true)->>'valid')::boolean then
    raise exception 'Required-field validation did not reject an incomplete submit';
  end if;
  if not (public.validate_form_payload(template_row.id, '{}'::jsonb, false)->>'valid')::boolean then
    raise exception 'Draft validation incorrectly rejected an incomplete private draft';
  end if;

  result_json := public.submit_form_submission_atomic(
    template_row.id,
    '{"summary":"Transactional Forms 100 verification","priority":"medium"}'::jsonb,
    null,
    null,
    'forms-100-smoke-' || txid_current()::text
  );
  submission_id := (result_json #>> '{submission,id}')::uuid;
  work_item_id := (result_json #>> '{work_item,id}')::uuid;

  select status, priority into work_status, work_priority
  from public.work_items where id = work_item_id;
  if work_status <> 'Not Started' or work_priority <> 'Med' then
    raise exception 'Work-item normalization failed: status %, priority %', work_status, work_priority;
  end if;
  if (select count(*) from public.work_items where source_system='form_submission' and source_event_id=submission_id::text) <> 1 then
    raise exception 'Submit did not create exactly one department work item';
  end if;

  perform public.review_form_submission(submission_id, 'accepted', 'Forms 100 smoke accepted');
  select status into reviewed_status from public.work_items where id = work_item_id;
  if reviewed_status <> 'Complete' then
    raise exception 'Accepted form did not complete its work item: %', reviewed_status;
  end if;
end $$;

rollback;
