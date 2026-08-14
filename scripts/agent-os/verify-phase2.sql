-- HPG Agent OS Phase 2 verification. Run as an authorized internal test user.

select * from public.agent_os_nia_pilot_dashboard;

select scenario_key,passed,actual_risk_level,actual_match_confidence,actual_approval_required,checks,executed_at
from public.agent_pilot_scenario_results
where agent_key='hpg-aos-024' and manifest_version='2.0.0'
order by scenario_key;

select gate_key,gate_status,notes,recorded_at
from public.agent_activation_gate_evidence
where agent_key='hpg-aos-024'
order by gate_key;

select
  (select count(*) from public.communication_queue where created_by_agent_key='hpg-aos-024' and status='sent') as sent_communications,
  (select count(*) from public.communication_queue where created_by_agent_key='hpg-aos-024' and recipient_address is not null) as addressed_external_messages,
  (select count(*) from public.trello_sync_queue where case_registry_id is not null and status in ('pending','processing','completed')) as trello_case_events,
  (select count(*) from public.agent_runs where agent_key='hpg-aos-024' and coalesce((metadata->>'external_email_sent')::boolean,false)) as external_email_runs,
  (select count(*) from public.agent_runs where agent_key='hpg-aos-024' and coalesce((metadata->>'payment_action')::boolean,false)) as payment_action_runs;

-- Pass condition: all five values above are zero.
