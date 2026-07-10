-- Agent OS performance hardening
-- Adds indexes for Agent OS foreign-key access paths and rewrites Agent OS RLS
-- predicates so authorization helpers are evaluated once per statement.

-- ---------------------------------------------------------------------------
-- Foreign-key indexes
-- ---------------------------------------------------------------------------

create index if not exists agent_os_external_form_invitations_created_by_idx
  on public.agent_os_external_form_invitations(created_by_user_id);
create index if not exists agent_os_external_form_invitations_form_template_idx
  on public.agent_os_external_form_invitations(form_template_id);
create index if not exists agent_os_external_form_invitations_revoked_by_idx
  on public.agent_os_external_form_invitations(revoked_by_user_id);

create index if not exists agent_runs_approval_idx
  on public.agent_runs(approval_id);
create index if not exists agent_runs_department_idx
  on public.agent_runs(department_id);
create index if not exists agent_runs_supervisor_idx
  on public.agent_runs(supervisor_user_id);

create index if not exists case_registry_created_by_idx
  on public.case_registry(created_by_user_id);
create index if not exists case_registry_supervisor_idx
  on public.case_registry(supervisor_user_id);

create index if not exists case_stage_history_approval_idx
  on public.case_stage_history(approval_id);
create index if not exists case_stage_history_changed_by_idx
  on public.case_stage_history(changed_by_user_id);

create index if not exists communication_queue_created_by_idx
  on public.communication_queue(created_by_user_id);
create index if not exists communication_queue_department_idx
  on public.communication_queue(department_id);
create index if not exists communication_queue_reviewer_idx
  on public.communication_queue(reviewer_user_id);
create index if not exists communication_queue_work_item_idx
  on public.communication_queue(work_item_id);

create index if not exists trello_route_mappings_created_by_idx
  on public.trello_route_mappings(created_by_user_id);
create index if not exists trello_sync_queue_work_item_idx
  on public.trello_sync_queue(work_item_id);

-- ---------------------------------------------------------------------------
-- Core Agent OS RLS policies
-- ---------------------------------------------------------------------------

-- Case registry
drop policy if exists "Internal users can read Agent OS cases" on public.case_registry;
create policy "Internal users can read Agent OS cases"
  on public.case_registry for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create Agent OS cases" on public.case_registry;
create policy "Internal users can create Agent OS cases"
  on public.case_registry for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update Agent OS cases" on public.case_registry;
create policy "Internal users can update Agent OS cases"
  on public.case_registry for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete Agent OS cases" on public.case_registry;
create policy "Super admins can delete Agent OS cases"
  on public.case_registry for delete to authenticated
  using ((select public.is_super_admin()));

-- Stage history
drop policy if exists "Internal users can read case stage history" on public.case_stage_history;
create policy "Internal users can read case stage history"
  on public.case_stage_history for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create case stage history" on public.case_stage_history;
create policy "Internal users can create case stage history"
  on public.case_stage_history for insert to authenticated
  with check ((select public.is_internal_user()));

-- Agent run audit records
drop policy if exists "Internal users can read agent runs" on public.agent_runs;
create policy "Internal users can read agent runs"
  on public.agent_runs for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create agent runs" on public.agent_runs;
create policy "Internal users can create agent runs"
  on public.agent_runs for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update agent runs" on public.agent_runs;
create policy "Internal users can update agent runs"
  on public.agent_runs for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

-- Controlled communications
drop policy if exists "Internal users can read communication queue" on public.communication_queue;
create policy "Internal users can read communication queue"
  on public.communication_queue for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create communication queue" on public.communication_queue;
create policy "Internal users can create communication queue"
  on public.communication_queue for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update communication queue" on public.communication_queue;
create policy "Internal users can update communication queue"
  on public.communication_queue for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete communication queue records" on public.communication_queue;
create policy "Super admins can delete communication queue records"
  on public.communication_queue for delete to authenticated
  using ((select public.is_super_admin()));

-- Trello queue
drop policy if exists "Internal users can read Trello sync queue" on public.trello_sync_queue;
create policy "Internal users can read Trello sync queue"
  on public.trello_sync_queue for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create Trello sync queue" on public.trello_sync_queue;
create policy "Internal users can create Trello sync queue"
  on public.trello_sync_queue for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update Trello sync queue" on public.trello_sync_queue;
create policy "Internal users can update Trello sync queue"
  on public.trello_sync_queue for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete Trello sync queue records" on public.trello_sync_queue;
create policy "Super admins can delete Trello sync queue records"
  on public.trello_sync_queue for delete to authenticated
  using ((select public.is_super_admin()));

-- External form invitations
drop policy if exists "Internal users can read external form invitations" on public.agent_os_external_form_invitations;
create policy "Internal users can read external form invitations"
  on public.agent_os_external_form_invitations for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create external form invitations" on public.agent_os_external_form_invitations;
create policy "Internal users can create external form invitations"
  on public.agent_os_external_form_invitations for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update external form invitations" on public.agent_os_external_form_invitations;
create policy "Internal users can update external form invitations"
  on public.agent_os_external_form_invitations for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete external form invitations" on public.agent_os_external_form_invitations;
create policy "Super admins can delete external form invitations"
  on public.agent_os_external_form_invitations for delete to authenticated
  using ((select public.is_super_admin()));

-- Counter read access
drop policy if exists "Super admins can read Agent OS case counters" on public.case_reference_counters;
create policy "Super admins can read Agent OS case counters"
  on public.case_reference_counters for select to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Configuration registries: internal read + explicit super-admin mutations
-- Avoid overlapping SELECT and ALL policies.
-- ---------------------------------------------------------------------------

-- Workflow stages
drop policy if exists "Internal users can read Agent OS workflow stages" on public.agent_os_workflow_stages;
create policy "Internal users can read Agent OS workflow stages"
  on public.agent_os_workflow_stages for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Super admins can manage Agent OS workflow stages" on public.agent_os_workflow_stages;
drop policy if exists "Super admins can insert Agent OS workflow stages" on public.agent_os_workflow_stages;
drop policy if exists "Super admins can update Agent OS workflow stages" on public.agent_os_workflow_stages;
drop policy if exists "Super admins can delete Agent OS workflow stages" on public.agent_os_workflow_stages;
create policy "Super admins can insert Agent OS workflow stages"
  on public.agent_os_workflow_stages for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Super admins can update Agent OS workflow stages"
  on public.agent_os_workflow_stages for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can delete Agent OS workflow stages"
  on public.agent_os_workflow_stages for delete to authenticated
  using ((select public.is_super_admin()));

-- Workflow transitions
drop policy if exists "Internal users can read Agent OS workflow transitions" on public.agent_os_workflow_transitions;
create policy "Internal users can read Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Super admins can manage Agent OS workflow transitions" on public.agent_os_workflow_transitions;
drop policy if exists "Super admins can insert Agent OS workflow transitions" on public.agent_os_workflow_transitions;
drop policy if exists "Super admins can update Agent OS workflow transitions" on public.agent_os_workflow_transitions;
drop policy if exists "Super admins can delete Agent OS workflow transitions" on public.agent_os_workflow_transitions;
create policy "Super admins can insert Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Super admins can update Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can delete Agent OS workflow transitions"
  on public.agent_os_workflow_transitions for delete to authenticated
  using ((select public.is_super_admin()));

-- Trello route mappings
drop policy if exists "Internal users can read Trello route mappings" on public.trello_route_mappings;
create policy "Internal users can read Trello route mappings"
  on public.trello_route_mappings for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Super admins can manage Trello route mappings" on public.trello_route_mappings;
drop policy if exists "Super admins can insert Trello route mappings" on public.trello_route_mappings;
drop policy if exists "Super admins can update Trello route mappings" on public.trello_route_mappings;
drop policy if exists "Super admins can delete Trello route mappings" on public.trello_route_mappings;
create policy "Super admins can insert Trello route mappings"
  on public.trello_route_mappings for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Super admins can update Trello route mappings"
  on public.trello_route_mappings for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can delete Trello route mappings"
  on public.trello_route_mappings for delete to authenticated
  using ((select public.is_super_admin()));

-- Activation-fee policies
drop policy if exists "Internal users can read Agent OS activation fee policies" on public.agent_os_activation_fee_policies;
create policy "Internal users can read Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Super admins can manage Agent OS activation fee policies" on public.agent_os_activation_fee_policies;
drop policy if exists "Super admins can insert Agent OS activation fee policies" on public.agent_os_activation_fee_policies;
drop policy if exists "Super admins can update Agent OS activation fee policies" on public.agent_os_activation_fee_policies;
drop policy if exists "Super admins can delete Agent OS activation fee policies" on public.agent_os_activation_fee_policies;
create policy "Super admins can insert Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Super admins can update Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can delete Agent OS activation fee policies"
  on public.agent_os_activation_fee_policies for delete to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Application intake policies added by Agent OS security hardening
-- ---------------------------------------------------------------------------

foreach_table: do $$
begin
  -- Marker block retained only to make the following explicit statements easy
  -- to distinguish in migration diagnostics.
end $$;

drop policy if exists "Internal users can read volunteer applications" on public.volunteer_applications;
create policy "Internal users can read volunteer applications"
  on public.volunteer_applications for select to authenticated
  using ((select public.is_internal_user()));
drop policy if exists "Internal users can update volunteer applications" on public.volunteer_applications;
create policy "Internal users can update volunteer applications"
  on public.volunteer_applications for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can read sponsorship applications" on public.sponsorship_applications;
create policy "Internal users can read sponsorship applications"
  on public.sponsorship_applications for select to authenticated
  using ((select public.is_internal_user()));
drop policy if exists "Internal users can update sponsorship applications" on public.sponsorship_applications;
create policy "Internal users can update sponsorship applications"
  on public.sponsorship_applications for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can read board applications" on public.board_applications;
create policy "Internal users can read board applications"
  on public.board_applications for select to authenticated
  using ((select public.is_internal_user()));
drop policy if exists "Internal users can update board applications" on public.board_applications;
create policy "Internal users can update board applications"
  on public.board_applications for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

-- HR outbox is optional during a clean replay; optimize its policy only when present.
do $$
begin
  if to_regclass('public.hr_email_outbox') is not null then
    execute 'drop policy if exists "Internal users can read HR email outbox" on public.hr_email_outbox';
    execute 'create policy "Internal users can read HR email outbox" on public.hr_email_outbox for select to authenticated using ((select public.is_internal_user()))';
  end if;
end $$;
