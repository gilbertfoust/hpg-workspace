-- HPG Agent OS Phase 5 production verification
-- Run as an authorized internal test user. This script is read-only.

\set ON_ERROR_STOP on

select *
from public.agent_os_phase5_dashboard;

select
  severity_key,
  severity_rank,
  label,
  requires_acknowledgement,
  default_response_minutes,
  default_escalation_minutes,
  executive_visibility
from public.agent_os_phase5_severity_matrix
order by severity_rank;

select
  category,
  count(*)::int as active_rule_count,
  sum(active_alert_count)::int as active_alert_count
from public.agent_os_phase5_rule_library
where is_active
  and rule_status in ('controlled','active')
group by category
order by category;

select
  source_key,
  display_name,
  category,
  source_table,
  owner_agent_name,
  active_rule_count,
  last_source_row_count,
  last_signal_count,
  last_alert_count,
  coverage_status,
  last_scanned_at
from public.agent_os_phase5_source_coverage
order by category, display_name;

select
  alert_reference,
  category,
  severity_key,
  status,
  title,
  owner_agent_name,
  accountable_human_role,
  response_due_at,
  escalation_due_at,
  occurrence_count,
  signal_count,
  event_count
from public.agent_os_phase5_alert_queue
where status in ('open','acknowledged','snoozed','escalated')
order by severity_rank desc, response_due_at nulls last, first_detected_at;

select
  scenario_key,
  title,
  assertion_count,
  passed_assertion_count,
  failed_assertion_count,
  passed,
  completed_at
from public.agent_os_phase5_validation_results
order by sort_order;

select
  gate_key,
  gate_group,
  gate_status,
  required_reviewer_role,
  work_item_status,
  work_item_due_date,
  recorded_by_name,
  recorded_at
from public.agent_os_phase5_governance
order by sort_order;

select
  run_key,
  run_mode,
  status,
  signal_count,
  alerts_created,
  alerts_updated,
  alerts_deduplicated,
  alerts_suppressed,
  alerts_auto_resolved,
  alerts_escalated,
  external_side_effect_count,
  authoritative_mutation_count,
  completed_at
from public.agent_os_phase5_scan_history
order by started_at desc
limit 20;

do $$
declare
  v_dashboard record;
  v_phase5_tables text[] := array[
    'monitoring_programs',
    'monitoring_severity_levels',
    'monitoring_threshold_library',
    'monitoring_source_registry',
    'monitoring_rules',
    'monitoring_runs',
    'monitoring_alerts',
    'monitoring_signals',
    'monitoring_alert_events',
    'monitoring_suppressions',
    'monitoring_escalations',
    'monitoring_scenarios',
    'monitoring_validation_runs',
    'monitoring_assertions',
    'monitoring_governance_gates'
  ];
  v_phase5_views text[] := array[
    'agent_os_phase5_dashboard',
    'agent_os_phase5_alert_queue',
    'agent_os_phase5_rule_library',
    'agent_os_phase5_severity_matrix',
    'agent_os_phase5_threshold_library',
    'agent_os_phase5_source_coverage',
    'agent_os_phase5_scan_history',
    'agent_os_phase5_validation_results',
    'agent_os_phase5_governance',
    'agent_os_phase5_suppressions',
    'agent_os_phase5_escalation_queue',
    'agent_os_phase5_alert_events'
  ];
  v_table_count integer;
  v_rls_count integer;
  v_policy_count integer;
  v_anon_read_count integer;
  v_authenticated_write_count integer;
  v_invoker_view_count integer;
  v_public_definer_rpc_count integer;
  v_anon_rpc_count integer;
  v_severity_count integer;
  v_rule_count integer;
  v_rule_category_count integer;
  v_source_count integer;
  v_source_error_count integer;
  v_unscanned_source_count integer;
  v_threshold_count integer;
  v_threshold_pending_count integer;
  v_scenario_count integer;
  v_passed_scenario_count integer;
  v_assertion_count integer;
  v_failed_assertion_count integer;
  v_automated_gate_count integer;
  v_automated_gate_passed integer;
  v_human_gate_count integer;
  v_human_gate_pending integer;
  v_failed_gate_count integer;
  v_human_work_item_count integer;
  v_invalid_alert_hash_count integer;
  v_invalid_signal_hash_count integer;
  v_invalid_event_hash_count integer;
  v_broken_event_chain_count integer;
  v_active_alert_count integer;
  v_dashboard_active_alert_count integer;
  v_latest_scan_integrity_failures integer;
  v_latest_validation_integrity_failures integer;
  v_schedule_count integer;
  v_schedule_run_success_count integer;
  v_deduplication_evidence_count integer;
  v_external_flag_failure_count integer;
begin
  select * into strict v_dashboard
  from public.agent_os_phase5_dashboard;

  if v_dashboard.program_status not in ('ready_for_human_review','pilot','active') then
    raise exception 'Unexpected Phase 5 program status: %', v_dashboard.program_status;
  end if;
  if not v_dashboard.alert_generation_enabled or not v_dashboard.deadline_engine_enabled then
    raise exception 'Phase 5 alert generation and deadline engine must be enabled';
  end if;
  if not v_dashboard.scheduled_scans_enabled or not coalesce(v_dashboard.schedule_active,false) then
    raise exception 'Phase 5 protected schedule is not active';
  end if;
  if v_dashboard.scan_frequency_minutes<>15 or v_dashboard.schedule_expression<>'*/15 * * * *' then
    raise exception 'Unexpected Phase 5 scan cadence: % minutes / %',
      v_dashboard.scan_frequency_minutes,v_dashboard.schedule_expression;
  end if;

  select count(*)::int into v_external_flag_failure_count
  from public.monitoring_programs
  where program_key='phase5-continuous-monitoring-v1'
    and (work_item_creation_enabled or external_notifications_enabled or autonomous_remediation_enabled);
  if v_external_flag_failure_count<>0 then
    raise exception 'Phase 5 autonomous or external-action flags are enabled';
  end if;

  select count(*)::int,
         count(*) filter(where severity_rank between 1 and 5)::int
    into v_severity_count,v_rls_count
  from public.monitoring_severity_levels
  where is_active;
  if v_severity_count<>5 or v_rls_count<>5 then
    raise exception 'The five-level severity matrix is incomplete';
  end if;
  if exists(
    select 1 from public.monitoring_severity_levels
    where is_active and default_escalation_minutes<default_response_minutes
  ) then
    raise exception 'A Phase 5 escalation deadline precedes its response deadline';
  end if;

  select count(*)::int,count(distinct category)::int
    into v_rule_count,v_rule_category_count
  from public.monitoring_rules
  where program_key='phase5-continuous-monitoring-v1'
    and is_active
    and rule_status in ('controlled','active');
  if v_rule_count<31 or v_rule_category_count<>5 then
    raise exception 'Phase 5 rule library is incomplete: % rules / % categories',
      v_rule_count,v_rule_category_count;
  end if;
  if exists(
    select 1
    from public.monitoring_rules r
    left join public.monitoring_source_registry s on s.source_key=r.source_key
    left join public.agent_definitions a on a.agent_key=r.owner_agent_key
    where r.program_key='phase5-continuous-monitoring-v1'
      and r.is_active
      and (s.source_key is null or not s.is_active or a.agent_key is null)
  ) then
    raise exception 'A Phase 5 rule has an unresolved source or Agent OS owner';
  end if;

  select count(*)::int,
         count(*) filter(where last_error is not null)::int,
         count(*) filter(where last_scanned_at is null)::int
    into v_source_count,v_source_error_count,v_unscanned_source_count
  from public.monitoring_source_registry
  where is_active;
  if v_source_count<>21 or v_source_error_count<>0 or v_unscanned_source_count<>0 then
    raise exception 'Phase 5 source coverage failed: % sources, % errors, % unscanned',
      v_source_count,v_source_error_count,v_unscanned_source_count;
  end if;

  select count(*)::int,
         count(*) filter(where policy_status='draft_pending_human_review')::int
    into v_threshold_count,v_threshold_pending_count
  from public.monitoring_threshold_library
  where is_active;
  if v_threshold_count<14 or v_threshold_pending_count<>v_threshold_count then
    raise exception 'Phase 5 threshold library requires human review: % total / % pending',
      v_threshold_count,v_threshold_pending_count;
  end if;

  select count(*)::int,
         count(*) filter(where passed)::int,
         coalesce(sum(assertion_count),0)::int,
         coalesce(sum(failed_assertion_count),0)::int
    into v_scenario_count,v_passed_scenario_count,v_assertion_count,v_failed_assertion_count
  from public.agent_os_phase5_validation_results;
  if v_scenario_count<>8 or v_passed_scenario_count<>8 or v_assertion_count<29 or v_failed_assertion_count<>0 then
    raise exception 'Phase 5 validation failed: %/% scenarios, % assertions, % failures',
      v_passed_scenario_count,v_scenario_count,v_assertion_count,v_failed_assertion_count;
  end if;

  select count(*) filter(where gate_group in ('automated','security'))::int,
         count(*) filter(where gate_group in ('automated','security') and gate_status in ('passed','waived'))::int,
         count(*) filter(where gate_group='human')::int,
         count(*) filter(where gate_group='human' and gate_status='pending')::int,
         count(*) filter(where gate_status='failed')::int,
         count(*) filter(where gate_group='human' and work_item_id is not null)::int
    into v_automated_gate_count,v_automated_gate_passed,v_human_gate_count,
         v_human_gate_pending,v_failed_gate_count,v_human_work_item_count
  from public.agent_os_phase5_governance;
  if v_automated_gate_count<>16 or v_automated_gate_passed<>16
     or v_human_gate_count<>8 or v_human_work_item_count<>8 or v_failed_gate_count<>0 then
    raise exception 'Unexpected Phase 5 governance state: automated %/%; human %; pending %; work items %; failed %',
      v_automated_gate_passed,v_automated_gate_count,v_human_gate_count,
      v_human_gate_pending,v_human_work_item_count,v_failed_gate_count;
  end if;

  select count(*)::int into v_invalid_alert_hash_count
  from public.monitoring_alerts
  where length(alert_fingerprint)<>64 or length(latest_evidence_sha256)<>64;
  select count(*)::int into v_invalid_signal_hash_count
  from public.monitoring_signals
  where length(evidence_sha256)<>64;
  select count(*)::int into v_invalid_event_hash_count
  from public.monitoring_alert_events
  where length(event_sha256)<>64
     or (previous_event_sha256 is not null and length(previous_event_sha256)<>64);
  if v_invalid_alert_hash_count+v_invalid_signal_hash_count+v_invalid_event_hash_count<>0 then
    raise exception 'Invalid Phase 5 hashes: alerts %, signals %, events %',
      v_invalid_alert_hash_count,v_invalid_signal_hash_count,v_invalid_event_hash_count;
  end if;

  with ordered as (
    select
      alert_id,
      id,
      previous_event_sha256,
      lag(event_sha256) over(partition by alert_id order by created_at,id) as expected_previous
    from public.monitoring_alert_events
  )
  select count(*)::int into v_broken_event_chain_count
  from ordered
  where previous_event_sha256 is distinct from expected_previous;
  if v_broken_event_chain_count<>0 then
    raise exception 'Found % broken Phase 5 alert-event chain links',v_broken_event_chain_count;
  end if;

  select count(*)::int into v_active_alert_count
  from public.monitoring_alerts
  where not is_synthetic and status in ('open','acknowledged','snoozed','escalated');
  select active_alert_count::int into v_dashboard_active_alert_count
  from public.agent_os_phase5_dashboard;
  if v_active_alert_count<>v_dashboard_active_alert_count then
    raise exception 'Phase 5 dashboard alert count mismatch: table % / dashboard %',
      v_active_alert_count,v_dashboard_active_alert_count;
  end if;

  select count(*)::int into v_latest_scan_integrity_failures
  from (
    select * from public.monitoring_runs
    where run_mode in ('scheduled','manual','bootstrap')
    order by started_at desc limit 1
  ) r
  where r.status<>'passed'
     or r.external_side_effect_count<>0
     or r.authoritative_mutation_count<>0
     or coalesce((r.metadata->>'source_marker_unchanged')::boolean,false)=false;
  if v_latest_scan_integrity_failures<>0 then
    raise exception 'The latest Phase 5 production scan failed its integrity boundary';
  end if;

  select count(*)::int into v_latest_validation_integrity_failures
  from public.monitoring_validation_runs
  where id=(select last_validation_run_id from public.monitoring_programs where program_key='phase5-continuous-monitoring-v1')
    and (status<>'passed' or external_side_effect_count<>0 or authoritative_mutation_count<>0 or not source_fingerprint_unchanged);
  if v_latest_validation_integrity_failures<>0 then
    raise exception 'The latest Phase 5 validation failed its integrity boundary';
  end if;

  select count(*)::int into v_schedule_count
  from cron.job
  where jobname='agent-os-phase5-scan-15m'
    and schedule='*/15 * * * *'
    and command='select agent_runtime.phase5_run_scheduled_scan();'
    and active;
  if v_schedule_count<>1 then
    raise exception 'Expected one protected Phase 5 cron job, found %',v_schedule_count;
  end if;
  select count(*)::int into v_schedule_run_success_count
  from cron.job_run_details
  where jobid=(select jobid from cron.job where jobname='agent-os-phase5-scan-15m' limit 1)
    and status='succeeded';
  if v_schedule_run_success_count<1 then
    raise exception 'The protected Phase 5 schedule has not completed successfully';
  end if;

  select count(*)::int into v_deduplication_evidence_count
  from public.monitoring_runs
  where run_mode in ('scheduled','manual','bootstrap')
    and status='passed'
    and alerts_deduplicated>0;
  if v_deduplication_evidence_count<1 then
    raise exception 'No production Phase 5 scan has demonstrated deduplication';
  end if;

  select count(*)::int,
         count(*) filter(where c.relrowsecurity)::int,
         count(*) filter(where coalesce(pol.policy_count,0)>0)::int,
         count(*) filter(where has_table_privilege('anon',format('%I.%I',n.nspname,c.relname),'SELECT'))::int,
         count(*) filter(
           where has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'INSERT')
              or has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'UPDATE')
              or has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'DELETE')
         )::int
    into v_table_count,v_rls_count,v_policy_count,v_anon_read_count,v_authenticated_write_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  left join (
    select schemaname,tablename,count(*)::int policy_count
    from pg_policies
    group by schemaname,tablename
  ) pol on pol.schemaname=n.nspname and pol.tablename=c.relname
  where n.nspname='public' and c.relkind='r' and c.relname=any(v_phase5_tables);

  if v_table_count<>cardinality(v_phase5_tables)
     or v_rls_count<>cardinality(v_phase5_tables)
     or v_policy_count<>cardinality(v_phase5_tables) then
    raise exception 'Phase 5 RLS coverage failed: tables %, RLS %, policies %',
      v_table_count,v_rls_count,v_policy_count;
  end if;
  if v_anon_read_count<>0 then
    raise exception 'Anonymous SELECT exists on % Phase 5 tables',v_anon_read_count;
  end if;
  if v_authenticated_write_count<>0 then
    raise exception 'Authenticated direct writes exist on % Phase 5 tables',v_authenticated_write_count;
  end if;

  select count(*)::int into v_invoker_view_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind='v'
    and c.relname=any(v_phase5_views)
    and coalesce(array_to_string(c.reloptions,','),'') like '%security_invoker=true%';
  if v_invoker_view_count<>cardinality(v_phase5_views) then
    raise exception 'Expected % invoker-security Phase 5 views, found %',
      cardinality(v_phase5_views),v_invoker_view_count;
  end if;

  select count(*)::int into v_public_definer_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'agent_os_phase5_%' and p.prosecdef;
  select count(*)::int into v_anon_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'agent_os_phase5_%'
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_public_definer_rpc_count<>0 or v_anon_rpc_count<>0 then
    raise exception 'Phase 5 public RPC exposure failed: definer %, anonymous executable %',
      v_public_definer_rpc_count,v_anon_rpc_count;
  end if;

  raise notice 'Phase 5 verification passed: % active rules, % monitored sources, % production alerts, % scenarios, % assertions, 16 automated/security gates, 8 human gates, protected fifteen-minute schedule, zero external effects, and zero authoritative source mutations.',
    v_rule_count,v_source_count,v_dashboard.production_alert_count,v_scenario_count,v_assertion_count;
end;
$$;
