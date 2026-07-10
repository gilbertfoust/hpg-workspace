-- HPG Agent OS workflow and policy catalog
-- Encodes approved workflow stages, communication authority, escalation timing,
-- weekday reporting schedules, and department intelligence responsibilities.
-- This migration defines policy data only; it does not send messages or call connectors.

create table if not exists public.agent_os_workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null unique,
  name text not null,
  case_type text not null,
  owning_department text not null,
  description text,
  active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_os_workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.agent_os_workflow_definitions(id) on delete cascade,
  stage_key text not null,
  stage_order integer not null,
  name text not null,
  responsible_role text,
  department text,
  automatic_entry_actions jsonb not null default '[]'::jsonb,
  human_approval_required boolean not null default false,
  approval_role text,
  external_visible boolean not null default false,
  terminal boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, stage_key),
  unique (workflow_id, stage_order)
);

create table if not exists public.agent_os_communication_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  communication_type text not null,
  case_type text,
  authority_level text not null
    check (authority_level in ('automatic', 'draft_for_review', 'human_only')),
  trigger_stage text,
  recipient_scope text not null default 'external',
  template_key text,
  standard_response_minutes integer,
  business_hours_only boolean not null default true,
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_os_escalation_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  name text not null,
  trigger_type text not null,
  severity text not null default 'routine'
    check (severity in ('routine', 'elevated', 'urgent', 'critical')),
  elapsed_business_days integer,
  notify_assignee boolean not null default true,
  notify_supervisor boolean not null default false,
  notify_director boolean not null default false,
  notify_vp boolean not null default false,
  notify_noemi boolean not null default false,
  notify_ceo boolean not null default false,
  channels jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_os_reporting_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_key text not null unique,
  report_type text not null,
  responsible_level text not null,
  weekday_only boolean not null default true,
  timezone text not null default 'America/New_York',
  local_time time not null,
  destination text,
  quiet_day_required boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_os_department_intelligence (
  id uuid primary key default gen_random_uuid(),
  department text not null unique,
  executive_lead text not null,
  monitoring_scope jsonb not null default '[]'::jsonb,
  standard_outputs jsonb not null default '[]'::jsonb,
  urgent_topics jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.agent_os_policy_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger agent_os_workflow_definitions_updated_at
before update on public.agent_os_workflow_definitions
for each row execute function public.agent_os_policy_set_updated_at();

create trigger agent_os_workflow_stages_updated_at
before update on public.agent_os_workflow_stages
for each row execute function public.agent_os_policy_set_updated_at();

create trigger agent_os_communication_policies_updated_at
before update on public.agent_os_communication_policies
for each row execute function public.agent_os_policy_set_updated_at();

create trigger agent_os_escalation_policies_updated_at
before update on public.agent_os_escalation_policies
for each row execute function public.agent_os_policy_set_updated_at();

create trigger agent_os_reporting_schedules_updated_at
before update on public.agent_os_reporting_schedules
for each row execute function public.agent_os_policy_set_updated_at();

create trigger agent_os_department_intelligence_updated_at
before update on public.agent_os_department_intelligence
for each row execute function public.agent_os_policy_set_updated_at();

insert into public.agent_os_workflow_definitions
  (workflow_key, name, case_type, owning_department, description)
values
  ('sponsorship_intake_v1', 'Fiscal Sponsorship Intake and Activation', 'sponsorship', 'Development',
   'End-to-end sponsorship pipeline from first inquiry through active NGO monitoring.'),
  ('volunteer_intake_v1', 'Volunteer Intake and Onboarding', 'volunteer', 'Human Resources',
   'Website volunteer application, screening, interview approval, offer, training, access, and activation.'),
  ('board_intake_v1', 'Board Candidate Intake', 'board', 'Nominations',
   'Website board application, eligibility review, interview, recommendation, approval, and onboarding.')
on conflict (workflow_key) do update
set name = excluded.name,
    case_type = excluded.case_type,
    owning_department = excluded.owning_department,
    description = excluded.description,
    active = true,
    updated_at = now();

with w as (
  select id from public.agent_os_workflow_definitions where workflow_key = 'sponsorship_intake_v1'
), stages(stage_key, stage_order, name, responsible_role, department, human_approval_required, approval_role, external_visible, terminal, automatic_entry_actions) as (
  values
    ('new_inquiry', 1, 'New Inquiry', 'Development Executive Secretary', 'Development', false, null, false, false, '["create_case","assign_profile_number","create_drive_folder","create_trello_card","send_acknowledgment"]'::jsonb),
    ('application_requested', 2, 'Application Requested', 'Partnership Development', 'Development', false, null, true, false, '["send_application_link"]'::jsonb),
    ('application_received', 3, 'Application Received', 'Development Executive Secretary', 'Development', false, null, true, false, '["confirm_receipt","check_completeness"]'::jsonb),
    ('initial_eligibility_review', 4, 'Initial Eligibility Review', 'Partnership Development', 'Development', false, null, false, false, '[]'::jsonb),
    ('documents_requested', 5, 'Documents Requested', 'Development Executive Secretary', 'Development', false, null, true, false, '["send_missing_document_request"]'::jsonb),
    ('documents_partially_received', 6, 'Documents Partially Received', 'Development Executive Secretary', 'Development', false, null, true, false, '["update_document_checklist","send_routine_reminders"]'::jsonb),
    ('document_collection_complete', 7, 'Document Collection Complete', 'Partnership Development', 'Development', false, null, false, false, '["route_due_diligence"]'::jsonb),
    ('due_diligence_in_progress', 8, 'Due Diligence in Progress', 'Program and General Counsel', 'Program', false, null, false, false, '["open_program_review","open_legal_review","open_finance_review"]'::jsonb),
    ('clarification_requested', 9, 'Clarification Requested', 'Responsible Reviewing Department', 'Cross-Department', false, null, true, false, '["send_neutral_clarification_request"]'::jsonb),
    ('interview_ready', 10, 'Interview Ready', 'Partnership Development', 'Development', false, null, false, false, '["request_applicant_availability"]'::jsonb),
    ('interview_scheduling_human', 11, 'Interview Scheduling Awaiting Human Action', 'Human Interviewer', 'Development', true, 'Authorized Human Scheduler', false, false, '[]'::jsonb),
    ('interview_completed', 12, 'Interview Completed', 'Human Interviewer', 'Development', true, 'Human Interviewer', false, false, '[]'::jsonb),
    ('program_review', 13, 'Program Review', 'Program Department', 'Program', false, null, false, false, '[]'::jsonb),
    ('finance_review', 14, 'Finance Review', 'Finance Department', 'Finance', false, null, false, false, '[]'::jsonb),
    ('general_counsel_review', 15, 'General Counsel Review', 'General Counsel Department', 'General Counsel', false, null, false, false, '[]'::jsonb),
    ('development_review', 16, 'Development Review', 'Development Vice President', 'Development', true, 'Development Vice President', false, false, '[]'::jsonb),
    ('executive_review', 17, 'Executive Review', 'CEO / Executive Director', 'Executive', true, 'CEO / Executive Director', false, false, '[]'::jsonb),
    ('board_review', 18, 'Board Review When Triggered', 'Board of Directors', 'Executive', true, 'Board of Directors', false, false, '[]'::jsonb),
    ('conditional_approval', 19, 'Conditional Approval', 'Development Vice President', 'Development', true, 'Development Vice President', true, false, '["send_approved_conditions_after_human_release"]'::jsonb),
    ('final_sponsorship_approval', 20, 'Final Sponsorship Approval', 'Development Vice President', 'Development', true, 'Development Vice President', false, false, '[]'::jsonb),
    ('agreement_preparation', 21, 'Agreement Preparation', 'General Counsel', 'General Counsel', false, null, false, false, '["generate_agreement_draft"]'::jsonb),
    ('agreement_approved', 22, 'Agreement Approved by General Counsel', 'General Counsel', 'General Counsel', true, 'General Counsel', false, false, '[]'::jsonb),
    ('agreement_signed', 23, 'Agreement Signed', 'Authorized HPG Signer', 'Executive', true, 'Gilbert Foust or Chief Development Officer', false, false, '["send_onboarding_fee_form"]'::jsonb),
    ('onboarding_fee_form_sent', 24, 'Onboarding Fee Form Sent', 'Development Executive Secretary', 'Development', false, null, true, false, '[]'::jsonb),
    ('onboarding_fee_pending', 25, 'Onboarding Fee Payment Pending', 'Finance Department', 'Finance', false, null, true, false, '["monitor_payment"]'::jsonb),
    ('payment_verified', 26, 'Payment Received and Verified', 'Finance Department', 'Finance', true, 'Finance Department', false, false, '["issue_confirmation_letter"]'::jsonb),
    ('confirmation_letter_issued', 27, 'Confirmation Letter Issued', 'Development Executive Secretary', 'Development', false, null, true, false, '["prepare_activation"]'::jsonb),
    ('activation_processed', 28, 'Activation Processed', 'Development Executive Secretary', 'Development', false, null, false, false, '["activate_ngo_profile","create_department_tasks"]'::jsonb),
    ('transferred_to_ngo_coordination', 29, 'Transferred to NGO Coordination', 'NGO Coordination', 'Program', false, null, false, false, '["move_master_profile_to_ngo_coordination","create_onboarding_tasks"]'::jsonb),
    ('onboarding_in_progress', 30, 'Onboarding in Progress', 'NGO Coordination', 'Program', false, null, true, false, '["send_onboarding_packet","assign_reporting_calendar"]'::jsonb),
    ('active_sponsored_ngo', 31, 'Active Sponsored NGO', 'NGO Coordination', 'Program', false, null, true, false, '["start_monitoring"]'::jsonb),
    ('ongoing_monitoring', 32, 'Ongoing Monitoring', 'Program Vice President', 'Program', false, null, false, false, '[]'::jsonb),
    ('corrective_action_or_archive', 33, 'Corrective Action, Graduation, Termination, or Archive', 'Program Vice President', 'Program', true, 'Authorized Human Leader', false, true, '[]'::jsonb)
)
insert into public.agent_os_workflow_stages
  (workflow_id, stage_key, stage_order, name, responsible_role, department, human_approval_required, approval_role, external_visible, terminal, automatic_entry_actions)
select w.id, s.stage_key, s.stage_order, s.name, s.responsible_role, s.department,
       s.human_approval_required, s.approval_role, s.external_visible, s.terminal, s.automatic_entry_actions
from w cross join stages s
on conflict (workflow_id, stage_key) do update
set stage_order = excluded.stage_order,
    name = excluded.name,
    responsible_role = excluded.responsible_role,
    department = excluded.department,
    human_approval_required = excluded.human_approval_required,
    approval_role = excluded.approval_role,
    external_visible = excluded.external_visible,
    terminal = excluded.terminal,
    automatic_entry_actions = excluded.automatic_entry_actions,
    updated_at = now();

with w as (
  select id from public.agent_os_workflow_definitions where workflow_key = 'volunteer_intake_v1'
), stages(stage_key, stage_order, name, responsible_role, department, human_approval_required, approval_role, external_visible, terminal, automatic_entry_actions) as (
  values
    ('application_received', 1, 'Application Received', 'HR Recruitment', 'Human Resources', false, null, false, false, '["create_case","create_drive_folder","create_trello_card","send_acknowledgment","request_resume"]'::jsonb),
    ('completeness_review', 2, 'Application Completeness Review', 'HR Recruitment', 'Human Resources', false, null, false, false, '["request_missing_information"]'::jsonb),
    ('skills_analysis', 3, 'Skills and Department Fit Analysis', 'HR Recruitment', 'Human Resources', false, null, false, false, '["classify_skills","recommend_department"]'::jsonb),
    ('screening', 4, 'Background and Credential Screening', 'HR Recruitment', 'Human Resources', false, null, false, false, '["assign_background_check","assign_role_specific_screening"]'::jsonb),
    ('interview_recommended', 5, 'Interview Recommended', 'HR Recruitment', 'Human Resources', false, null, false, false, '["request_availability"]'::jsonb),
    ('interview_scheduling_human', 6, 'Interview Scheduling Awaiting Human Action', 'Human Interviewer', 'Human Resources', true, 'Authorized Human Scheduler', false, false, '[]'::jsonb),
    ('interview_completed', 7, 'Interview Completed', 'Human Interviewer', 'Human Resources', true, 'Human Interviewer', false, false, '[]'::jsonb),
    ('decision_pending', 8, 'Acceptance Decision Pending', 'HR Leadership', 'Human Resources', true, 'HR Leadership', false, false, '[]'::jsonb),
    ('accepted', 9, 'Accepted', 'HR Leadership', 'Human Resources', true, 'HR Leadership', true, false, '["generate_offer_letter","route_hr_vp_signature"]'::jsonb),
    ('rejected', 10, 'Rejected', 'HR Leadership', 'Human Resources', true, 'Authorized Human via Trello Rejected List', true, true, '["send_rejection_email","archive_case"]'::jsonb),
    ('offer_sent', 11, 'Offer Letter Sent', 'HR Vice President', 'Human Resources', true, 'HR Vice President', true, false, '["request_countersignature"]'::jsonb),
    ('offer_countersigned', 12, 'Offer Letter Countersigned', 'Volunteer Applicant', 'Human Resources', false, null, false, false, '["send_onboarding_packet","assign_nonprofitready_training"]'::jsonb),
    ('onboarding', 13, 'Onboarding in Progress', 'Human Resources', 'Human Resources', false, null, true, false, '["create_access_tasks","create_orientation_task","create_30_day_review"]'::jsonb),
    ('active_volunteer', 14, 'Active Volunteer', 'Department Supervisor', 'Assigned Department', false, null, false, false, '["start_engagement_monitoring"]'::jsonb),
    ('closed', 15, 'Closed or Archived', 'Human Resources', 'Human Resources', true, 'Authorized Human Leader', false, true, '[]'::jsonb)
)
insert into public.agent_os_workflow_stages
  (workflow_id, stage_key, stage_order, name, responsible_role, department, human_approval_required, approval_role, external_visible, terminal, automatic_entry_actions)
select w.id, s.stage_key, s.stage_order, s.name, s.responsible_role, s.department,
       s.human_approval_required, s.approval_role, s.external_visible, s.terminal, s.automatic_entry_actions
from w cross join stages s
on conflict (workflow_id, stage_key) do update
set stage_order = excluded.stage_order,
    name = excluded.name,
    responsible_role = excluded.responsible_role,
    department = excluded.department,
    human_approval_required = excluded.human_approval_required,
    approval_role = excluded.approval_role,
    external_visible = excluded.external_visible,
    terminal = excluded.terminal,
    automatic_entry_actions = excluded.automatic_entry_actions,
    updated_at = now();

insert into public.agent_os_communication_policies
  (policy_key, communication_type, case_type, authority_level, standard_response_minutes, business_hours_only, notes)
values
  ('auto_acknowledgment', 'acknowledgment', null, 'automatic', 60, true, 'Routine application or inquiry acknowledgment.'),
  ('auto_application_link', 'application_link', 'sponsorship', 'automatic', 60, true, 'Send the approved sponsorship application link.'),
  ('auto_document_request', 'missing_document_request', null, 'automatic', 60, true, 'Standard checklist-based document request.'),
  ('auto_receipt_confirmation', 'receipt_confirmation', null, 'automatic', 60, true, 'Confirm receipt of an application, document, or signed item.'),
  ('auto_status_update', 'routine_status_update', null, 'automatic', 60, true, 'SOP-based non-sensitive status update.'),
  ('auto_training_instructions', 'training_instructions', 'volunteer', 'automatic', 60, true, 'NonprofitReady.org and role-specific training instructions after acceptance.'),
  ('auto_rejection_after_human_status', 'rejection_notice', 'volunteer', 'automatic', 60, true, 'Only triggered after an authorized human places the Trello card in the Rejected list.'),
  ('draft_complaint', 'complaint_response', null, 'draft_for_review', 60, true, 'Complaints, frustration, misunderstanding, or possible withdrawal.'),
  ('draft_compliance_clarification', 'compliance_clarification', 'sponsorship', 'draft_for_review', 60, true, 'Use neutral clarification language and avoid unsupported accusations.'),
  ('draft_financial_dispute', 'financial_dispute', null, 'draft_for_review', 60, true, 'Any disputed payment, fee, budget, or financial obligation.'),
  ('human_meeting_confirmation', 'meeting_confirmation', null, 'human_only', null, true, 'A human selects and confirms meeting availability.'),
  ('human_legal_conclusion', 'legal_conclusion', null, 'human_only', null, true, 'Final legal conclusions remain human-controlled.'),
  ('human_contract_negotiation', 'contract_negotiation', 'sponsorship', 'human_only', null, true, 'Agreement negotiation and final commitments remain human-controlled.'),
  ('human_sponsorship_termination', 'termination_notice', 'sponsorship', 'human_only', null, true, 'Termination or material corrective action remains human-controlled.'),
  ('human_board_communication', 'board_communication', null, 'human_only', null, true, 'Formal Board communications remain human-controlled.'),
  ('human_public_statement', 'public_statement', null, 'human_only', null, true, 'Public statements and material commitments remain human-controlled.')
on conflict (policy_key) do update
set communication_type = excluded.communication_type,
    case_type = excluded.case_type,
    authority_level = excluded.authority_level,
    standard_response_minutes = excluded.standard_response_minutes,
    business_hours_only = excluded.business_hours_only,
    notes = excluded.notes,
    active = true,
    updated_at = now();

insert into public.agent_os_escalation_policies
  (policy_key, name, trigger_type, severity, elapsed_business_days,
   notify_assignee, notify_supervisor, notify_director, notify_vp, notify_noemi, notify_ceo, channels)
values
  ('due_date', 'Due Date Reached', 'overdue', 'routine', 0, true, false, false, false, false, false, '["trello","email"]'::jsonb),
  ('one_day_overdue', 'One Business Day Overdue', 'overdue', 'routine', 1, true, true, true, false, false, false, '["trello","email"]'::jsonb),
  ('three_days_overdue', 'Three Business Days Overdue', 'overdue', 'elevated', 3, true, true, true, true, false, false, '["trello","email","slack"]'::jsonb),
  ('five_days_overdue', 'Five Business Days Overdue', 'overdue', 'urgent', 5, true, true, true, true, true, false, '["trello","email","slack","noemi_queue"]'::jsonb),
  ('ten_days_overdue', 'Ten Business Days Overdue', 'overdue', 'critical', 10, true, true, true, true, true, true, '["trello","email","slack","noemi_queue","ceo_queue"]'::jsonb),
  ('urgent_relationship', 'Urgent NGO Relationship Concern', 'relationship_risk', 'urgent', null, true, true, true, true, true, true, '["trello","email","slack","noemi_queue"]'::jsonb),
  ('urgent_legal_financial_safeguarding', 'Immediate Legal, Financial, Safeguarding, or Reputational Risk', 'material_risk', 'critical', null, true, true, true, true, true, true, '["trello","email","slack","noemi_queue","ceo_queue"]'::jsonb)
on conflict (policy_key) do update
set name = excluded.name,
    trigger_type = excluded.trigger_type,
    severity = excluded.severity,
    elapsed_business_days = excluded.elapsed_business_days,
    notify_assignee = excluded.notify_assignee,
    notify_supervisor = excluded.notify_supervisor,
    notify_director = excluded.notify_director,
    notify_vp = excluded.notify_vp,
    notify_noemi = excluded.notify_noemi,
    notify_ceo = excluded.notify_ceo,
    channels = excluded.channels,
    active = true,
    updated_at = now();

insert into public.agent_os_reporting_schedules
  (schedule_key, report_type, responsible_level, weekday_only, timezone, local_time, destination, quiet_day_required)
values
  ('specialist_weekday_report', 'specialist_report', 'specialist', true, 'America/New_York', '13:00', 'subdepartment_director', false),
  ('director_weekday_synthesis', 'director_synthesis', 'director', true, 'America/New_York', '14:30', 'department_vp', false),
  ('vp_weekday_report', 'vp_department_report', 'vp', true, 'America/New_York', '16:00', 'noemi_vale', false),
  ('noemi_weekday_ceo_brief', 'ceo_brief', 'executive_assistant', true, 'America/New_York', '17:00', 'ceo', true)
on conflict (schedule_key) do update
set report_type = excluded.report_type,
    responsible_level = excluded.responsible_level,
    weekday_only = excluded.weekday_only,
    timezone = excluded.timezone,
    local_time = excluded.local_time,
    destination = excluded.destination,
    quiet_day_required = excluded.quiet_day_required,
    active = true,
    updated_at = now();

insert into public.agent_os_department_intelligence
  (department, executive_lead, monitoring_scope, standard_outputs, urgent_topics)
values
  ('Administration', 'Sophia Martinez', '["governance","meetings","records","schedules","executive_correspondence"]'::jsonb, '["governance_packets","meeting_follow_up","records_audits"]'::jsonb, '["missed_governance_deadline","record_integrity_issue"]'::jsonb),
  ('Finance', 'Daniel Mensah', '["budgets","transactions","banking","fees","reconciliations","grants","financial_sustainability"]'::jsonb, '["financial_reports","payment_verification","exceptions","decision_packets"]'::jsonb, '["payment_failure","fraud_risk","material_financial_dispute"]'::jsonb),
  ('Development', 'Selah Brooks', '["sponsorship_intake","fundraising","grants","donors","partnerships","csr"]'::jsonb, '["intake_status","grant_intelligence","donor_research","partnership_recommendations"]'::jsonb, '["major_partner_risk","application_relationship_breakdown"]'::jsonb),
  ('Operations', 'Marcus Chen', '["implementation_readiness","logistics","staffing","country_requirements","routing"]'::jsonb, '["operational_plans","responsibility_maps","blocked_work_reports"]'::jsonb, '["critical_delivery_failure","country_registration_blocker"]'::jsonb),
  ('Program', 'Amina Okafor', '["ngo_coordination","program_readiness","events","curriculum","deliverables","monitoring"]'::jsonb, '["ngo_coordination_reports","program_reviews","monitoring_findings"]'::jsonb, '["safeguarding_risk","ngo_withdrawal_risk","corrective_action"]'::jsonb),
  ('Innovation', 'Javier Morales', '["humanitarian_needs","global_events","geopolitics","emerging_technology","new_models"]'::jsonb, '["concept_notes","pilot_proposals","feasibility_findings","opportunity_briefs"]'::jsonb, '["time_sensitive_opportunity","material_global_event"]'::jsonb),
  ('Technology', 'Arun Mehta', '["workspace","supabase","github","automations","security","integrations","data_integrity"]'::jsonb, '["system_health","incident_alerts","deployment_summaries","technical_roadmaps"]'::jsonb, '["data_exposure","connector_failure","unauthorized_activity","automation_failure"]'::jsonb),
  ('Marketing', 'Fatima El-Sayed', '["brand_consistency","visual_assets","campaigns","social_planning","performance"]'::jsonb, '["campaign_plans","asset_requests","marketing_analytics"]'::jsonb, '["brand_misuse","high_risk_campaign_issue"]'::jsonb),
  ('Communications', 'Olivia Johnson', '["messaging","public_relations","digital_engagement","internal_communications","reputation"]'::jsonb, '["message_frameworks","pr_plans","internal_notices","communications_drafts"]'::jsonb, '["reputational_crisis","unauthorized_public_statement"]'::jsonb),
  ('Human Resources', 'Kofi Asare', '["recruitment","screening","onboarding","training","engagement","dei","policy_completion"]'::jsonb, '["candidate_analysis","placement_recommendations","training_status","hr_escalations"]'::jsonb, '["background_check_concern","disciplinary_risk","safeguarding_concern"]'::jsonb),
  ('General Counsel', 'Amara Patel', '["nonprofit_law","irs_guidance","fiscal_sponsorship","agreements","governance","ethics","sanctions"]'::jsonb, '["legal_analysis","compliance_analysis","agreement_review","risk_findings"]'::jsonb, '["material_legal_risk","sanctions_match","private_benefit","governance_breach"]'::jsonb),
  ('Efficiency', 'Elena Petrova', '["timeliness","kpis","evidence","duplicate_work","failed_automations","quality","bottlenecks"]'::jsonb, '["dashboards","qa_findings","process_improvements","performance_escalations"]'::jsonb, '["systemic_workflow_failure","unsupported_conclusion","persistent_overdue_work"]'::jsonb)
on conflict (department) do update
set executive_lead = excluded.executive_lead,
    monitoring_scope = excluded.monitoring_scope,
    standard_outputs = excluded.standard_outputs,
    urgent_topics = excluded.urgent_topics,
    active = true,
    updated_at = now();

alter table public.agent_os_workflow_definitions enable row level security;
alter table public.agent_os_workflow_stages enable row level security;
alter table public.agent_os_communication_policies enable row level security;
alter table public.agent_os_escalation_policies enable row level security;
alter table public.agent_os_reporting_schedules enable row level security;
alter table public.agent_os_department_intelligence enable row level security;

create policy "Internal users can read Agent OS policy catalog"
on public.agent_os_workflow_definitions for select to authenticated
using (public.is_internal_user());
create policy "Internal users can read Agent OS workflow stages"
on public.agent_os_workflow_stages for select to authenticated
using (public.is_internal_user());
create policy "Internal users can read Agent OS communication policies"
on public.agent_os_communication_policies for select to authenticated
using (public.is_internal_user());
create policy "Internal users can read Agent OS escalation policies"
on public.agent_os_escalation_policies for select to authenticated
using (public.is_internal_user());
create policy "Internal users can read Agent OS reporting schedules"
on public.agent_os_reporting_schedules for select to authenticated
using (public.is_internal_user());
create policy "Internal users can read Agent OS department intelligence"
on public.agent_os_department_intelligence for select to authenticated
using (public.is_internal_user());

create policy "Super admins manage Agent OS workflow definitions"
on public.agent_os_workflow_definitions for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super admins manage Agent OS workflow stages"
on public.agent_os_workflow_stages for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super admins manage Agent OS communication policies"
on public.agent_os_communication_policies for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super admins manage Agent OS escalation policies"
on public.agent_os_escalation_policies for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super admins manage Agent OS reporting schedules"
on public.agent_os_reporting_schedules for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super admins manage Agent OS department intelligence"
on public.agent_os_department_intelligence for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.agent_os_workflow_definitions,
  public.agent_os_workflow_stages,
  public.agent_os_communication_policies,
  public.agent_os_escalation_policies,
  public.agent_os_reporting_schedules,
  public.agent_os_department_intelligence to authenticated;

grant all on public.agent_os_workflow_definitions,
  public.agent_os_workflow_stages,
  public.agent_os_communication_policies,
  public.agent_os_escalation_policies,
  public.agent_os_reporting_schedules,
  public.agent_os_department_intelligence to service_role;

comment on table public.agent_os_workflow_definitions is 'Versioned Agent OS workflows for sponsorship, volunteer, board, and future case types.';
comment on table public.agent_os_workflow_stages is 'Ordered workflow stages with ownership, automation, visibility, and approval requirements.';
comment on table public.agent_os_communication_policies is 'Approved automatic, draft-review, and human-only communication authority matrix.';
comment on table public.agent_os_escalation_policies is 'Overdue and urgent escalation routing rules.';
comment on table public.agent_os_reporting_schedules is 'Official weekday reporting rhythm for specialists, directors, VPs, Noemi Vale, and the CEO.';
comment on table public.agent_os_department_intelligence is 'Department monitoring scopes and standard executive intelligence outputs.';
