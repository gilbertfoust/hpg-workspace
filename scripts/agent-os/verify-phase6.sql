-- HPG Agent OS Phase 6 production verification
-- Run as an authorized internal test user. This script is read-only.

\set ON_ERROR_STOP on

select *
from public.agent_os_phase6_dashboard;

select
  profile_key,
  display_name,
  lead_agent_name,
  accountable_human_role,
  health_status,
  capacity_score,
  risk_score,
  decision_pressure_score,
  open_work_count,
  overdue_work_count,
  unowned_due_seven_days_count,
  active_alert_count,
  active_assignment_count,
  active_board_count,
  agent_count,
  trend_direction,
  as_of
from public.agent_os_phase6_department_command
order by
  case health_status
    when 'critical' then 5
    when 'high_risk' then 4
    when 'action_required' then 3
    when 'watch' then 2
    else 1
  end desc,
  risk_score desc;

select
  decision_reference,
  source_type,
  category,
  severity_key,
  priority_score,
  status,
  title,
  recommended_option_key,
  prepared_by_agent_name,
  requested_by_agent_name,
  decision_authority_name,
  decision_required_by,
  option_count,
  evidence_count,
  position_count,
  dissent_count,
  event_count
from public.agent_os_phase6_decision_queue
where status in ('queued','under_review','returned_for_evidence','deferred')
order by priority_score desc, decision_required_by nulls last;

select
  scenario_key,
  title,
  assertion_count,
  passed_assertion_count,
  failed_assertion_count,
  passed,
  completed_at
from public.agent_os_phase6_validation_results
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
from public.agent_os_phase6_governance
order by sort_order;

select *
from public.agent_os_phase6_native_cutover;

select
  run_key,
  run_mode,
  status,
  source_work_item_count,
  assignment_count,
  assignments_created,
  assignments_updated,
  assignments_closed,
  snapshot_count,
  decision_candidates,
  decisions_created,
  decisions_updated,
  brief_count,
  external_side_effect_count,
  authoritative_source_mutation_count,
  completed_at
from public.agent_os_phase6_refresh_history
order by started_at desc
limit 20;

do $$
declare
  v_dashboard record;
  v_cutover record;
  v_phase6_tables text[] := array[
    'agent_workspace_programs',
    'agent_workspace_department_profiles',
    'agent_workspace_board_bindings',
    'agent_workspace_refresh_runs',
    'agent_workspace_assignments',
    'agent_workspace_department_snapshots',
    'executive_briefs',
    'executive_decision_items',
    'executive_decision_options',
    'executive_decision_evidence',
    'executive_decision_positions',
    'executive_decision_events',
    'agent_workspace_scenarios',
    'agent_workspace_validation_runs',
    'agent_workspace_assertions',
    'agent_workspace_governance_gates'
  ];
  v_phase6_views text[] := array[
    'agent_os_phase6_dashboard',
    'agent_os_phase6_department_command',
    'agent_os_phase6_agent_work_queue',
    'agent_os_phase6_executive_briefs',
    'agent_os_phase6_decision_queue',
    'agent_os_phase6_decision_options',
    'agent_os_phase6_decision_evidence',
    'agent_os_phase6_decision_positions',
    'agent_os_phase6_decision_events',
    'agent_os_phase6_refresh_history',
    'agent_os_phase6_validation_results',
    'agent_os_phase6_governance',
    'agent_os_phase6_board_coverage',
    'agent_os_phase6_native_cutover'
  ];
  v_source_work_count integer;
  v_assignment_count integer;
  v_duplicate_assignment_count integer;
  v_invalid_assignment_hash_count integer;
  v_snapshot_count integer;
  v_snapshot_open_count integer;
  v_snapshot_score_failure_count integer;
  v_uncovered_snapshot_count integer;
  v_active_decision_count integer;
  v_decision_option_failure_count integer;
  v_decision_evidence_failure_count integer;
  v_decision_position_failure_count integer;
  v_decision_precedent_failure_count integer;
  v_decision_hash_failure_count integer;
  v_decision_authority_failure_count integer;
  v_event_hash_failure_count integer;
  v_broken_event_chain_count integer;
  v_brief_count integer;
  v_brief_integrity_failure_count integer;
  v_scenario_count integer;
  v_passed_scenario_count integer;
  v_assertion_count integer;
  v_failed_assertion_count integer;
  v_automated_gate_count integer;
  v_automated_gate_passed integer;
  v_human_gate_count integer;
  v_human_gate_pending integer;
  v_human_work_item_count integer;
  v_failed_gate_count integer;
  v_latest_refresh_failure_count integer;
  v_latest_validation_failure_count integer;
  v_schedule_count integer;
  v_schedule_success_count integer;
  v_table_count integer;
  v_rls_count integer;
  v_policy_count integer;
  v_anon_read_count integer;
  v_authenticated_write_count integer;
  v_invoker_view_count integer;
  v_public_definer_rpc_count integer;
  v_anon_rpc_count integer;
  v_external_flag_failure_count integer;
begin
  select * into strict v_dashboard
  from public.agent_os_phase6_dashboard;

  select * into strict v_cutover
  from public.agent_os_phase6_native_cutover;

  if v_dashboard.program_status not in ('ready_for_human_review','pilot','active') then
    raise exception 'Unexpected Phase 6 program status: %',v_dashboard.program_status;
  end if;
  if not v_dashboard.native_workspace_authoritative
     or not v_dashboard.department_snapshots_enabled
     or not v_dashboard.decision_packet_generation_enabled
     or not v_dashboard.scheduled_refresh_enabled then
    raise exception 'One or more required Phase 6 operating controls are disabled';
  end if;
  if v_dashboard.refresh_frequency_minutes<>30
     or not coalesce(v_dashboard.schedule_active,false)
     or v_dashboard.schedule_expression<>'*/30 * * * *' then
    raise exception 'Unexpected Phase 6 refresh schedule: % minutes / %',
      v_dashboard.refresh_frequency_minutes,v_dashboard.schedule_expression;
  end if;

  select count(*)::int into v_external_flag_failure_count
  from public.agent_workspace_programs
  where program_key='phase6-workspace-native-command-v1'
    and (
      trello_operational_enabled
      or external_actions_enabled
      or autonomous_decisions_enabled
      or source_mutations_enabled
      or assignment_execution_enabled
    );
  if v_external_flag_failure_count<>0 then
    raise exception 'A prohibited Phase 6 execution or external-action flag is enabled';
  end if;

  if v_cutover.total_agent_count<>77
     or v_cutover.historical_only_trello_agent_count<>77
     or v_cutover.agents_with_workspace_routes<>77 then
    raise exception 'Agent cutover mismatch: total %, historical-only %, routes %',
      v_cutover.total_agent_count,
      v_cutover.historical_only_trello_agent_count,
      v_cutover.agents_with_workspace_routes;
  end if;
  if v_cutover.native_agent_work_board_count<>13 then
    raise exception 'Expected 13 native agent-work boards, found %',v_cutover.native_agent_work_board_count;
  end if;
  if v_cutover.active_native_board_count<>v_cutover.active_board_binding_count then
    raise exception 'Native board binding mismatch: % boards / % bindings',
      v_cutover.active_native_board_count,v_cutover.active_board_binding_count;
  end if;
  if v_cutover.trello_synced_work_item_count<>0 or v_cutover.active_trello_queue_count<>0 then
    raise exception 'Trello retains operational activity: % synced work items / % queue items',
      v_cutover.trello_synced_work_item_count,v_cutover.active_trello_queue_count;
  end if;

  if (select count(*) from public.agent_workspace_department_profiles
      where program_key='phase6-workspace-native-command-v1' and is_active)<>13 then
    raise exception 'Expected 13 active Phase 6 department profiles';
  end if;
  if exists(
    select 1
    from public.agent_workspace_department_profiles profile
    left join public.agent_definitions agent on agent.agent_key=profile.lead_agent_key
    left join public.workspace_board_registry board on board.board_key=profile.virtual_board_key
    where profile.program_key='phase6-workspace-native-command-v1'
      and profile.is_active
      and (
        agent.agent_key is null
        or board.board_key is null
        or not board.is_active
        or profile.workspace_route is null
        or profile.accountable_human_role is null
      )
  ) then
    raise exception 'A Phase 6 department profile has an unresolved agent, board, route, or human authority';
  end if;
  if exists(
    select 1
    from public.workspace_board_registry board
    where board.is_active
      and not exists(
        select 1
        from public.agent_workspace_board_bindings binding
        where binding.board_key=board.board_key and binding.binding_status='active'
      )
  ) then
    raise exception 'An active Workspace board lacks a Phase 6 binding';
  end if;

  select count(*)::int into v_source_work_count
  from public.work_items work
  join public.agent_workspace_department_profiles profile
    on profile.module_key=work.module and profile.is_active
  where work.deleted_at is null
    and work.archived_at is null
    and lower(coalesce(work.status,'')) not in (
      'complete','completed','canceled','cancelled','approved','rejected','closed'
    );

  select count(*)::int into v_assignment_count
  from public.agent_workspace_assignments assignment
  where not assignment.is_synthetic
    and assignment.assignment_status not in ('completed','withdrawn','superseded');

  if v_assignment_count<>v_source_work_count then
    raise exception 'Assignment coverage mismatch: % assignments / % active mapped work items',
      v_assignment_count,v_source_work_count;
  end if;

  select count(*)::int into v_duplicate_assignment_count
  from (
    select work_item_id
    from public.agent_workspace_assignments
    group by work_item_id
    having count(*)>1
  ) duplicate_assignments;
  if v_duplicate_assignment_count<>0 then
    raise exception 'Found % work items with duplicate Phase 6 assignments',v_duplicate_assignment_count;
  end if;

  select count(*)::int into v_invalid_assignment_hash_count
  from public.agent_workspace_assignments
  where length(source_snapshot_sha256)<>64;
  if v_invalid_assignment_hash_count<>0 then
    raise exception 'Found % assignments with invalid source hashes',v_invalid_assignment_hash_count;
  end if;

  select count(*)::int,
         coalesce(sum(open_work_count),0)::int,
         count(*) filter(
           where capacity_score<0 or capacity_score>100
              or risk_score<0 or risk_score>100
              or decision_pressure_score<0 or decision_pressure_score>100
         )::int,
         count(*) filter(where active_board_count<1 or agent_count<1)::int
    into v_snapshot_count,v_snapshot_open_count,v_snapshot_score_failure_count,v_uncovered_snapshot_count
  from public.agent_workspace_department_snapshots
  where refresh_run_id=v_dashboard.last_refresh_run_id and not is_synthetic;

  if v_snapshot_count<>13 then
    raise exception 'Expected 13 latest department snapshots, found %',v_snapshot_count;
  end if;
  if v_snapshot_open_count<>v_source_work_count then
    raise exception 'Department snapshot reconciliation mismatch: % snapshot open / % source open',
      v_snapshot_open_count,v_source_work_count;
  end if;
  if v_snapshot_score_failure_count<>0 or v_uncovered_snapshot_count<>0 then
    raise exception 'Department snapshot controls failed: % score failures / % uncovered departments',
      v_snapshot_score_failure_count,v_uncovered_snapshot_count;
  end if;

  select count(*)::int into v_active_decision_count
  from public.executive_decision_items
  where not is_synthetic
    and status in ('queued','under_review','returned_for_evidence','deferred');

  if v_active_decision_count<1 then
    raise exception 'No active Phase 6 executive decision packets are available';
  end if;

  select count(*)::int into v_decision_option_failure_count
  from public.executive_decision_items item
  where not item.is_synthetic
    and item.status in ('queued','under_review','returned_for_evidence','deferred')
    and (
      (select count(*) from public.executive_decision_options option
       where option.decision_item_id=item.id)<2
      or not exists(
        select 1 from public.executive_decision_options option
        where option.decision_item_id=item.id and option.is_recommended
      )
    );

  select count(*)::int into v_decision_evidence_failure_count
  from public.executive_decision_items item
  where not item.is_synthetic
    and item.status in ('queued','under_review','returned_for_evidence','deferred')
    and not exists(
      select 1
      from public.executive_decision_evidence evidence
      where evidence.decision_item_id=item.id
        and evidence.is_primary
        and length(evidence.evidence_sha256)=64
    );

  select count(*)::int into v_decision_position_failure_count
  from public.executive_decision_items item
  where not item.is_synthetic
    and item.status in ('queued','under_review','returned_for_evidence','deferred')
    and not exists(
      select 1
      from public.executive_decision_positions position
      where position.decision_item_id=item.id
        and position.position_type='recommend'
        and position.agent_key='hpg-aos-001'
    );

  select count(*)::int into v_decision_precedent_failure_count
  from public.executive_decision_items item
  where not item.is_synthetic
    and item.status in ('queued','under_review','returned_for_evidence','deferred')
    and not exists(
      select 1
      from public.executive_decision_evidence evidence
      where evidence.decision_item_id=item.id
        and evidence.evidence_type in ('institutional_memory','precedent','limitation')
    );

  select count(*)::int into v_decision_hash_failure_count
  from public.executive_decision_items
  where length(decision_fingerprint)<>64
     or length(source_snapshot_sha256)<>64
     or length(packet_sha256)<>64;

  select count(*)::int into v_decision_authority_failure_count
  from public.executive_decision_items item
  join public.agent_workspace_programs program on program.program_key=item.program_key
  where not item.is_synthetic
    and (
      item.prepared_by_agent_key<>'hpg-aos-001'
      or item.decision_authority_user_id<>program.executive_authority_user_id
      or item.external_action_requested
      or item.autonomous_execution_enabled
      or (item.decided_by_user_id is not null and item.decided_by_user_id<>program.executive_authority_user_id)
    );

  if v_decision_option_failure_count
     + v_decision_evidence_failure_count
     + v_decision_position_failure_count
     + v_decision_precedent_failure_count
     + v_decision_hash_failure_count
     + v_decision_authority_failure_count<>0 then
    raise exception 'Decision packet failures: options %, evidence %, Noemi position %, precedent/limitation %, hashes %, authority %',
      v_decision_option_failure_count,
      v_decision_evidence_failure_count,
      v_decision_position_failure_count,
      v_decision_precedent_failure_count,
      v_decision_hash_failure_count,
      v_decision_authority_failure_count;
  end if;

  select count(*)::int into v_event_hash_failure_count
  from public.executive_decision_events
  where length(event_sha256)<>64
     or (previous_event_sha256 is not null and length(previous_event_sha256)<>64);

  with ordered_events as (
    select
      decision_item_id,
      previous_event_sha256,
      lag(event_sha256) over(
        partition by decision_item_id
        order by created_at,id
      ) as expected_previous
    from public.executive_decision_events
  )
  select count(*)::int into v_broken_event_chain_count
  from ordered_events
  where previous_event_sha256 is distinct from expected_previous;

  if v_event_hash_failure_count<>0 or v_broken_event_chain_count<>0 then
    raise exception 'Decision event-chain failure: % invalid hashes / % broken links',
      v_event_hash_failure_count,v_broken_event_chain_count;
  end if;

  select count(*)::int,
         count(*) filter(
           where prepared_by_agent_key<>'hpg-aos-001'
              or executive_authority_user_id<>v_dashboard.executive_authority_user_id
              or length(source_snapshot_sha256)<>64
              or length(packet_sha256)<>64
              or external_action_count<>0
              or authoritative_source_mutation_count<>0
         )::int
    into v_brief_count,v_brief_integrity_failure_count
  from public.executive_briefs
  where refresh_run_id=v_dashboard.last_refresh_run_id and not is_synthetic;

  if v_brief_count<>1 or v_brief_integrity_failure_count<>0 then
    raise exception 'Latest Noemi brief failed integrity checks: % briefs / % failures',
      v_brief_count,v_brief_integrity_failure_count;
  end if;

  select count(*)::int,
         count(*) filter(where passed)::int,
         coalesce(sum(assertion_count),0)::int,
         coalesce(sum(failed_assertion_count),0)::int
    into v_scenario_count,v_passed_scenario_count,v_assertion_count,v_failed_assertion_count
  from public.agent_os_phase6_validation_results;

  if v_scenario_count<>8
     or v_passed_scenario_count<>8
     or v_assertion_count<32
     or v_failed_assertion_count<>0 then
    raise exception 'Phase 6 validation failed: %/% scenarios, % assertions, % failed assertions',
      v_passed_scenario_count,v_scenario_count,v_assertion_count,v_failed_assertion_count;
  end if;

  select
    count(*) filter(where gate_group in ('automated','security'))::int,
    count(*) filter(
      where gate_group in ('automated','security') and gate_status in ('passed','waived')
    )::int,
    count(*) filter(where gate_group='human')::int,
    count(*) filter(where gate_group='human' and gate_status='pending')::int,
    count(*) filter(where gate_group='human' and work_item_id is not null)::int,
    count(*) filter(where gate_status='failed')::int
  into
    v_automated_gate_count,
    v_automated_gate_passed,
    v_human_gate_count,
    v_human_gate_pending,
    v_human_work_item_count,
    v_failed_gate_count
  from public.agent_os_phase6_governance;

  if v_automated_gate_count<>21
     or v_automated_gate_passed<>21
     or v_human_gate_count<>8
     or v_human_work_item_count<>8
     or v_failed_gate_count<>0 then
    raise exception 'Unexpected governance state: automated %/%, human %, pending %, work items %, failed %',
      v_automated_gate_passed,
      v_automated_gate_count,
      v_human_gate_count,
      v_human_gate_pending,
      v_human_work_item_count,
      v_failed_gate_count;
  end if;

  select count(*)::int into v_latest_refresh_failure_count
  from public.agent_workspace_refresh_runs
  where id=v_dashboard.last_refresh_run_id
    and (
      status<>'passed'
      or external_side_effect_count<>0
      or authoritative_source_mutation_count<>0
      or coalesce((metadata->>'source_marker_unchanged')::boolean,false)=false
    );
  if v_latest_refresh_failure_count<>0 then
    raise exception 'The latest Phase 6 refresh failed its integrity boundary';
  end if;

  select count(*)::int into v_latest_validation_failure_count
  from public.agent_workspace_validation_runs
  where id=v_dashboard.last_validation_run_id
    and (
      status<>'passed'
      or external_side_effect_count<>0
      or authoritative_source_mutation_count<>0
      or not source_fingerprint_unchanged
    );
  if v_latest_validation_failure_count<>0 then
    raise exception 'The latest Phase 6 validation failed its integrity boundary';
  end if;

  select count(*)::int into v_schedule_count
  from cron.job
  where jobname='agent-os-phase6-refresh-30m'
    and schedule='*/30 * * * *'
    and command='select agent_runtime.phase6_run_scheduled_refresh();'
    and active;
  if v_schedule_count<>1 then
    raise exception 'Expected one protected Phase 6 cron job, found %',v_schedule_count;
  end if;

  select count(*)::int into v_schedule_success_count
  from cron.job_run_details
  where jobid=(select jobid from cron.job where jobname='agent-os-phase6-refresh-30m' limit 1)
    and status='succeeded';
  if v_schedule_success_count<1 then
    raise exception 'The protected Phase 6 schedule has not completed successfully';
  end if;

  select
    count(*)::int,
    count(*) filter(where class.relrowsecurity)::int,
    count(*) filter(where coalesce(policy.policy_count,0)>0)::int,
    count(*) filter(
      where has_table_privilege(
        'anon',format('%I.%I',namespace.nspname,class.relname),'SELECT'
      )
    )::int,
    count(*) filter(
      where has_table_privilege(
        'authenticated',format('%I.%I',namespace.nspname,class.relname),'INSERT'
      )
         or has_table_privilege(
           'authenticated',format('%I.%I',namespace.nspname,class.relname),'UPDATE'
         )
         or has_table_privilege(
           'authenticated',format('%I.%I',namespace.nspname,class.relname),'DELETE'
         )
    )::int
  into
    v_table_count,
    v_rls_count,
    v_policy_count,
    v_anon_read_count,
    v_authenticated_write_count
  from pg_class class
  join pg_namespace namespace on namespace.oid=class.relnamespace
  left join (
    select schemaname,tablename,count(*)::int as policy_count
    from pg_policies
    group by schemaname,tablename
  ) policy
    on policy.schemaname=namespace.nspname and policy.tablename=class.relname
  where namespace.nspname='public'
    and class.relkind='r'
    and class.relname=any(v_phase6_tables);

  if v_table_count<>cardinality(v_phase6_tables)
     or v_rls_count<>cardinality(v_phase6_tables)
     or v_policy_count<>cardinality(v_phase6_tables) then
    raise exception 'Phase 6 RLS coverage failed: tables %, RLS %, policies %',
      v_table_count,v_rls_count,v_policy_count;
  end if;
  if v_anon_read_count<>0 then
    raise exception 'Anonymous SELECT exists on % Phase 6 tables',v_anon_read_count;
  end if;
  if v_authenticated_write_count<>0 then
    raise exception 'Authenticated direct writes exist on % Phase 6 tables',v_authenticated_write_count;
  end if;

  select count(*)::int into v_invoker_view_count
  from pg_class class
  join pg_namespace namespace on namespace.oid=class.relnamespace
  where namespace.nspname='public'
    and class.relkind='v'
    and class.relname=any(v_phase6_views)
    and coalesce(array_to_string(class.reloptions,','),'') like '%security_invoker=true%';
  if v_invoker_view_count<>cardinality(v_phase6_views) then
    raise exception 'Expected % invoker-security Phase 6 views, found %',
      cardinality(v_phase6_views),v_invoker_view_count;
  end if;

  select count(*)::int into v_public_definer_rpc_count
  from pg_proc function
  join pg_namespace namespace on namespace.oid=function.pronamespace
  where namespace.nspname='public'
    and function.proname like 'agent_os_phase6_%'
    and function.prosecdef;

  select count(*)::int into v_anon_rpc_count
  from pg_proc function
  join pg_namespace namespace on namespace.oid=function.pronamespace
  where namespace.nspname='public'
    and function.proname like 'agent_os_phase6_%'
    and has_function_privilege('anon',function.oid,'EXECUTE');

  if v_public_definer_rpc_count<>0 or v_anon_rpc_count<>0 then
    raise exception 'Phase 6 public RPC exposure failed: definer %, anonymous executable %',
      v_public_definer_rpc_count,v_anon_rpc_count;
  end if;

  if not (
    select position('phase6_is_ceo_internal' in pg_get_functiondef(function.oid))>0
    from pg_proc function
    join pg_namespace namespace on namespace.oid=function.pronamespace
    where namespace.nspname='agent_runtime'
      and function.proname='phase6_record_decision_internal'
    limit 1
  ) then
    raise exception 'The governed decision runtime does not contain the CEO authority guard';
  end if;

  raise notice 'Phase 6 verification passed: 13 department workspaces, 77 native-routed agents, % active boards and bindings, % active assignments, 13 reconciled snapshots, % active executive decisions, one latest Noemi brief, 8 scenarios, % assertions, 21 automated/security gates, 8 human gates, protected thirty-minute refresh, zero external effects, and zero authoritative source mutations.',
    v_cutover.active_native_board_count,
    v_assignment_count,
    v_active_decision_count,
    v_assertion_count;
end;
$$;
