-- Feature-scoped security/performance hardening after Supabase advisor review.
-- Auth predicates are statement-level stable init plans; row ownership remains enforced.
drop policy if exists partnership_review_request_read on public.partnership_portal_review_requests;
create policy partnership_review_request_read on public.partnership_portal_review_requests
for select to authenticated using(
 ((select public.current_workspace_identity_active()) and
  (select public.is_internal_user()) and
  (select public.can_access_workspace_area('development')))
 or ((select public.can_access_partnership_portal()) and submitted_by=(select auth.uid()))
);
drop policy if exists partnership_case_resource_read on public.partnership_portal_case_resources;
create policy partnership_case_resource_read on public.partnership_portal_case_resources
for select to authenticated using(exists(
 select 1 from public.partnership_portal_cases c where c.id=case_id
 and ((select public.is_super_admin()) or
 ((select public.can_access_partnership_portal()) and c.owner_user_id=(select auth.uid())))
));
drop policy if exists partnership_support_read on public.partnership_portal_support_requests;
create policy partnership_support_read on public.partnership_portal_support_requests
for select to authenticated using(
 ((select public.current_workspace_identity_active()) and
  (select public.is_internal_user()) and
  (select public.can_access_workspace_area('development')))
 or ((select public.can_access_partnership_portal()) and requested_by=(select auth.uid()))
);
drop policy if exists partnership_lead_share_read on public.partnership_portal_lead_shares;
create policy partnership_lead_share_read on public.partnership_portal_lead_shares
for select to authenticated using(
 ((select public.current_workspace_identity_active()) and
  (select public.is_internal_user()) and
  (select public.can_access_workspace_area('development')))
 or ((select public.can_access_partnership_portal()) and portfolio_user_id=(select auth.uid()))
);

create index if not exists board_partnership_cases_partner_idx on public.partnership_portal_cases(partner_id) where partner_id is not null;
create index if not exists board_partnership_cases_pipeline_idx on public.partnership_portal_cases(pipeline_id) where pipeline_id is not null;
create index if not exists board_partnership_cases_work_item_idx on public.partnership_portal_cases(review_work_item_id) where review_work_item_id is not null;
create index if not exists board_partnership_cases_crm_idx on public.partnership_portal_cases(crm_organization_id) where crm_organization_id is not null;
create index if not exists board_partnership_cases_motion_idx on public.partnership_portal_cases(board_motion_id) where board_motion_id is not null;
create index if not exists board_partnership_cases_created_by_idx on public.partnership_portal_cases(created_by);
create index if not exists board_partnership_resources_added_by_idx on public.partnership_portal_case_resources(added_by);
create index if not exists board_partnership_activities_created_by_idx on public.partnership_portal_activities(created_by);
create index if not exists board_partnership_assignments_authorizer_idx on public.partnership_portal_assignments(authorized_by) where authorized_by is not null;
create index if not exists board_partnership_shares_user_idx on public.partnership_portal_lead_shares(portfolio_user_id);
