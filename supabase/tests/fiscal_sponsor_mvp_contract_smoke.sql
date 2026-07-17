\set ON_ERROR_STOP on

begin;

-- Static contract smoke test for the Fiscal Sponsor OS MVP migration. Persona
-- and integration behavior is covered by the production verification matrix;
-- this test fails fast when a required database contract was not deployed.
do $$
declare
  missing_contracts text[] := '{}';
begin
  if to_regprocedure('public.save_form_draft(uuid,jsonb,uuid,uuid,smallint)') is null then
    missing_contracts := array_append(missing_contracts, 'save_form_draft');
  end if;
  if to_regprocedure('public.submit_form_submission_atomic(uuid,jsonb,uuid,uuid,text)') is null then
    missing_contracts := array_append(missing_contracts, 'submit_form_submission_atomic');
  end if;
  if to_regprocedure('public.get_my_queue_work_items()') is null then
    missing_contracts := array_append(missing_contracts, 'get_my_queue_work_items');
  end if;
  if to_regprocedure('public.get_my_staff_dashboard()') is null then
    missing_contracts := array_append(missing_contracts, 'get_my_staff_dashboard');
  end if;
  if to_regprocedure('public.admin_soft_delete_work_item(uuid,text)') is null then
    missing_contracts := array_append(missing_contracts, 'admin_soft_delete_work_item');
  end if;
  if to_regprocedure('public.create_finance_account(text,text,public.finance_account_type,text,uuid,public.finance_normal_balance,boolean,boolean,text,text,text,text,text)') is null then
    missing_contracts := array_append(missing_contracts, 'create_finance_account');
  end if;

  if cardinality(missing_contracts) > 0 then
    raise exception 'Missing MVP functions: %', array_to_string(missing_contracts, ', ');
  end if;
end $$;

do $$
declare
  missing_columns text[] := '{}';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'form_submissions'
      and column_name = 'draft_progress'
  ) then missing_columns := array_append(missing_columns, 'form_submissions.draft_progress'); end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_items'
      and column_name = 'last_external_sync_at'
  ) then missing_columns := array_append(missing_columns, 'work_items.last_external_sync_at'); end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trello_route_mappings'
      and column_name = 'completed_list_id'
  ) then missing_columns := array_append(missing_columns, 'trello_route_mappings.completed_list_id'); end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'preferred_language'
  ) then missing_columns := array_append(missing_columns, 'profiles.preferred_language'); end if;

  if cardinality(missing_columns) > 0 then
    raise exception 'Missing MVP columns: %', array_to_string(missing_columns, ', ');
  end if;
end $$;

do $$
declare
  missing_tables text[] := '{}';
begin
  if to_regclass('public.department_memberships') is null then
    missing_tables := array_append(missing_tables, 'department_memberships');
  end if;
  if to_regclass('public.work_item_assignees') is null then
    missing_tables := array_append(missing_tables, 'work_item_assignees');
  end if;
  if to_regclass('public.integration_webhook_events') is null then
    missing_tables := array_append(missing_tables, 'integration_webhook_events');
  end if;
  if to_regclass('public.trello_member_mappings') is null then
    missing_tables := array_append(missing_tables, 'trello_member_mappings');
  end if;
  if to_regclass('public.system_usage_monthly_reports') is null then
    missing_tables := array_append(missing_tables, 'system_usage_monthly_reports');
  end if;

  if cardinality(missing_tables) > 0 then
    raise exception 'Missing MVP tables: %', array_to_string(missing_tables, ', ');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'work_items'
      and policyname = 'Scoped work item read'
  ) then raise exception 'Scoped work item read policy is missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions'
      and policyname = 'Private drafts and routed submitted forms'
  ) then raise exception 'Private form policy is missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'trg_route_ngo_portal_document_upload'
      and not tgisinternal
  ) then raise exception 'NGO portal document routing trigger is missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.work_items'::regclass
      and tgname = 'trg_queue_workspace_work_item_trello_update'
      and not tgisinternal
  ) then raise exception 'Trello update queue trigger is missing'; end if;
end $$;

rollback;
