-- HPG Agent OS Phase 3 production verification
-- Read-only except for temporary session-local assertions.

\set ON_ERROR_STOP on

select *
from public.agent_os_phase3_dashboard;

select scenario_key,
       passed,
       assertion_count,
       failed_assertion_count,
       stage_run_count,
       handoff_count,
       case_status,
       current_control_stage_key
from public.agent_os_phase3_validation_results
order by sort_order;

select g.gate_key,
       g.gate_group,
       g.gate_status,
       g.required_reviewer_role,
       h.work_item_status,
       h.work_item_due_date
from public.agent_sponsorship_governance_gates g
left join public.agent_os_phase3_human_gates h using (workflow_key, gate_key)
where g.workflow_key='phase3-fiscal-sponsorship-orchestration-v1'
order by g.sort_order;

select stage_order,
       stage_key,
       stage_name,
       department_name,
       owner_agent_name,
       supervisor_agent_name,
       human_authority_role,
       decision_class,
       shadow_assignment_count,
       latest_stage_run_count,
       latest_held_run_count
from public.agent_os_phase3_stage_matrix
order by stage_order;

select mapped_control_stage_key,
       control_stage_name,
       assigned_agent_name,
       count(*)::int as portfolio_count
from public.agent_os_phase3_case_queue
group by mapped_control_stage_key, control_stage_name, assigned_agent_name, control_stage_order
order by control_stage_order;

select scenario_key,
       count(*)::int as handoff_count,
       count(*) filter (where acceptance_required)::int as acceptance_required_count,
       count(*) filter (where length(packet_sha256)=64)::int as hashed_packet_count
from public.agent_os_phase3_handoff_evidence
group by scenario_key
order by scenario_key;

do $$
declare
  v_dashboard public.agent_os_phase3_dashboard%rowtype;
  v_phase3_table_count integer;
  v_rls_table_count integer;
  v_policy_table_count integer;
  v_anon_read_count integer;
  v_authenticated_write_count integer;
  v_invoker_view_count integer;
  v_public_definer_rpc_count integer;
  v_sent_communication_count integer;
  v_external_case_count integer;
  v_authoritative_change_count integer;
  v_shadow_count integer;
  v_shadow_case_count integer;
  v_stage_count integer;
  v_scenario_pass_count integer;
  v_scenario_count integer;
  v_failed_assertion_count integer;
begin
  select * into strict v_dashboard
  from public.agent_os_phase3_dashboard;

  if v_dashboard.workflow_status not in ('ready_for_human_review','pilot') then
    raise exception 'Unexpected Phase 3 workflow status: %', v_dashboard.workflow_status;
  end if;
  if v_dashboard.external_actions_enabled then
    raise exception 'Phase 3 external actions must remain disabled';
  end if;
  if v_dashboard.authoritative_mutations_enabled then
    raise exception 'Phase 3 authoritative mutations must remain disabled';
  end if;
  if not v_dashboard.latest_authoritative_unchanged then
    raise exception 'The latest authoritative-source fingerprint is not unchanged';
  end if;
  if coalesce(v_dashboard.latest_external_side_effect_count,0) <> 0 then
    raise exception 'External side effects were recorded';
  end if;
  if coalesce(v_dashboard.latest_authoritative_mutation_count,0) <> 0 then
    raise exception 'Authoritative mutations were recorded';
  end if;

  select count(*)::int,
         count(*) filter (where passed)::int,
         coalesce(sum(failed_assertion_count),0)::int
    into v_scenario_count,v_scenario_pass_count,v_failed_assertion_count
  from public.agent_os_phase3_validation_results;

  if v_scenario_count <> 8 or v_scenario_pass_count <> 8 or v_failed_assertion_count <> 0 then
    raise exception 'Phase 3 scenario suite is incomplete: %/% passed, % failed assertions',
      v_scenario_pass_count,v_scenario_count,v_failed_assertion_count;
  end if;

  select count(*)::int into v_stage_count
  from public.agent_os_phase3_stage_matrix;
  if v_stage_count <> 11 then
    raise exception 'Expected 11 Phase 3 stages, found %', v_stage_count;
  end if;

  select count(*)::int into v_shadow_count
  from public.agent_sponsorship_shadow_assignments
  where workflow_key='phase3-fiscal-sponsorship-orchestration-v1';
  select count(*)::int into v_shadow_case_count
  from public.agent_sponsorship_cases
  where workflow_key='phase3-fiscal-sponsorship-orchestration-v1'
    and source_kind='shadow';
  if v_shadow_count=0 or v_shadow_count<>v_shadow_case_count then
    raise exception 'Shadow registry mismatch: assignments %, cases %',v_shadow_count,v_shadow_case_count;
  end if;

  select count(*)::int,
         count(*) filter (where c.relrowsecurity)::int,
         count(*) filter (where coalesce(pol.policy_count,0)>0)::int,
         count(*) filter (where has_table_privilege('anon',format('%I.%I',n.nspname,c.relname),'SELECT'))::int,
         count(*) filter (
           where has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'INSERT')
              or has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'UPDATE')
              or has_table_privilege('authenticated',format('%I.%I',n.nspname,c.relname),'DELETE')
         )::int
    into v_phase3_table_count,v_rls_table_count,v_policy_table_count,v_anon_read_count,v_authenticated_write_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  left join (
    select schemaname,tablename,count(*)::int policy_count
    from pg_policies
    group by schemaname,tablename
  ) pol on pol.schemaname=n.nspname and pol.tablename=c.relname
  where n.nspname='public'
    and c.relkind='r'
    and c.relname in (
      'agent_sponsorship_workflows','agent_sponsorship_stage_catalog','agent_sponsorship_scenarios',
      'agent_sponsorship_cases','agent_sponsorship_stage_runs','agent_sponsorship_handoffs',
      'agent_sponsorship_validation_runs','agent_sponsorship_assertions',
      'agent_sponsorship_governance_gates','agent_sponsorship_shadow_assignments'
    );

  if v_phase3_table_count<>10 or v_rls_table_count<>10 or v_policy_table_count<>10 then
    raise exception 'Phase 3 RLS coverage failed: tables %, RLS %, policies %',
      v_phase3_table_count,v_rls_table_count,v_policy_table_count;
  end if;
  if v_anon_read_count<>0 then
    raise exception 'Anonymous SELECT exists on % Phase 3 tables',v_anon_read_count;
  end if;
  if v_authenticated_write_count<>0 then
    raise exception 'Authenticated direct writes exist on % Phase 3 tables',v_authenticated_write_count;
  end if;

  select count(*)::int into v_invoker_view_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind='v'
    and c.relname in (
      'agent_os_phase3_dashboard','agent_os_phase3_stage_matrix','agent_os_phase3_case_queue',
      'agent_os_phase3_validation_results','agent_os_phase3_human_gates','agent_os_phase3_handoff_evidence'
    )
    and coalesce(array_to_string(c.reloptions,','),'') like '%security_invoker=true%';
  if v_invoker_view_count<>6 then
    raise exception 'Expected 6 invoker-security Phase 3 views, found %',v_invoker_view_count;
  end if;

  select count(*)::int into v_public_definer_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'agent_os_phase3_%'
    and p.prosecdef;
  if v_public_definer_rpc_count<>0 then
    raise exception 'Found % public Phase 3 SECURITY DEFINER functions',v_public_definer_rpc_count;
  end if;

  select count(*)::int into v_sent_communication_count
  from public.communication_queue q
  where q.source_context->>'workflow_key'='phase3-fiscal-sponsorship-orchestration-v1'
    and (q.status='sent' or q.sent_at is not null or q.external_message_id is not null or q.recipient_address is not null);
  if v_sent_communication_count<>0 then
    raise exception 'Found % externally actionable Phase 3 communication records',v_sent_communication_count;
  end if;

  select count(*)::int into v_external_case_count
  from public.agent_sponsorship_stage_runs
  where not dry_run or external_side_effect_count<>0;
  if v_external_case_count<>0 then
    raise exception 'Found % non-dry-run or externally effective Phase 3 stage runs',v_external_case_count;
  end if;

  select count(*)::int into v_authoritative_change_count
  from public.agent_sponsorship_stage_runs
  where authoritative_mutation_count<>0;
  if v_authoritative_change_count<>0 then
    raise exception 'Found % Phase 3 stage runs with authoritative mutations',v_authoritative_change_count;
  end if;

  raise notice 'Phase 3 verification passed: 8 scenarios, 11 stages, % shadow cases, 0 external effects, 0 authoritative mutations.',v_shadow_count;
end;
$$;
