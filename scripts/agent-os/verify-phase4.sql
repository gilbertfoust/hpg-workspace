-- HPG Agent OS Phase 4 production verification
-- Run as an authorized internal test user. The script is read-only.

\set ON_ERROR_STOP on

select *
from public.agent_os_phase4_dashboard;

select
  source_key,
  display_name,
  source_table,
  owner_agent_name,
  last_source_row_count,
  last_memory_row_count,
  coverage_status,
  last_ingested_at
from public.agent_os_phase4_source_coverage
order by source_key;

select
  scenario_key,
  title,
  assertion_count,
  passed_assertion_count,
  failed_assertion_count,
  passed,
  completed_at
from public.agent_os_phase4_validation_results
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
from public.agent_os_phase4_governance
order by sort_order;

select
  memory_type,
  count(*)::int as memory_count,
  count(*) filter (where lifecycle_status='verified')::int as verified_count,
  count(*) filter (where calculated_temporal_state='current')::int as current_count,
  count(*) filter (where calculated_temporal_state in ('historical','expired','superseded'))::int as historical_count,
  count(*) filter (where outcome_status<>'not_assessed')::int as outcome_assessed_count
from public.agent_os_phase4_memory_timeline
group by memory_type
order by memory_type;

select
  provider_key,
  operating_role,
  provider_status,
  object_type,
  count(*)::int as provenance_count,
  bool_or(authoritative) as any_authoritative_record
from public.agent_os_phase4_provenance_archive
group by provider_key,operating_role,provider_status,object_type
order by provider_key,object_type;

select
  rule_key,
  memory_type,
  confidentiality,
  retention_years,
  permanent_retention,
  review_frequency_months,
  legal_hold_supported,
  policy_status
from public.agent_os_phase4_retention_standard
order by memory_type;

do $$
declare
  v_dashboard public.agent_os_phase4_dashboard%rowtype;
  v_phase4_tables text[] := array[
    'institutional_memory_programs',
    'institutional_memory_entries',
    'institutional_memory_evidence',
    'institutional_memory_entity_links',
    'institutional_memory_precedent_links',
    'institutional_memory_events',
    'institutional_memory_retention_rules',
    'institutional_memory_source_registry',
    'institutional_memory_ingestion_runs',
    'institutional_memory_scenarios',
    'institutional_memory_validation_runs',
    'institutional_memory_assertions',
    'institutional_memory_governance_gates',
    'external_system_authority_registry',
    'external_system_provenance_archive'
  ];
  v_table_count integer;
  v_rls_count integer;
  v_policy_count integer;
  v_anon_read_count integer;
  v_authenticated_write_count integer;
  v_invoker_view_count integer;
  v_public_definer_rpc_count integer;
  v_anon_rpc_count integer;
  v_scenario_count integer;
  v_passed_scenario_count integer;
  v_assertion_count integer;
  v_failed_assertion_count integer;
  v_source_count integer;
  v_complete_source_count integer;
  v_memory_count integer;
  v_verified_count integer;
  v_verified_evidence_count integer;
  v_invalid_memory_hash_count integer;
  v_invalid_evidence_hash_count integer;
  v_invalid_event_hash_count integer;
  v_broken_event_chain_count integer;
  v_broken_supersession_count integer;
  v_invalid_precedent_count integer;
  v_provenance_count integer;
  v_trello_bad_state_count integer;
  v_active_trello_route_count integer;
  v_active_trello_member_count integer;
  v_pending_trello_queue_count integer;
  v_trello_sync_enabled_count integer;
  v_trello_trigger_count integer;
  v_retention_draft_count integer;
  v_human_gate_count integer;
  v_human_gate_pending_count integer;
  v_gate_failure_count integer;
begin
  select * into strict v_dashboard
  from public.agent_os_phase4_dashboard;

  if v_dashboard.program_status not in ('ready_for_human_review','pilot') then
    raise exception 'Unexpected Phase 4 program status: %',v_dashboard.program_status;
  end if;
  if v_dashboard.external_actions_enabled then
    raise exception 'Phase 4 external actions must remain disabled';
  end if;
  if v_dashboard.autonomous_high_impact_decisions_enabled then
    raise exception 'Autonomous high-impact decisions must remain disabled';
  end if;
  if coalesce(v_dashboard.latest_external_side_effect_count,0)<>0 then
    raise exception 'Phase 4 recorded external side effects';
  end if;
  if coalesce(v_dashboard.latest_authoritative_mutation_count,0)<>0 then
    raise exception 'Phase 4 recorded authoritative source mutations';
  end if;
  if not coalesce(v_dashboard.latest_source_fingerprint_unchanged,false) then
    raise exception 'The latest authoritative-source fingerprint changed during validation';
  end if;

  select count(*)::int,
         count(*) filter (where passed)::int,
         coalesce(sum(assertion_count),0)::int,
         coalesce(sum(failed_assertion_count),0)::int
    into v_scenario_count,v_passed_scenario_count,v_assertion_count,v_failed_assertion_count
  from public.agent_os_phase4_validation_results;

  if v_scenario_count<>8 or v_passed_scenario_count<>8 or v_assertion_count<26 or v_failed_assertion_count<>0 then
    raise exception 'Phase 4 validation is incomplete: %/% scenarios, % assertions, % failures',
      v_passed_scenario_count,v_scenario_count,v_assertion_count,v_failed_assertion_count;
  end if;

  select count(*)::int,
         count(*) filter (where coverage_status='complete')::int
    into v_source_count,v_complete_source_count
  from public.agent_os_phase4_source_coverage;
  if v_source_count<>7 or v_complete_source_count<>7 then
    raise exception 'Phase 4 source coverage failed: % sources, % complete',v_source_count,v_complete_source_count;
  end if;

  select count(*)::int,
         count(*) filter (where lifecycle_status='verified')::int
    into v_memory_count,v_verified_count
  from public.institutional_memory_entries
  where not is_synthetic;
  if v_memory_count<328 then
    raise exception 'Expected at least 328 institutional memories, found %',v_memory_count;
  end if;

  select count(distinct m.id)::int
    into v_verified_evidence_count
  from public.institutional_memory_entries m
  join public.institutional_memory_evidence e on e.memory_id=m.id and e.is_primary
  where not m.is_synthetic and m.lifecycle_status='verified' and length(e.evidence_sha256)=64;
  if v_verified_evidence_count<>v_verified_count then
    raise exception 'Verified evidence coverage failed: % verified memories, % with hashed primary evidence',
      v_verified_count,v_verified_evidence_count;
  end if;

  select count(*)::int into v_invalid_memory_hash_count
  from public.institutional_memory_entries
  where length(source_snapshot_sha256)<>64;
  select count(*)::int into v_invalid_evidence_hash_count
  from public.institutional_memory_evidence
  where length(evidence_sha256)<>64;
  select count(*)::int into v_invalid_event_hash_count
  from public.institutional_memory_events
  where length(event_sha256)<>64 or (previous_event_sha256 is not null and length(previous_event_sha256)<>64);
  if v_invalid_memory_hash_count+v_invalid_evidence_hash_count+v_invalid_event_hash_count<>0 then
    raise exception 'Invalid Phase 4 hashes: memory %, evidence %, events %',
      v_invalid_memory_hash_count,v_invalid_evidence_hash_count,v_invalid_event_hash_count;
  end if;

  with ordered as (
    select
      memory_id,
      id,
      previous_event_sha256,
      lag(event_sha256) over (partition by memory_id order by created_at,id) as expected_previous
    from public.institutional_memory_events
  )
  select count(*)::int into v_broken_event_chain_count
  from ordered
  where previous_event_sha256 is distinct from expected_previous;
  if v_broken_event_chain_count<>0 then
    raise exception 'Found % broken Phase 4 event-chain links',v_broken_event_chain_count;
  end if;

  select count(*)::int into v_broken_supersession_count
  from public.institutional_memory_entries m
  left join public.institutional_memory_entries replacement on replacement.id=m.superseded_by_memory_id
  left join public.institutional_memory_entries former on former.id=m.supersedes_memory_id
  where
    (m.lifecycle_status='superseded' and (m.temporal_state<>'superseded' or replacement.id is null or replacement.supersedes_memory_id<>m.id))
    or (m.supersedes_memory_id is not null and (former.id is null or former.superseded_by_memory_id<>m.id));
  if v_broken_supersession_count<>0 then
    raise exception 'Found % broken supersession records',v_broken_supersession_count;
  end if;

  select count(*)::int into v_invalid_precedent_count
  from public.institutional_memory_precedent_links
  where source_memory_id=precedent_memory_id or nullif(btrim(rationale),'') is null;
  if v_invalid_precedent_count<>0 then
    raise exception 'Found % invalid precedent links',v_invalid_precedent_count;
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
    into v_table_count,v_rls_count,v_policy_count,v_anon_read_count,v_authenticated_write_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  left join (
    select schemaname,tablename,count(*)::int policy_count
    from pg_policies
    group by schemaname,tablename
  ) pol on pol.schemaname=n.nspname and pol.tablename=c.relname
  where n.nspname='public' and c.relkind='r' and c.relname=any(v_phase4_tables);

  if v_table_count<>cardinality(v_phase4_tables)
     or v_rls_count<>cardinality(v_phase4_tables)
     or v_policy_count<>cardinality(v_phase4_tables) then
    raise exception 'Phase 4 RLS coverage failed: tables %, RLS %, policies %',v_table_count,v_rls_count,v_policy_count;
  end if;
  if v_anon_read_count<>0 then
    raise exception 'Anonymous SELECT exists on % Phase 4 tables',v_anon_read_count;
  end if;
  if v_authenticated_write_count<>0 then
    raise exception 'Authenticated direct writes exist on % Phase 4 tables',v_authenticated_write_count;
  end if;

  select count(*)::int into v_invoker_view_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind='v'
    and c.relname in (
      'agent_os_phase4_dashboard','agent_os_phase4_memory_timeline','agent_os_phase4_decision_register',
      'agent_os_phase4_relationship_history','agent_os_phase4_grant_memory','agent_os_phase4_compliance_history',
      'agent_os_phase4_operational_lessons','agent_os_phase4_precedent_library','agent_os_phase4_source_coverage',
      'agent_os_phase4_validation_results','agent_os_phase4_governance','agent_os_phase4_retention_standard',
      'agent_os_phase4_provenance_archive','agent_os_phase4_memory_events'
    )
    and coalesce(array_to_string(c.reloptions,','),'') like '%security_invoker=true%';
  if v_invoker_view_count<>14 then
    raise exception 'Expected 14 invoker-security Phase 4 views, found %',v_invoker_view_count;
  end if;

  select count(*)::int into v_public_definer_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'agent_os_phase4_%' and p.prosecdef;
  select count(*)::int into v_anon_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'agent_os_phase4_%'
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_public_definer_rpc_count<>0 or v_anon_rpc_count<>0 then
    raise exception 'Phase 4 public RPC exposure failed: definer %, anonymous executable %',
      v_public_definer_rpc_count,v_anon_rpc_count;
  end if;

  select count(*)::int into v_provenance_count
  from public.external_system_provenance_archive
  where provider_key='trello' and not authoritative;
  if v_provenance_count<994 then
    raise exception 'Expected at least 994 Trello provenance records, found %',v_provenance_count;
  end if;

  select count(*)::int into v_trello_bad_state_count
  from public.external_system_authority_registry
  where provider_key='trello' and not (
    operating_role='historical_provenance_only'
    and not is_authoritative
    and not inbound_mutation_allowed
    and not outbound_mutation_allowed
    and status='retired'
    and coalesce((metadata->>'webhook_tombstone_deployed')::boolean,false)
    and coalesce((metadata->>'worker_tombstone_deployed')::boolean,false)
  );
  select count(*)::int into v_active_trello_route_count from public.trello_route_mappings where is_active;
  select count(*)::int into v_active_trello_member_count from public.trello_member_mappings where is_active;
  select count(*)::int into v_pending_trello_queue_count from public.trello_sync_queue where status in ('pending','processing');
  select count(*)::int into v_trello_sync_enabled_count from public.work_items where coalesce(trello_sync,false);
  select count(*)::int into v_trello_trigger_count
  from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where not t.tgisinternal and p.proname='queue_workspace_work_item_trello_change';
  if v_trello_bad_state_count+v_active_trello_route_count+v_active_trello_member_count+
     v_pending_trello_queue_count+v_trello_sync_enabled_count+v_trello_trigger_count<>0 then
    raise exception 'Trello retirement failed: authority %, routes %, members %, queue %, sync items %, triggers %',
      v_trello_bad_state_count,v_active_trello_route_count,v_active_trello_member_count,
      v_pending_trello_queue_count,v_trello_sync_enabled_count,v_trello_trigger_count;
  end if;

  select count(*)::int,
         count(*) filter (where gate_status='pending')::int
    into v_human_gate_count,v_human_gate_pending_count
  from public.institutional_memory_governance_gates
  where program_key='phase4-organizational-memory-v1' and gate_group='human' and is_required;
  select count(*)::int into v_gate_failure_count
  from public.institutional_memory_governance_gates
  where program_key='phase4-organizational-memory-v1' and gate_status='failed';
  if v_human_gate_count<>8 or v_gate_failure_count<>0 then
    raise exception 'Unexpected governance state: human gates %, pending %, failed %',
      v_human_gate_count,v_human_gate_pending_count,v_gate_failure_count;
  end if;

  select count(*)::int into v_retention_draft_count
  from public.institutional_memory_retention_rules
  where policy_status='draft_pending_legal_review';
  if v_retention_draft_count<>6 then
    raise exception 'Expected six retention rules pending General Counsel review, found %',v_retention_draft_count;
  end if;

  if not exists(select 1 from public.agent_os_phase4_search('fiscal sponsorship',null,null,null,true,10)) then
    raise exception 'Phase 4 full-text search returned no fiscal-sponsorship memory';
  end if;

  raise notice 'Phase 4 verification passed: % institutional memories, % verified, % assertions, 7 complete sources, % Trello provenance records, 0 external effects, 0 authoritative mutations.',
    v_memory_count,v_verified_count,v_assertion_count,v_provenance_count;
end;
$$;
