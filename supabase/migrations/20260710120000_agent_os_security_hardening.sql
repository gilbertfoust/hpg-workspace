-- Agent OS security hardening
-- Removes trigger-only functions from the exposed RPC surface and applies
-- least-privilege access to application intake and HR email queue records.

alter function public.agent_os_is_us_country(text) set search_path = public;

-- Trigger-only helpers must not be callable through PostgREST RPC.
revoke all on function public.agent_os_activation_fee_stage_guard() from public, anon, authenticated;
revoke all on function public.agent_os_after_activation_fee_submission() from public, anon, authenticated;
revoke all on function public.agent_os_assign_reference_number() from public, anon, authenticated;
revoke all on function public.agent_os_cancel_revoked_invitation_communications() from public, anon, authenticated;
revoke all on function public.agent_os_record_stage_change() from public, anon, authenticated;
revoke all on function public.agent_os_register_board_application() from public, anon, authenticated;
revoke all on function public.agent_os_register_sponsorship_application() from public, anon, authenticated;
revoke all on function public.agent_os_register_volunteer_application() from public, anon, authenticated;
revoke all on function public.agent_os_route_fee_after_agreement() from public, anon, authenticated;
revoke all on function public.agent_os_set_updated_at() from public, anon, authenticated;
revoke all on function public.agent_os_sync_external_form_delivery() from public, anon, authenticated;
revoke all on function public.agent_os_validate_activation_fee_submission() from public, anon, authenticated;

-- Public-facing helpers are never anonymous. Signed-in calls remain subject to
-- the internal-role and Finance-authority checks inside each function.
revoke all on function public.next_hpg_reference_number(text) from public, anon;
grant execute on function public.next_hpg_reference_number(text) to authenticated, service_role;

revoke all on function public.agent_os_route_activation_fee(uuid) from public, anon;
grant execute on function public.agent_os_route_activation_fee(uuid) to authenticated, service_role;

revoke all on function public.agent_os_transition_case(uuid,text,text,uuid,text) from public, anon;
grant execute on function public.agent_os_transition_case(uuid,text,text,uuid,text) to authenticated, service_role;

revoke all on function public.agent_os_has_finance_authority() from public, anon;
grant execute on function public.agent_os_has_finance_authority() to authenticated, service_role;

revoke all on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) from public, anon;
grant execute on function public.agent_os_verify_activation_fee(uuid,text,timestamptz) to authenticated, service_role;

revoke all on function public.agent_os_is_us_country(text) from public, anon, authenticated;
grant execute on function public.agent_os_is_us_country(text) to service_role;

-- Case counters are not public. Super administrators receive read-only access;
-- all mutation remains confined to the controlled reference-number functions.
drop policy if exists "Super admins can read Agent OS case counters" on public.case_reference_counters;
create policy "Super admins can read Agent OS case counters"
  on public.case_reference_counters for select to authenticated
  using (public.is_super_admin());

-- Public application submission continues through the existing controlled
-- website/backend path. Direct table access is limited to internal staff.
alter table public.volunteer_applications enable row level security;
alter table public.sponsorship_applications enable row level security;
alter table public.board_applications enable row level security;
alter table public.hr_email_outbox enable row level security;

revoke all on public.volunteer_applications from anon, authenticated;
revoke all on public.sponsorship_applications from anon, authenticated;
revoke all on public.board_applications from anon, authenticated;
revoke all on public.hr_email_outbox from anon, authenticated;

grant select, update on public.volunteer_applications to authenticated;
grant select, update on public.sponsorship_applications to authenticated;
grant select, update on public.board_applications to authenticated;
grant select on public.hr_email_outbox to authenticated;

grant all on public.volunteer_applications to service_role;
grant all on public.sponsorship_applications to service_role;
grant all on public.board_applications to service_role;
grant all on public.hr_email_outbox to service_role;

drop policy if exists "Internal users can read volunteer applications" on public.volunteer_applications;
create policy "Internal users can read volunteer applications"
  on public.volunteer_applications for select to authenticated
  using (public.is_internal_user());

drop policy if exists "Internal users can update volunteer applications" on public.volunteer_applications;
create policy "Internal users can update volunteer applications"
  on public.volunteer_applications for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read sponsorship applications" on public.sponsorship_applications;
create policy "Internal users can read sponsorship applications"
  on public.sponsorship_applications for select to authenticated
  using (public.is_internal_user());

drop policy if exists "Internal users can update sponsorship applications" on public.sponsorship_applications;
create policy "Internal users can update sponsorship applications"
  on public.sponsorship_applications for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read board applications" on public.board_applications;
create policy "Internal users can read board applications"
  on public.board_applications for select to authenticated
  using (public.is_internal_user());

drop policy if exists "Internal users can update board applications" on public.board_applications;
create policy "Internal users can update board applications"
  on public.board_applications for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

drop policy if exists "Internal users can read HR email outbox" on public.hr_email_outbox;
create policy "Internal users can read HR email outbox"
  on public.hr_email_outbox for select to authenticated
  using (public.is_internal_user());
