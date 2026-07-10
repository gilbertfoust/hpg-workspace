-- Agent OS workflow stage registry and controlled transition helper.

create table if not exists public.agent_os_workflow_stages (
  workflow_type text not null,
  stage_key text not null,
  stage_order integer not null,
  stage_name text not null,
  responsible_department_module text,
  responsible_role text,
  human_gate boolean not null default false,
  approval_required boolean not null default false,
  board_triggered boolean not null default false,
  default_communication_authority text not null default 'automatic'
    check (default_communication_authority in ('automatic','draft_for_review','human_only')),
  terminal_stage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workflow_type, stage_key),
  unique (workflow_type, stage_order)
);

create table if not exists public.agent_os_workflow_transitions (
  workflow_type text not null,
  from_stage text not null,
  to_stage text not null,
  transition_name text,
  requires_reason boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (workflow_type, from_stage, to_stage),
  foreign key (workflow_type, from_stage)
    references public.agent_os_workflow_stages(workflow_type, stage_key) on delete cascade,
  foreign key (workflow_type, to_stage)
    references public.agent_os_workflow_stages(workflow_type, stage_key) on delete cascade
);

insert into public.agent_os_workflow_stages(
  workflow_type, stage_key, stage_order, stage_name,
  responsible_department_module, responsible_role,
  human_gate, approval_required, board_triggered,
  default_communication_authority, terminal_stage
) values
-- Sponsorship pipeline
('sponsorship','new_inquiry',1,'New Inquiry','development','Partnership Development',false,false,false,'automatic',false),
('sponsorship','application_requested',2,'Application Requested','development','Partnership Development',false,false,false,'automatic',false),
('sponsorship','application_received',3,'Application Received','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','initial_eligibility_review',4,'Initial Eligibility Review','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','documents_requested',5,'Documents Requested','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','documents_partially_received',6,'Documents Partially Received','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','document_collection_complete',7,'Document Collection Complete','development','Partnership Development',true,false,false,'automatic',false),
('sponsorship','due_diligence_in_progress',8,'Due Diligence in Progress','program','Program and General Counsel',false,false,false,'draft_for_review',false),
('sponsorship','clarification_requested',9,'Clarification Requested','development','Partnership Development',false,false,false,'draft_for_review',false),
('sponsorship','interview_ready',10,'Interview Ready','development','Partnership Development',true,false,false,'automatic',false),
('sponsorship','interview_scheduling_awaiting_human_action',11,'Interview Scheduling Awaiting Human Action','development','Authorized Human Scheduler',true,true,false,'human_only',false),
('sponsorship','interview_completed',12,'Interview Completed','development','Human Interviewer',true,false,false,'human_only',false),
('sponsorship','program_review',13,'Program Review','program','Program Department',true,false,false,'draft_for_review',false),
('sponsorship','finance_review',14,'Finance Review','finance','Finance Department',true,false,false,'draft_for_review',false),
('sponsorship','general_counsel_review',15,'General Counsel Review','legal','General Counsel Department',true,false,false,'human_only',false),
('sponsorship','development_review',16,'Development Review','development','Development Vice President',true,false,false,'human_only',false),
('sponsorship','executive_review',17,'Executive Review','administration','CEO / Executive Leadership',true,true,false,'human_only',false),
('sponsorship','board_review',18,'Board Review — When Triggered','administration','Board of Directors',true,true,true,'human_only',false),
('sponsorship','conditional_approval',19,'Conditional Approval','development','Development Vice President',true,true,false,'human_only',false),
('sponsorship','final_sponsorship_approval',20,'Final Sponsorship Approval','development','Development Vice President',true,true,false,'human_only',false),
('sponsorship','agreement_preparation',21,'Agreement Preparation','legal','General Counsel Department',true,false,false,'human_only',false),
('sponsorship','agreement_approved_by_general_counsel',22,'Agreement Approved by General Counsel','legal','General Counsel Department',true,true,false,'human_only',false),
('sponsorship','agreement_signed',23,'Agreement Signed','development','Authorized HPG Signer',true,true,false,'human_only',false),
('sponsorship','onboarding_fee_form_sent',24,'Onboarding Fee Form Sent','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','onboarding_fee_payment_pending',25,'Onboarding Fee Payment Pending','finance','Finance Department',false,false,false,'automatic',false),
('sponsorship','payment_received_verified',26,'Payment Received and Verified','finance','Finance Department',true,true,false,'human_only',false),
('sponsorship','confirmation_letter_issued',27,'Confirmation Letter Issued','development','Development Executive Secretary',false,false,false,'automatic',false),
('sponsorship','activation_processed',28,'Activation Processed','development','Development Executive Secretary',true,false,false,'automatic',false),
('sponsorship','transferred_to_ngo_coordination',29,'Transferred to NGO Coordination','ngo_coordination','NGO Coordination',false,false,false,'automatic',false),
('sponsorship','onboarding_in_progress',30,'Onboarding in Progress','ngo_coordination','NGO Coordination',false,false,false,'automatic',false),
('sponsorship','active_sponsored_ngo',31,'Active Sponsored NGO','ngo_coordination','Program / NGO Coordination',true,false,false,'automatic',false),
('sponsorship','ongoing_monitoring',32,'Ongoing Monitoring','program','Program VP / NGO Coordination',false,false,false,'automatic',false),
('sponsorship','corrective_action_graduation_termination_archive',33,'Corrective Action, Graduation, Termination, or Archive','program','Program VP / Authorized Human',true,true,false,'human_only',true),
-- Volunteer pipeline
('volunteer','application_received',1,'Application Received','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','acknowledgment_sent',2,'Acknowledgment Sent','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','resume_requested',3,'Résumé Requested','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','completeness_check',4,'Application Completeness Check','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','missing_information_requested',5,'Missing Information Requested','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','resume_received',6,'Résumé Received','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','skills_experience_analysis',7,'Skills and Experience Analysis','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','department_fit_recommendation',8,'Department Fit Recommendation','hr','Recruitment',false,false,false,'draft_for_review',false),
('volunteer','credentials_certification_review',9,'Credentials and Certification Review','hr','Recruitment',false,false,false,'draft_for_review',false),
('volunteer','background_screening',10,'Background Screening','hr','Human Resources',true,false,false,'human_only',false),
('volunteer','interview_recommended',11,'Interview Recommended','hr','Human Resources',true,false,false,'draft_for_review',false),
('volunteer','availability_requested',12,'Availability Requested','hr','Recruitment',false,false,false,'automatic',false),
('volunteer','interview_scheduling_awaiting_human_action',13,'Interview Scheduling Awaiting Human Action','hr','Authorized Human Scheduler',true,true,false,'human_only',false),
('volunteer','interview_completed',14,'Interview Completed','hr','Human Interviewer',true,false,false,'human_only',false),
('volunteer','human_acceptance_decision',15,'Human Acceptance Decision','hr','Human Resources',true,true,false,'human_only',false),
('volunteer','department_placement_approved',16,'Department Placement Approved','hr','Human Resources',true,true,false,'human_only',false),
('volunteer','offer_letter_generated',17,'Offer Letter Generated','hr','Human Resources',false,false,false,'automatic',false),
('volunteer','hr_vp_signed',18,'HR Vice President Signed','hr','HR Vice President',true,true,false,'human_only',false),
('volunteer','volunteer_countersigned',19,'Volunteer Countersigned','hr','Volunteer Applicant',true,false,false,'automatic',false),
('volunteer','onboarding_packet_sent',20,'Onboarding Packet Sent','hr','Human Resources',false,false,false,'automatic',false),
('volunteer','nonprofitready_training_assigned',21,'NonprofitReady Training Assigned','hr','Human Resources',false,false,false,'automatic',false),
('volunteer','systems_access_provisioning',22,'Systems Access Provisioning','it','Technology',true,false,false,'draft_for_review',false),
('volunteer','orientation',23,'Orientation','hr','Human Resources',true,false,false,'automatic',false),
('volunteer','active_volunteer',24,'Active Volunteer','hr','HR / Department Supervisor',true,false,false,'automatic',false),
('volunteer','thirty_day_review',25,'30-Day Review','hr','Department Supervisor',true,false,false,'draft_for_review',false),
('volunteer','ongoing_engagement',26,'Ongoing Engagement Monitoring','hr','HR / Department Supervisor',false,false,false,'automatic',false),
('volunteer','rejected_reassigned_or_closed',27,'Rejected, Reassigned, Inactive, or Closed','hr','Authorized Human Resources',true,true,false,'human_only',true),
-- Board pipeline
('board','application_received',1,'Application Received','administration','Nominations Intake',false,false,false,'automatic',false),
('board','acknowledgment_sent',2,'Acknowledgment Sent','administration','Nominations Intake',false,false,false,'automatic',false),
('board','resume_requested',3,'Résumé Requested','administration','Nominations Intake',false,false,false,'automatic',false),
('board','completeness_check',4,'Application Completeness Check','administration','Nominations Intake',false,false,false,'automatic',false),
('board','missing_information_requested',5,'Missing Information Requested','administration','Nominations Intake',false,false,false,'automatic',false),
('board','background_screening',6,'Background Screening','hr','HR / Nominations',true,false,false,'human_only',false),
('board','governance_eligibility_review',7,'Governance and Eligibility Review','administration','Nominations Committee',true,false,false,'human_only',false),
('board','skills_board_fit_analysis',8,'Skills and Board-Fit Analysis','administration','Nominations Committee',false,false,false,'draft_for_review',false),
('board','nominations_review',9,'Nominations Review','administration','Nominations Committee',true,false,false,'human_only',false),
('board','interview_recommended',10,'Interview Recommended','administration','Nominations Committee',true,false,false,'draft_for_review',false),
('board','availability_requested',11,'Availability Requested','administration','Nominations Intake',false,false,false,'automatic',false),
('board','interview_scheduling_awaiting_human_action',12,'Interview Scheduling Awaiting Human Action','administration','Authorized Human Scheduler',true,true,false,'human_only',false),
('board','interview_completed',13,'Interview Completed','administration','Human Interview Panel',true,false,false,'human_only',false),
('board','nominations_committee_recommendation',14,'Nominations Committee Recommendation','administration','Nominations Committee',true,true,false,'human_only',false),
('board','board_review',15,'Board Review','administration','Board of Directors',true,true,true,'human_only',false),
('board','board_vote',16,'Board Vote','administration','Board of Directors',true,true,true,'human_only',false),
('board','conditionally_approved',17,'Conditionally Approved','administration','Board / Nominations',true,true,true,'human_only',false),
('board','appointed',18,'Appointed','administration','Authorized Governance Officer',true,true,true,'human_only',false),
('board','onboarding_training',19,'Board Onboarding and Training','administration','Administration / HR',false,false,false,'automatic',false),
('board','active_board_member',20,'Active Board Member','administration','Board Leadership',true,false,true,'automatic',false),
('board','rejected_or_archived',21,'Rejected or Archived','administration','Nominations / Board',true,true,true,'human_only',true)
on conflict (workflow_type, stage_key) do update set
  stage_order = excluded.stage_order,
  stage_name = excluded.stage_name,
  responsible_department_module = excluded.responsible_department_module,
  responsible_role = excluded.responsible_role,
  human_gate = excluded.human_gate,
  approval_required = excluded.approval_required,
  board_triggered = excluded.board_triggered,
  default_communication_authority = excluded.default_communication_authority,
  terminal_stage = excluded.terminal_stage,
  updated_at = now();

with ordered as (
  select workflow_type, stage_key as from_stage,
         lead(stage_key) over (partition by workflow_type order by stage_order) as to_stage
  from public.agent_os_workflow_stages
  where workflow_type in ('sponsorship','volunteer','board')
)
insert into public.agent_os_workflow_transitions(
  workflow_type, from_stage, to_stage, transition_name
)
select workflow_type, from_stage, to_stage, 'Advance to next approved stage'
from ordered
where to_stage is not null
on conflict do nothing;

insert into public.agent_os_workflow_transitions(
  workflow_type, from_stage, to_stage, transition_name, requires_reason
) values
('sponsorship','documents_partially_received','documents_requested','Request remaining or corrected documents',true),
('sponsorship','due_diligence_in_progress','clarification_requested','Request due-diligence clarification',true),
('sponsorship','clarification_requested','due_diligence_in_progress','Resume due diligence after clarification',true),
('sponsorship','program_review','clarification_requested','Request program clarification',true),
('sponsorship','finance_review','clarification_requested','Request financial clarification',true),
('sponsorship','general_counsel_review','clarification_requested','Request legal or compliance clarification',true),
('sponsorship','development_review','clarification_requested','Request development clarification',true),
('sponsorship','conditional_approval','clarification_requested','Resolve approval conditions',true),
('sponsorship','ongoing_monitoring','corrective_action_graduation_termination_archive','Escalate relationship outcome',true),
('volunteer','missing_information_requested','completeness_check','Resume completeness review',true),
('volunteer','human_acceptance_decision','rejected_reassigned_or_closed','Record rejection or closure',true),
('volunteer','active_volunteer','rejected_reassigned_or_closed','Reassign, inactivate, or close',true),
('volunteer','ongoing_engagement','rejected_reassigned_or_closed','Close after human review',true),
('board','missing_information_requested','completeness_check','Resume completeness review',true),
('board','nominations_review','rejected_or_archived','Record committee rejection or archive',true),
('board','board_vote','rejected_or_archived','Record unsuccessful vote',true),
('board','conditionally_approved','rejected_or_archived','Close unresolved conditions',true)
on conflict (workflow_type, from_stage, to_stage) do update set
  transition_name = excluded.transition_name,
  requires_reason = excluded.requires_reason;

create or replace function public.agent_os_transition_case(
  p_case_id uuid,
  p_to_stage text,
  p_reason text default null,
  p_approval_id uuid default null,
  p_changed_by_agent text default null
)
returns public.case_registry
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.case_registry;
  v_stage public.agent_os_workflow_stages;
  v_transition public.agent_os_workflow_transitions;
  v_approval_valid boolean;
  v_history_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Internal HPG authority is required to transition an Agent OS case';
  end if;

  select * into v_case from public.case_registry where id = p_case_id for update;
  if not found then raise exception 'Agent OS case not found'; end if;
  if v_case.case_type not in ('sponsorship','volunteer','board') then
    raise exception 'No controlled workflow is registered for case type %', v_case.case_type;
  end if;

  select * into v_stage
  from public.agent_os_workflow_stages
  where workflow_type = v_case.case_type and stage_key = p_to_stage;
  if not found then raise exception 'Unknown % stage: %', v_case.case_type, p_to_stage; end if;
  if v_case.workflow_stage = p_to_stage then return v_case; end if;

  select * into v_transition
  from public.agent_os_workflow_transitions
  where workflow_type = v_case.case_type
    and from_stage = v_case.workflow_stage
    and to_stage = p_to_stage;
  if not found then
    raise exception 'Transition from % to % is not allowed', v_case.workflow_stage, p_to_stage;
  end if;
  if v_transition.requires_reason and nullif(btrim(coalesce(p_reason,'')), '') is null then
    raise exception 'A reason is required for transition from % to %', v_case.workflow_stage, p_to_stage;
  end if;

  if v_stage.approval_required then
    select exists(
      select 1 from public.approvals a
      where a.id = p_approval_id
        and lower(coalesce(a.decision,'')) in ('approved','approve','accepted','accept')
        and a.decided_at is not null
    ) into v_approval_valid;
    if not v_approval_valid then
      raise exception 'An approved human approval record is required for stage %', p_to_stage;
    end if;
  end if;

  update public.case_registry
  set workflow_stage = p_to_stage,
      approval_required = v_stage.approval_required,
      last_human_review_at = case when auth.uid() is not null then now() else last_human_review_at end,
      updated_at = now()
  where id = p_case_id
  returning * into v_case;

  select h.id into v_history_id
  from public.case_stage_history h
  where h.case_registry_id = p_case_id and h.to_stage = p_to_stage
  order by h.created_at desc limit 1;

  if v_history_id is not null then
    update public.case_stage_history
    set reason = coalesce(nullif(btrim(coalesce(p_reason,'')), ''), 'Approved workflow transition'),
        changed_by_user_id = auth.uid(),
        changed_by_agent = nullif(btrim(coalesce(p_changed_by_agent,'')), ''),
        approval_id = p_approval_id,
        evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
          'workflow_type',v_case.case_type,
          'stage_name',v_stage.stage_name,
          'human_gate',v_stage.human_gate,
          'board_triggered',v_stage.board_triggered
        )
    where id = v_history_id;
  end if;

  return v_case;
end;
$$;

revoke all on function public.agent_os_transition_case(uuid,text,text,uuid,text) from public, anon;
grant execute on function public.agent_os_transition_case(uuid,text,text,uuid,text) to authenticated, service_role;

alter table public.agent_os_workflow_stages enable row level security;
alter table public.agent_os_workflow_transitions enable row level security;

create policy "Internal users can read Agent OS workflow stages"
  on public.agent_os_workflow_stages for select to authenticated
  using (public.is_internal_user());
create policy "Super admins can manage Agent OS workflow stages"
  on public.agent_os_workflow_stages for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Internal users can read Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for select to authenticated
  using (public.is_internal_user());
create policy "Super admins can manage Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.agent_os_workflow_stages, public.agent_os_workflow_transitions to authenticated;
grant all on public.agent_os_workflow_stages, public.agent_os_workflow_transitions to service_role;

create or replace view public.agent_os_case_pipeline
with (security_invoker = true)
as
select c.id, c.reference_number, c.case_type, c.organization_name, c.person_name,
       c.workflow_stage, s.stage_order, s.stage_name,
       s.responsible_department_module, s.responsible_role,
       s.human_gate, s.approval_required as stage_approval_required,
       s.board_triggered, s.default_communication_authority, s.terminal_stage,
       c.status, c.priority, c.risk_level, c.match_confidence,
       c.next_action, c.due_at, c.updated_at
from public.case_registry c
left join public.agent_os_workflow_stages s
  on s.workflow_type = c.case_type and s.stage_key = c.workflow_stage
where c.archived_at is null;

grant select on public.agent_os_case_pipeline to authenticated;

comment on table public.agent_os_workflow_stages
  is 'Approved sponsorship, volunteer, and board stages with responsible roles and human gates.';
comment on function public.agent_os_transition_case(uuid,text,text,uuid,text)
  is 'Controlled case transition path enforcing registered transitions, reasons, and human approvals.';
