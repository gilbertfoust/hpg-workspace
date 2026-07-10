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

create index if not exists agent_runs_approval_idx on public.agent_runs(approval_id);
create index if not exists agent_runs_department_idx on public.agent_runs(department_id);
create index if not exists agent_runs_supervisor_idx on public.agent_runs(supervisor_user_id);

create index if not exists case_registry_created_by_idx on public.case_registry(created_by_user_id);
create index if not exists case_registry_supervisor_idx on public.case_registry(supervisor_user_id);

create index if not exists case_stage_history_approval_idx on public.case_stage_history(approval_id);
create index if not exists case_stage_history_changed_by_idx on public.case_stage_history(changed_by_user_id);

create index if not exists communication_queue_created_by_idx on public.communication_queue(created_by_user_id);
create index if not exists communication_queue_department_idx on public.communication_queue(department_id);
create index if not exists communication_queue_reviewer_idx on public.communication_queue(reviewer_user_id);
create index if not exists communication_queue_work_item_idx on public.communication_queue(work_item_id);

create index if not exists trello_route_mappings_created_by_idx on public.trello_route_mappings(created_by_user_id);
create index if not exists trello_sync_queue_work_item_idx on public.trello_sync_queue(work_item_id);

-- ---------------------------------------------------------------------------
-- Replace Agent OS policies with non-overlapping, statement-cached predicates.
-- All listed tables are owned by the Agent OS runtime.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name, p.polname as policy_name
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'case_registry',
        'case_stage_history',
        'agent_runs',
        'communication_queue',
        'trello_sync_queue',
        'agent_os_external_form_invitations',
        'case_reference_counters',
        'agent_os_workflow_stages',
        'agent_os_workflow_transitions',
        'trello_route_mappings',
        'agent_os_activation_fee_policies'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policy_name, r.schema_name, r.table_name);
  end loop;
end $$;

-- Cases
create policy "Agent OS internal case read"
  on public.case_registry for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal case insert"
  on public.case_registry for insert to authenticated
  with check ((select public.is_internal_user()));
create policy "Agent OS internal case update"
  on public.case_registry for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));
create policy "Agent OS super admin case delete"
  on public.case_registry for delete to authenticated
  using ((select public.is_super_admin()));

-- Stage history
create policy "Agent OS internal history read"
  on public.case_stage_history for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal history insert"
  on public.case_stage_history for insert to authenticated
  with check ((select public.is_internal_user()));

-- Agent audit runs
create policy "Agent OS internal run read"
  on public.agent_runs for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal run insert"
  on public.agent_runs for insert to authenticated
  with check ((select public.is_internal_user()));
create policy "Agent OS internal run update"
  on public.agent_runs for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

-- Controlled communications
create policy "Agent OS internal communication read"
  on public.communication_queue for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal communication insert"
  on public.communication_queue for insert to authenticated
  with check ((select public.is_internal_user()));
create policy "Agent OS internal communication update"
  on public.communication_queue for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));
create policy "Agent OS super admin communication delete"
  on public.communication_queue for delete to authenticated
  using ((select public.is_super_admin()));

-- Trello synchronization queue
create policy "Agent OS internal Trello queue read"
  on public.trello_sync_queue for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal Trello queue insert"
  on public.trello_sync_queue for insert to authenticated
  with check ((select public.is_internal_user()));
create policy "Agent OS internal Trello queue update"
  on public.trello_sync_queue for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));
create policy "Agent OS super admin Trello queue delete"
  on public.trello_sync_queue for delete to authenticated
  using ((select public.is_super_admin()));

-- Secure external-form invitations
create policy "Agent OS internal invitation read"
  on public.agent_os_external_form_invitations for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS internal invitation insert"
  on public.agent_os_external_form_invitations for insert to authenticated
  with check ((select public.is_internal_user()));
create policy "Agent OS internal invitation update"
  on public.agent_os_external_form_invitations for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));
create policy "Agent OS super admin invitation delete"
  on public.agent_os_external_form_invitations for delete to authenticated
  using ((select public.is_super_admin()));

-- Counter table remains read-only to super administrators.
create policy "Agent OS super admin counter read"
  on public.case_reference_counters for select to authenticated
  using ((select public.is_super_admin()));

-- Configuration registries: internal read, explicit super-admin mutations.
create policy "Agent OS internal workflow stage read"
  on public.agent_os_workflow_stages for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS super admin workflow stage insert"
  on public.agent_os_workflow_stages for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Agent OS super admin workflow stage update"
  on public.agent_os_workflow_stages for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "Agent OS super admin workflow stage delete"
  on public.agent_os_workflow_stages for delete to authenticated
  using ((select public.is_super_admin()));

create policy "Agent OS internal workflow transition read"
  on public.agent_os_workflow_transitions for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS super admin workflow transition insert"
  on public.agent_os_workflow_transitions for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Agent OS super admin workflow transition update"
  on public.agent_os_workflow_transitions for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "Agent OS super admin workflow transition delete"
  on public.agent_os_workflow_transitions for delete to authenticated
  using ((select public.is_super_admin()));

create policy "Agent OS internal Trello route read"
  on public.trello_route_mappings for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS super admin Trello route insert"
  on public.trello_route_mappings for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Agent OS super admin Trello route update"
  on public.trello_route_mappings for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "Agent OS super admin Trello route delete"
  on public.trello_route_mappings for delete to authenticated
  using ((select public.is_super_admin()));

create policy "Agent OS internal fee policy read"
  on public.agent_os_activation_fee_policies for select to authenticated
  using ((select public.is_internal_user()));
create policy "Agent OS super admin fee policy insert"
  on public.agent_os_activation_fee_policies for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "Agent OS super admin fee policy update"
  on public.agent_os_activation_fee_policies for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy "Agent OS super admin fee policy delete"
  on public.agent_os_activation_fee_policies for delete to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Intake policies introduced by Agent OS security hardening.
-- ---------------------------------------------------------------------------

drop policy if exists "Internal users can read volunteer applications" on public.volunteer_applications;
drop policy if exists "Internal users can update volunteer applications" on public.volunteer_applications;
create policy "Internal users can read volunteer applications"
  on public.volunteer_applications for select to authenticated
  using ((select public.is_internal_user()));
create policy "Internal users can update volunteer applications"
  on public.volunteer_applications for update to authenticated
  using ((select public.is_internal_user())) with check ((select public.is_internal_user()));

drop policy if exists "Internal users can read sponsorship applications" on public.sponsorship_applications;
drop policy if exists "Internal users can update sponsorship applications" on public.sponsorship_applications;
create policy "Internal users can read sponsorship applications"
  on public.sponsorship_applications for select to authenticated
  using ((select public.is_internal_user()));
create policy "Internal users can update sponsorship applications"
  on public.sponsorship_applications for update to authenticated
  using ((select public.is_internal_user())) with check ((select public.is_internal_user()));

drop policy if exists "Internal users can read board applications" on public.board_applications;
drop policy if exists "Internal users can update board applications" on public.board_applications;
create policy "Internal users can read board applications"
  on public.board_applications for select to authenticated
  using ((select public.is_internal_user()));
create policy "Internal users can update board applications"
  on public.board_applications for update to authenticated
  using ((select public.is_internal_user())) with check ((select public.is_internal_user()));

-- HR outbox is optional during clean replay.
do $$
begin
  if to_regclass('public.hr_email_outbox') is not null then
    execute 'drop policy if exists "Internal users can read HR email outbox" on public.hr_email_outbox';
    execute 'create policy "Internal users can read HR email outbox" on public.hr_email_outbox for select to authenticated using ((select public.is_internal_user()))';
  end if;
end $$;
