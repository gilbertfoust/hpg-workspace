-- Financial analysis/forecast recommendations and NGO-specific,
-- interdepartmental grant-proposal contributions.

create table public.finance_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  analysis_date date not null default current_date,
  period_start date not null,
  period_end date not null,
  scenario text not null default 'base' check (scenario in ('base','conservative','growth','stress','custom')),
  metrics_json jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('draft','completed','reviewed','archived')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_end>=period_start)
);

create table public.finance_recommendations (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.finance_analysis_runs(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  recommendation_type text not null check (recommendation_type in ('cash_runway','budget_variance','revenue_mix','expense_control','compliance','grant_readiness','custom')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  title text not null,
  summary text not null,
  supporting_metrics jsonb not null default '{}'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','internal_review','shared','acknowledged','resolved','archived')),
  shared_with_ngo_at timestamptz,
  shared_by_user_id uuid references public.profiles(id) on delete set null,
  acknowledged_by_user_id uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grant_proposal_contributions (
  id uuid primary key default gen_random_uuid(),
  grant_application_id uuid not null references public.grant_applications(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  department text not null check (department in ('finance','development','communications','research','program')),
  section_key text not null,
  section_title text not null,
  content_markdown text not null,
  source_analysis_run_id uuid references public.finance_analysis_runs(id) on delete set null,
  source_recommendation_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','superseded')),
  version integer not null default 1 check (version>0),
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(grant_application_id,department,section_key,version)
);

alter table public.grant_applications
  add column if not exists department_contributions_json jsonb not null default '{}'::jsonb,
  add column if not exists contributions_assembled_at timestamptz;

create index finance_analysis_runs_ngo_idx on public.finance_analysis_runs(ngo_id,analysis_date desc);
create index finance_recommendations_portal_idx on public.finance_recommendations(ngo_id,status,priority,created_at desc);
create index grant_proposal_contributions_application_idx on public.grant_proposal_contributions(grant_application_id,status,department);
create trigger finance_analysis_runs_updated_at before update on public.finance_analysis_runs for each row execute function public.update_updated_at_column();
create trigger finance_recommendations_updated_at before update on public.finance_recommendations for each row execute function public.update_updated_at_column();
create trigger grant_proposal_contributions_updated_at before update on public.grant_proposal_contributions for each row execute function public.update_updated_at_column();

alter table public.finance_analysis_runs enable row level security;
alter table public.finance_recommendations enable row level security;
alter table public.grant_proposal_contributions enable row level security;

create policy "Finance reads analysis runs" on public.finance_analysis_runs for select to authenticated using (public.is_finance_staff());
create policy "Finance manages analysis runs" on public.finance_analysis_runs for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy "Finance and NGOs read recommendations" on public.finance_recommendations for select to authenticated
  using (public.is_finance_staff() or (status in ('shared','acknowledged','resolved') and public.has_ngo_finance_access(ngo_id,'viewer')));
create policy "Finance manages recommendations" on public.finance_recommendations for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy "Proposal departments read contributions" on public.grant_proposal_contributions for select to authenticated
  using (public.current_staff_department_name() in ('finance','development','communications','marketing','research','program') or public.is_super_admin());

revoke all on public.finance_analysis_runs,public.finance_recommendations,public.grant_proposal_contributions from anon,authenticated;
grant select on public.finance_analysis_runs,public.finance_recommendations,public.grant_proposal_contributions to authenticated;
grant all on public.finance_analysis_runs,public.finance_recommendations,public.grant_proposal_contributions to service_role;

create or replace function public.run_finance_analysis(
  p_ngo_id uuid,p_period_start date,p_period_end date,p_scenario text default 'base'
)
returns public.finance_analysis_runs
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.finance_analysis_runs; revenue numeric(18,2); expenses numeric(18,2); cash numeric(18,2); months numeric; burn numeric(18,2); runway numeric; margin numeric(18,2);
begin
  if auth.uid() is null or not public.is_finance_staff() then raise exception 'Finance access required'; end if;
  if p_period_end<p_period_start then raise exception 'Analysis period is invalid'; end if;
  if p_scenario not in ('base','conservative','growth','stress','custom') then raise exception 'Unsupported scenario'; end if;
  select round(coalesce(sum(case when a.account_type='revenue' then l.credit-l.debit else 0 end),0),2),
         round(coalesce(sum(case when a.account_type='expense' then l.debit-l.credit else 0 end),0),2)
  into revenue,expenses
  from public.finance_journal_entries e join public.finance_journal_lines l on l.journal_entry_id=e.id
  join public.finance_accounts a on a.id=l.account_id
  where e.ngo_id=p_ngo_id and e.status='posted' and e.entry_date between p_period_start and p_period_end;
  select round(coalesce(sum(case when a.normal_balance='debit' then l.debit-l.credit else l.credit-l.debit end),0),2)
  into cash from public.finance_journal_entries e join public.finance_journal_lines l on l.journal_entry_id=e.id
  join public.finance_accounts a on a.id=l.account_id
  where e.ngo_id=p_ngo_id and e.status='posted' and e.entry_date<=p_period_end and a.is_cash_account;
  months:=greatest(1,(p_period_end-p_period_start+1)::numeric/30.4375);
  burn:=round(expenses/months,2);
  runway:=case when burn>0 then round(cash/burn,1) else null end;
  margin:=round(revenue-expenses,2);
  insert into public.finance_analysis_runs(ngo_id,period_start,period_end,scenario,metrics_json,created_by_user_id)
  values(p_ngo_id,p_period_start,p_period_end,p_scenario,jsonb_build_object(
    'revenue',revenue,'expenses',expenses,'operating_margin',margin,'cash',cash,
    'average_monthly_expense',burn,'cash_runway_months',runway,'period_months',round(months,1)
  ),auth.uid()) returning * into row_out;

  if margin<0 then insert into public.finance_recommendations(analysis_run_id,ngo_id,recommendation_type,priority,title,summary,supporting_metrics,recommended_actions)
    values(row_out.id,p_ngo_id,'expense_control',case when abs(margin)>greatest(revenue,1)*0.2 then 'high' else 'medium' end,
      'Address the operating deficit','Expenses exceeded revenue during the analysis period.',jsonb_build_object('margin',margin,'revenue',revenue,'expenses',expenses),
      jsonb_build_array('Review discretionary expense categories','Identify near-term revenue opportunities','Reforecast the next two quarters')); end if;
  if runway is not null and runway<3 then insert into public.finance_recommendations(analysis_run_id,ngo_id,recommendation_type,priority,title,summary,supporting_metrics,recommended_actions)
    values(row_out.id,p_ngo_id,'cash_runway',case when runway<1 then 'critical' else 'high' end,
      'Protect short-term cash runway','Available cash covers fewer than three average months of expenses.',jsonb_build_object('cash',cash,'monthly_expense',burn,'runway_months',runway),
      jsonb_build_array('Prioritize unrestricted cash receipts','Sequence non-critical payments','Prepare a 13-week cash forecast')); end if;
  if revenue>0 then insert into public.finance_recommendations(analysis_run_id,ngo_id,recommendation_type,priority,title,summary,supporting_metrics,recommended_actions,status)
    values(row_out.id,p_ngo_id,'grant_readiness','low','Use current financial evidence in grant proposals','Finance has refreshed revenue, expense, margin, and runway metrics for Development.',row_out.metrics_json,
      jsonb_build_array('Share reviewed metrics with Development','Align the request budget to the approved chart of accounts'),'internal_review'); end if;
  return row_out;
end;
$$;

create or replace function public.share_finance_recommendation(p_recommendation_id uuid)
returns public.finance_recommendations
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.finance_recommendations;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required'; end if;
  update public.finance_recommendations set status='shared',shared_with_ngo_at=now(),shared_by_user_id=auth.uid()
  where id=p_recommendation_id and status in ('draft','internal_review') returning * into row_out;
  if row_out.id is null then raise exception 'Recommendation is not shareable'; end if;
  return row_out;
end;
$$;

create or replace function public.acknowledge_finance_recommendation(p_recommendation_id uuid)
returns public.finance_recommendations
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.finance_recommendations;
begin
  select * into row_out from public.finance_recommendations where id=p_recommendation_id for update;
  if row_out.id is null or not public.has_ngo_finance_access(row_out.ngo_id,'viewer') or row_out.status<>'shared' then raise exception 'Shared NGO recommendation not found'; end if;
  update public.finance_recommendations set status='acknowledged',acknowledged_by_user_id=auth.uid(),acknowledged_at=now()
  where id=p_recommendation_id returning * into row_out;
  return row_out;
end;
$$;

create or replace function public.submit_grant_proposal_contribution(
  p_grant_application_id uuid,p_department text,p_section_key text,p_section_title text,
  p_content_markdown text,p_source_analysis_run_id uuid default null,p_source_recommendation_ids uuid[] default '{}'
)
returns public.grant_proposal_contributions
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.grant_proposal_contributions; app public.grant_applications; dept text; next_version integer;
begin
  dept:=case when public.current_staff_department_name()='marketing' then 'communications' else public.current_staff_department_name() end;
  if auth.uid() is null or not (public.is_super_admin() or dept=p_department) then raise exception 'You may submit only your assigned department contribution'; end if;
  if p_department not in ('finance','development','communications','research','program') then raise exception 'Unsupported proposal department'; end if;
  select * into app from public.grant_applications where id=p_grant_application_id;
  if app.id is null or app.ngo_id is null then raise exception 'Grant application and NGO are required'; end if;
  if nullif(trim(p_section_key),'') is null or nullif(trim(p_section_title),'') is null or nullif(trim(p_content_markdown),'') is null then raise exception 'Section key, title, and content are required'; end if;
  select coalesce(max(version),0)+1 into next_version from public.grant_proposal_contributions where grant_application_id=app.id and department=p_department and section_key=p_section_key;
  update public.grant_proposal_contributions set status='superseded' where grant_application_id=app.id and department=p_department and section_key=p_section_key and status in ('draft','submitted','approved');
  insert into public.grant_proposal_contributions(grant_application_id,ngo_id,department,section_key,section_title,content_markdown,source_analysis_run_id,source_recommendation_ids,status,version,created_by_user_id,submitted_at)
  values(app.id,app.ngo_id,p_department,trim(p_section_key),trim(p_section_title),trim(p_content_markdown),p_source_analysis_run_id,coalesce(p_source_recommendation_ids,'{}'), 'submitted',next_version,auth.uid(),now())
  returning * into row_out;
  return row_out;
end;
$$;

create or replace function public.review_grant_proposal_contribution(p_contribution_id uuid,p_decision text,p_notes text default null)
returns public.grant_proposal_contributions
language plpgsql
security definer
set search_path=public
as $$
declare row_out public.grant_proposal_contributions;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.current_staff_department_name()='development') then raise exception 'Development review access required'; end if;
  if p_decision not in ('approved','changes_requested') then raise exception 'Unsupported contribution decision'; end if;
  if p_decision='changes_requested' and nullif(trim(p_notes),'') is null then raise exception 'Change requests require notes'; end if;
  update public.grant_proposal_contributions set status=p_decision,reviewed_by_user_id=auth.uid(),reviewed_at=now(),review_notes=nullif(trim(p_notes),'')
  where id=p_contribution_id and status='submitted' returning * into row_out;
  if row_out.id is null then raise exception 'Submitted contribution not found'; end if;
  return row_out;
end;
$$;

create or replace function public.assemble_grant_proposal_contributions(p_grant_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare assembled jsonb;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.current_staff_department_name()='development') then raise exception 'Development assembly access required'; end if;
  select coalesce(jsonb_object_agg(department,sections),'{}'::jsonb) into assembled from (
    select department,jsonb_agg(jsonb_build_object('section_key',section_key,'section_title',section_title,'content_markdown',content_markdown,'version',version,'contribution_id',id) order by section_key) sections
    from public.grant_proposal_contributions where grant_application_id=p_grant_application_id and status='approved' group by department
  ) grouped;
  update public.grant_applications set department_contributions_json=assembled,contributions_assembled_at=now() where id=p_grant_application_id;
  return assembled;
end;
$$;

revoke all on function public.run_finance_analysis(uuid,date,date,text) from public,anon;
revoke all on function public.share_finance_recommendation(uuid) from public,anon;
revoke all on function public.acknowledge_finance_recommendation(uuid) from public,anon;
revoke all on function public.submit_grant_proposal_contribution(uuid,text,text,text,text,uuid,uuid[]) from public,anon;
revoke all on function public.review_grant_proposal_contribution(uuid,text,text) from public,anon;
revoke all on function public.assemble_grant_proposal_contributions(uuid) from public,anon;
grant execute on function public.run_finance_analysis(uuid,date,date,text) to authenticated;
grant execute on function public.share_finance_recommendation(uuid) to authenticated;
grant execute on function public.acknowledge_finance_recommendation(uuid) to authenticated;
grant execute on function public.submit_grant_proposal_contribution(uuid,text,text,text,text,uuid,uuid[]) to authenticated;
grant execute on function public.review_grant_proposal_contribution(uuid,text,text) to authenticated;
grant execute on function public.assemble_grant_proposal_contributions(uuid) to authenticated;
