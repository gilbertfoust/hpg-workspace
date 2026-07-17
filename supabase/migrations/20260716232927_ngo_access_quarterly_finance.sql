-- NGO staff access, department/rank authority, approved NGO charts of accounts,
-- and formal quarterly NGO -> HPG Finance submission.

alter table public.profiles
  add column if not exists org_rank text,
  add column if not exists supervisor_user_id uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_org_rank_check'
  ) then
    alter table public.profiles add constraint profiles_org_rank_check check (
      org_rank is null or org_rank in (
        'chief_executive','executive_vice_president','vice_president','director',
        'manager','specialist','coordinator','associate','staff'
      )
    );
  end if;
end $$;

update public.profiles
set org_rank = case
  when role = 'super_admin' then 'chief_executive'
  when role like 'vp_%' then 'vice_president'
  when role = 'department_lead' then 'director'
  when role in ('ngo_coordinator','executive_secretariat') then 'coordinator'
  else 'staff'
end
where org_rank is null;

update public.profiles p
set department_id = ou.id
from public.org_units ou
where p.department_id is null
  and p.role = 'vp_finance'
  and lower(trim(ou.department_name)) = 'finance';

create index if not exists profiles_supervisor_idx on public.profiles(supervisor_user_id);
create index if not exists profiles_department_rank_idx on public.profiles(department_id, org_rank);

create or replace function public.org_rank_level(p_rank text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(p_rank,''))
    when 'chief_executive' then 100
    when 'executive_vice_president' then 90
    when 'vice_president' then 80
    when 'director' then 70
    when 'manager' then 60
    when 'specialist' then 40
    when 'coordinator' then 30
    when 'associate' then 20
    when 'staff' then 10
    else 0
  end;
$$;

create or replace function public.current_staff_department_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(ou.department_name,'')))
  from public.profiles p
  left join public.org_units ou on ou.id = p.department_id
  where p.id = auth.uid();
$$;

create or replace function public.can_access_workspace_area(p_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role(auth.uid(), 'super_admin')
      or public.has_role(auth.uid(), 'admin_pm')
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('super_admin','admin_pm')
      ) then true
    when lower(coalesce(p_area,'')) in ('dashboard','calendar','my_queue')
      then public.is_internal_user() and not public.is_ngo_user()
    when lower(coalesce(p_area,'')) = 'finance'
      then public.current_staff_department_name() = 'finance'
    when lower(coalesce(p_area,'')) = 'hr'
      then public.current_staff_department_name() in ('hr','human resources')
    when lower(coalesce(p_area,'')) in ('development','grants','partnerships')
      then public.current_staff_department_name() = 'development'
    when lower(coalesce(p_area,'')) in ('communications','marketing')
      then public.current_staff_department_name() in ('communications','marketing')
    when lower(coalesce(p_area,'')) = 'it'
      then public.current_staff_department_name() in ('it','information technology')
    when lower(coalesce(p_area,'')) in ('program','curriculum')
      then public.current_staff_department_name() in ('program','programs','curriculum')
    when lower(coalesce(p_area,'')) in ('ngo_coordination','ngos')
      then public.current_staff_department_name() in ('ngo coordination','ngo_coordination')
    when lower(coalesce(p_area,'')) = 'administration'
      then public.current_staff_department_name() in ('administration','executive')
    else false
  end;
$$;

create or replace function public.can_manage_ngo_portal_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'admin_pm')
    or exists (
      select 1
      from public.profiles p
      left join public.org_units ou on ou.id = p.department_id
      where p.id = auth.uid()
        and (
          p.role in ('super_admin','admin_pm')
          or (
            lower(trim(coalesce(ou.department_name,''))) in ('it','information technology')
            and public.org_rank_level(p.org_rank) >= 60
          )
        )
    );
$$;

create or replace function public.can_route_report_to(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles source
    join public.profiles target on target.id = p_target_user_id
    where source.id = auth.uid()
      and source.department_id is not distinct from target.department_id
      and public.org_rank_level(target.org_rank) > public.org_rank_level(source.org_rank)
      and (
        source.supervisor_user_id = target.id
        or public.org_rank_level(target.org_rank) = (
          select min(public.org_rank_level(candidate.org_rank))
          from public.profiles candidate
          where candidate.department_id is not distinct from source.department_id
            and public.org_rank_level(candidate.org_rank) > public.org_rank_level(source.org_rank)
        )
      )
  );
$$;

create table if not exists public.ngo_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  access_level text not null default 'preparer'
    check (access_level in ('viewer','preparer','approver','ngo_admin')),
  status text not null default 'active'
    check (status in ('invited','active','suspended','revoked')),
  can_manage_staff boolean not null default false,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ngo_id)
);

insert into public.ngo_portal_memberships(user_id, ngo_id, access_level, status, accepted_at, metadata)
select distinct c.user_id, c.ngo_id, 'preparer', 'active', now(), jsonb_build_object('backfilled_from','contacts')
from public.contacts c
where c.user_id is not null and c.ngo_id is not null
on conflict (user_id, ngo_id) do nothing;

create index if not exists ngo_portal_memberships_ngo_idx
  on public.ngo_portal_memberships(ngo_id, status, access_level);

drop trigger if exists trg_ngo_portal_memberships_updated_at on public.ngo_portal_memberships;
create trigger trg_ngo_portal_memberships_updated_at
before update on public.ngo_portal_memberships
for each row execute function public.update_updated_at_column();

alter table public.ngo_portal_memberships enable row level security;

create or replace function public.has_ngo_access(_ngo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'admin_pm')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin','admin_pm')
    )
    or exists (
      select 1 from public.ngos n
      where n.id = _ngo_id
        and auth.uid() in (n.ngo_coordinator_user_id, n.admin_pm_user_id)
    )
    or exists (
      select 1 from public.ngo_portal_memberships m
      where m.ngo_id = _ngo_id and m.user_id = auth.uid() and m.status = 'active'
    )
    or exists (
      select 1 from public.contacts c
      where c.ngo_id = _ngo_id and c.user_id = auth.uid()
    );
$$;

create or replace function public.has_ngo_finance_access(
  p_ngo_id uuid,
  p_minimum_access text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ngo_portal_memberships m
    where m.ngo_id = p_ngo_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and case p_minimum_access
        when 'ngo_admin' then m.access_level = 'ngo_admin'
        when 'approver' then m.access_level in ('approver','ngo_admin')
        when 'preparer' then m.access_level in ('preparer','approver','ngo_admin')
        else true
      end
  );
$$;

create or replace function public.set_ngo_portal_membership(
  p_membership_id uuid,
  p_status text,
  p_access_level text default null
)
returns public.ngo_portal_memberships
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.ngo_portal_memberships;
begin
  if auth.uid() is null or not public.can_manage_ngo_portal_accounts() then
    raise exception 'Admin or authorized IT access required';
  end if;
  if p_status not in ('invited','active','suspended','revoked') then
    raise exception 'Unsupported membership status';
  end if;
  if p_access_level is not null and p_access_level not in ('viewer','preparer','approver','ngo_admin') then
    raise exception 'Unsupported NGO access level';
  end if;
  update public.ngo_portal_memberships set
    status = p_status,
    access_level = coalesce(p_access_level,access_level),
    can_manage_staff = case
      when p_access_level is null then can_manage_staff
      else p_access_level = 'ngo_admin'
    end,
    revoked_at = case when p_status = 'revoked' then now() else null end
  where id = p_membership_id returning * into row_out;
  if row_out.id is null then raise exception 'NGO membership not found'; end if;
  return row_out;
end;
$$;

drop policy if exists "Members can view own NGO memberships" on public.ngo_portal_memberships;
create policy "Members can view own NGO memberships"
on public.ngo_portal_memberships for select to authenticated
using (user_id = auth.uid() or public.can_manage_ngo_portal_accounts());

revoke all on public.ngo_portal_memberships from anon;
grant select on public.ngo_portal_memberships to authenticated;
grant all on public.ngo_portal_memberships to service_role;

-- Existing Finance tables key their policies off these functions. Tightening
-- them here applies department isolation to the whole ledger, not only the UI.
create or replace function public.is_finance_ledger_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'admin_pm')
    or exists (
      select 1
      from public.profiles p
      left join public.org_units ou on ou.id = p.department_id
      where p.id = auth.uid()
        and (
          p.role in ('super_admin','admin_pm')
          or (
            lower(trim(coalesce(ou.department_name,''))) = 'finance'
            and (
              p.role in ('vp_finance','department_lead')
              or public.org_rank_level(p.org_rank) >= 60
            )
          )
        )
    );
$$;

create or replace function public.is_finance_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_finance_ledger_manager()
    or exists (
      select 1 from public.profiles p
      join public.org_units ou on ou.id = p.department_id
      where p.id = auth.uid()
        and lower(trim(ou.department_name)) = 'finance'
        and p.role not in ('ngo_user','external_ngo')
    );
$$;

create or replace function public.can_write_finance_drafts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.is_finance_staff(); $$;

create or replace function public.can_read_finance_ledger()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.is_finance_staff(); $$;

create table if not exists public.finance_ngo_account_requests (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete restrict,
  requested_code text not null,
  requested_name text not null,
  account_type public.finance_account_type not null,
  account_subtype text,
  normal_balance public.finance_normal_balance not null,
  parent_account_id uuid references public.finance_accounts(id) on delete set null,
  form_990_line text,
  financial_statement_line text,
  business_reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','withdrawn')),
  approved_account_id uuid references public.finance_accounts(id) on delete set null,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trim(requested_code) <> '' and trim(requested_name) <> '' and trim(business_reason) <> '')
);

create unique index if not exists finance_ngo_account_requests_pending_unique
  on public.finance_ngo_account_requests(ngo_id, lower(requested_code))
  where status = 'pending';
create index if not exists finance_ngo_account_requests_queue_idx
  on public.finance_ngo_account_requests(status, created_at, ngo_id);
create trigger trg_finance_ngo_account_requests_updated_at
before update on public.finance_ngo_account_requests
for each row execute function public.update_updated_at_column();

alter table public.finance_ngo_account_requests enable row level security;
create policy "NGO members and Finance can read account requests"
on public.finance_ngo_account_requests for select to authenticated
using (public.has_ngo_finance_access(ngo_id, 'viewer') or public.is_finance_staff());
revoke all on public.finance_ngo_account_requests from anon, authenticated;
grant select on public.finance_ngo_account_requests to authenticated;
grant all on public.finance_ngo_account_requests to service_role;

create or replace function public.request_finance_ngo_account(
  p_ngo_id uuid,
  p_account_spec jsonb,
  p_business_reason text
)
returns public.finance_ngo_account_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.finance_ngo_account_requests;
  requested_type public.finance_account_type;
  requested_normal public.finance_normal_balance;
begin
  if auth.uid() is null or not (
    public.has_ngo_finance_access(p_ngo_id, 'preparer') or public.is_finance_staff()
  ) then raise exception 'NGO preparer or Finance access required'; end if;
  if nullif(trim(p_account_spec->>'code'),'') is null
     or nullif(trim(p_account_spec->>'name'),'') is null
     or nullif(trim(p_business_reason),'') is null then
    raise exception 'Account code, name, and business reason are required';
  end if;
  requested_type := (p_account_spec->>'account_type')::public.finance_account_type;
  requested_normal := coalesce(
    nullif(p_account_spec->>'normal_balance','')::public.finance_normal_balance,
    case when requested_type in ('asset','expense')
      then 'debit'::public.finance_normal_balance
      else 'credit'::public.finance_normal_balance end
  );
  insert into public.finance_ngo_account_requests(
    ngo_id, requested_by_user_id, requested_code, requested_name,
    account_type, account_subtype, normal_balance, parent_account_id,
    form_990_line, financial_statement_line, business_reason
  ) values (
    p_ngo_id, auth.uid(), trim(p_account_spec->>'code'), trim(p_account_spec->>'name'),
    requested_type, nullif(trim(p_account_spec->>'account_subtype'),''), requested_normal,
    nullif(p_account_spec->>'parent_account_id','')::uuid,
    nullif(trim(p_account_spec->>'form_990_line'),''),
    nullif(trim(p_account_spec->>'financial_statement_line'),''),
    trim(p_business_reason)
  ) returning * into request_row;
  perform public.finance_log_audit_event(
    'finance_ngo_account_request', request_row.id, 'requested',
    jsonb_build_object('ngo_id',p_ngo_id,'code',request_row.requested_code)
  );
  return request_row;
end;
$$;

create or replace function public.review_finance_ngo_account_request(
  p_request_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns public.finance_ngo_account_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.finance_ngo_account_requests;
  resolved_account_id uuid;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then
    raise exception 'Finance manager access required';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into request_row from public.finance_ngo_account_requests where id = p_request_id for update;
  if request_row.id is null then raise exception 'Account request not found'; end if;
  if request_row.status <> 'pending' then raise exception 'Only pending account requests can be reviewed'; end if;

  if p_decision = 'approved' then
    resolved_account_id := public.ensure_finance_ngo_account(
      request_row.ngo_id,
      null,
      jsonb_build_object(
        'code',request_row.requested_code,
        'name',request_row.requested_name,
        'account_type',request_row.account_type,
        'account_subtype',request_row.account_subtype,
        'normal_balance',request_row.normal_balance,
        'parent_account_id',request_row.parent_account_id,
        'form_990_line',request_row.form_990_line,
        'financial_statement_line',request_row.financial_statement_line
      ),
      'ngo_account_request', request_row.id
    );
  end if;

  update public.finance_ngo_account_requests set
    status = p_decision,
    approved_account_id = resolved_account_id,
    reviewed_by_user_id = auth.uid(),
    reviewed_at = now(),
    review_notes = nullif(trim(p_review_notes),'')
  where id = p_request_id returning * into request_row;
  perform public.finance_log_audit_event(
    'finance_ngo_account_request', request_row.id, p_decision,
    jsonb_build_object('ngo_id',request_row.ngo_id,'account_id',resolved_account_id)
  );
  return request_row;
end;
$$;

create table if not exists public.finance_quarterly_submissions (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  quarter smallint not null check (quarter between 1 and 4),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (
    status in ('draft','submitted','under_review','changes_requested','approved','certified')
  ),
  no_activity boolean not null default false,
  preparer_certification boolean not null default false,
  readiness_json jsonb not null default '{}'::jsonb,
  report_package_json jsonb not null default '{}'::jsonb,
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ngo_id, fiscal_year, quarter),
  check (period_end >= period_start)
);

create index if not exists finance_quarterly_submissions_queue_idx
  on public.finance_quarterly_submissions(status, period_end, ngo_id);
create trigger trg_finance_quarterly_submissions_updated_at
before update on public.finance_quarterly_submissions
for each row execute function public.update_updated_at_column();
alter table public.finance_quarterly_submissions enable row level security;
create policy "NGO members and Finance can read quarter submissions"
on public.finance_quarterly_submissions for select to authenticated
using (public.has_ngo_finance_access(ngo_id, 'viewer') or public.is_finance_staff());
revoke all on public.finance_quarterly_submissions from anon, authenticated;
grant select on public.finance_quarterly_submissions to authenticated;
grant all on public.finance_quarterly_submissions to service_role;

create or replace function public.finance_quarter_bounds(p_year integer, p_quarter integer)
returns table(period_start date, period_end date)
language sql
immutable
set search_path = public
as $$
  select make_date(p_year, 1 + ((p_quarter - 1) * 3), 1),
         (make_date(p_year, 1 + (p_quarter * 3), 1) - interval '1 day')::date;
$$;

create or replace function public.finance_quarter_is_locked(p_ngo_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.finance_quarterly_submissions q
    where q.ngo_id = p_ngo_id and p_date between q.period_start and q.period_end
      and q.status in ('submitted','under_review','approved','certified')
  );
$$;

create or replace function public.ngo_portal_finance_account_catalog(p_ngo_id uuid)
returns table(
  id uuid,
  code text,
  name text,
  account_type public.finance_account_type,
  normal_balance public.finance_normal_balance,
  is_cash_account boolean,
  form_990_line text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id,
         coalesce(nullif(n.local_code,''),a.code),
         coalesce(nullif(n.local_name,''),a.name),
         a.account_type,a.normal_balance,a.is_cash_account,a.form_990_line
  from public.finance_ngo_accounts n
  join public.finance_accounts a on a.id = n.account_id
  where n.ngo_id = p_ngo_id and n.is_active and a.is_active
    and public.has_ngo_finance_access(p_ngo_id,'viewer')
  order by a.code;
$$;

create or replace function public.ngo_portal_recent_transactions(
  p_ngo_id uuid,
  p_limit integer default 50
)
returns table(
  id uuid,
  payment_number text,
  payment_date date,
  payee_name text,
  amount numeric,
  payment_method text,
  reference_number text,
  status text,
  document_id uuid,
  journal_entry_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,p.payment_number,p.payment_date,p.payee_name,p.amount,
         p.payment_method,p.reference_number,p.status,p.document_id,p.journal_entry_id
  from public.finance_payments p
  where p.ngo_id = p_ngo_id and public.has_ngo_finance_access(p_ngo_id,'viewer')
  order by p.payment_date desc,p.created_at desc
  limit least(greatest(coalesce(p_limit,50),1),200);
$$;

create or replace function public.finance_quarter_readiness(
  p_ngo_id uuid,
  p_fiscal_year integer,
  p_quarter integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  start_on date;
  end_on date;
  total_debit numeric(18,2);
  total_credit numeric(18,2);
  posted_entries integer;
  draft_entries integer;
  missing_receipts integer;
  pending_accounts integer;
  balanced boolean;
begin
  if auth.uid() is null or not (
    public.has_ngo_finance_access(p_ngo_id,'viewer') or public.is_finance_staff()
  ) then raise exception 'NGO or Finance access required'; end if;
  if p_quarter not between 1 and 4 then raise exception 'Quarter must be 1 through 4'; end if;
  select b.period_start, b.period_end into start_on, end_on
  from public.finance_quarter_bounds(p_fiscal_year,p_quarter) b;

  select count(*) filter (where e.status = 'posted'),
         count(*) filter (where e.status in ('draft','pending_approval')),
         round(coalesce(sum(l.debit) filter (where e.status = 'posted'),0),2),
         round(coalesce(sum(l.credit) filter (where e.status = 'posted'),0),2)
  into posted_entries, draft_entries, total_debit, total_credit
  from public.finance_journal_entries e
  left join public.finance_journal_lines l on l.journal_entry_id = e.id
  where e.ngo_id = p_ngo_id and e.entry_date between start_on and end_on;

  select count(*) into missing_receipts
  from public.finance_payments p
  where p.ngo_id = p_ngo_id and p.payment_date between start_on and end_on
    and p.status = 'posted' and p.document_id is null;

  select count(*) into pending_accounts
  from public.finance_ngo_account_requests r
  where r.ngo_id = p_ngo_id and r.status = 'pending';

  balanced := abs(coalesce(total_debit,0) - coalesce(total_credit,0)) <= 0.005;
  return jsonb_build_object(
    'ngo_id',p_ngo_id,'fiscal_year',p_fiscal_year,'quarter',p_quarter,
    'period_start',start_on,'period_end',end_on,
    'posted_entries',coalesce(posted_entries,0),'draft_entries',coalesce(draft_entries,0),
    'total_debit',coalesce(total_debit,0),'total_credit',coalesce(total_credit,0),
    'is_balanced',balanced,'missing_receipts',coalesce(missing_receipts,0),
    'pending_account_requests',coalesce(pending_accounts,0),
    'is_ready', balanced and coalesce(draft_entries,0) = 0
      and coalesce(missing_receipts,0) = 0 and coalesce(pending_accounts,0) = 0,
    'checked_at',now()
  );
end;
$$;

create or replace function public.prepare_finance_quarter(
  p_ngo_id uuid,
  p_fiscal_year integer,
  p_quarter integer,
  p_no_activity boolean default false
)
returns public.finance_quarterly_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  start_on date;
  end_on date;
  row_out public.finance_quarterly_submissions;
  readiness jsonb;
begin
  if auth.uid() is null or not (
    public.has_ngo_finance_access(p_ngo_id,'preparer') or public.is_finance_staff()
  ) then raise exception 'NGO preparer or Finance access required'; end if;
  select b.period_start,b.period_end into start_on,end_on
  from public.finance_quarter_bounds(p_fiscal_year,p_quarter) b;
  readiness := public.finance_quarter_readiness(p_ngo_id,p_fiscal_year,p_quarter);
  insert into public.finance_quarterly_submissions(
    ngo_id,fiscal_year,quarter,period_start,period_end,no_activity,readiness_json
  ) values (p_ngo_id,p_fiscal_year,p_quarter,start_on,end_on,p_no_activity,readiness)
  on conflict (ngo_id,fiscal_year,quarter) do update set
    no_activity = excluded.no_activity,
    readiness_json = excluded.readiness_json,
    updated_at = now()
  where public.finance_quarterly_submissions.status in ('draft','changes_requested')
  returning * into row_out;
  if row_out.id is null then raise exception 'Submitted or approved quarters cannot be edited'; end if;
  return row_out;
end;
$$;

create or replace function public.submit_finance_quarter(p_submission_id uuid)
returns public.finance_quarterly_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.finance_quarterly_submissions;
  readiness jsonb;
begin
  select * into row_out from public.finance_quarterly_submissions where id = p_submission_id for update;
  if row_out.id is null then raise exception 'Quarter submission not found'; end if;
  if auth.uid() is null or not (
    public.has_ngo_finance_access(row_out.ngo_id,'approver') or public.is_finance_staff()
  ) then raise exception 'NGO approver or Finance access required'; end if;
  if row_out.status not in ('draft','changes_requested') then raise exception 'Quarter is not open for submission'; end if;
  readiness := public.finance_quarter_readiness(row_out.ngo_id,row_out.fiscal_year,row_out.quarter);
  if not coalesce((readiness->>'is_ready')::boolean,false) then
    raise exception 'Quarter is not ready: clear drafts, attach receipts, approve accounts, and balance the journal';
  end if;
  if coalesce((readiness->>'posted_entries')::integer,0) = 0 and not row_out.no_activity then
    raise exception 'A zero-activity quarter must be certified as no activity';
  end if;
  update public.finance_quarterly_submissions set
    status = 'submitted', preparer_certification = true,
    readiness_json = readiness,
    report_package_json = jsonb_build_object(
      'trial_balance',jsonb_build_object('debits',readiness->'total_debit','credits',readiness->'total_credit'),
      'receipt_completeness',jsonb_build_object('missing',readiness->'missing_receipts'),
      'account_approval',jsonb_build_object('pending',readiness->'pending_account_requests')
    ),
    submitted_by_user_id = auth.uid(), submitted_at = now(), review_notes = null
  where id = p_submission_id returning * into row_out;
  perform public.finance_log_audit_event(
    'finance_quarterly_submission',row_out.id,'submitted',
    jsonb_build_object('ngo_id',row_out.ngo_id,'year',row_out.fiscal_year,'quarter',row_out.quarter)
  );
  return row_out;
end;
$$;

create or replace function public.review_finance_quarter(
  p_submission_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns public.finance_quarterly_submissions
language plpgsql
security definer
set search_path = public
as $$
declare row_out public.finance_quarterly_submissions;
begin
  if auth.uid() is null or not public.is_finance_ledger_manager() then
    raise exception 'Finance manager access required';
  end if;
  if p_decision not in ('under_review','changes_requested','approved','certified') then
    raise exception 'Unsupported review decision';
  end if;
  select * into row_out from public.finance_quarterly_submissions where id = p_submission_id for update;
  if row_out.id is null then raise exception 'Quarter submission not found'; end if;
  if row_out.status not in ('submitted','under_review','changes_requested','approved') then
    raise exception 'Quarter is not in a reviewable state';
  end if;
  if p_decision = 'changes_requested' and nullif(trim(p_review_notes),'') is null then
    raise exception 'Change requests require review notes';
  end if;
  update public.finance_quarterly_submissions set
    status = p_decision,
    reviewed_by_user_id = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(p_review_notes),''),
    approved_by_user_id = case when p_decision in ('approved','certified') then auth.uid() else approved_by_user_id end,
    approved_at = case when p_decision in ('approved','certified') then coalesce(approved_at,now()) else approved_at end,
    certified_at = case when p_decision = 'certified' then now() else certified_at end
  where id = p_submission_id returning * into row_out;
  perform public.finance_log_audit_event(
    'finance_quarterly_submission',row_out.id,p_decision,
    jsonb_build_object('ngo_id',row_out.ngo_id,'review_notes',p_review_notes)
  );
  return row_out;
end;
$$;

-- NGO portal transaction entry. It posts a balanced entry atomically, but only
-- against Finance-approved accounts and only while the quarter is open.
create or replace function public.create_and_post_ngo_portal_expense(
  p_ngo_id uuid,
  p_expense_account_id uuid,
  p_payment_account_id uuid,
  p_payment_method text,
  p_payment_date date,
  p_amount numeric,
  p_payee_name text,
  p_memo text default null,
  p_reference_number text default null,
  p_document_id uuid default null,
  p_fund_id uuid default null
)
returns public.finance_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  amount_value numeric(18,2) := round(coalesce(p_amount,0),2);
  method_value text := lower(trim(coalesce(p_payment_method,'')));
  expense_account public.finance_accounts;
  payment_account public.finance_accounts;
  payment public.finance_payments;
  entry public.finance_journal_entries;
  period_id uuid;
  memo_value text;
  total_debit numeric(18,2);
  total_credit numeric(18,2);
begin
  if auth.uid() is null or not public.has_ngo_finance_access(p_ngo_id,'preparer') then
    raise exception 'Active NGO preparer access required';
  end if;
  if public.finance_quarter_is_locked(p_ngo_id,coalesce(p_payment_date,current_date)) then
    raise exception 'This quarter is locked for HPG review';
  end if;
  if amount_value <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if nullif(trim(p_payee_name),'') is null then raise exception 'Payee is required'; end if;
  if coalesce(p_payment_date,current_date) > current_date + 1 then raise exception 'Payment date cannot be in the future'; end if;
  if method_value not in ('cash','check','ach','debit_card','credit_card','wire','other') then
    raise exception 'Select a supported payment method';
  end if;

  select a.* into expense_account
  from public.finance_accounts a
  join public.finance_ngo_accounts n on n.account_id = a.id and n.ngo_id = p_ngo_id and n.is_active
  where a.id = p_expense_account_id and a.is_active and a.account_type = 'expense';
  if expense_account.id is null then raise exception 'Expense account is not approved for this NGO'; end if;

  select a.* into payment_account
  from public.finance_accounts a
  join public.finance_ngo_accounts n on n.account_id = a.id and n.ngo_id = p_ngo_id and n.is_active
  where a.id = p_payment_account_id and a.is_active and a.account_type in ('asset','liability');
  if payment_account.id is null then raise exception 'Paid-from account is not approved for this NGO'; end if;
  if method_value = 'credit_card' and payment_account.account_type <> 'liability' then
    raise exception 'Credit card transactions require a liability account';
  end if;
  if method_value in ('cash','check','ach','debit_card','wire') and payment_account.account_type <> 'asset' then
    raise exception 'This payment method requires an asset account';
  end if;
  if p_document_id is not null and not exists (
    select 1 from public.documents d where d.id = p_document_id and d.ngo_id = p_ngo_id
  ) then raise exception 'Receipt does not belong to this NGO'; end if;
  if p_fund_id is not null and not exists (
    select 1 from public.finance_funds f where f.id = p_fund_id and f.is_active
      and (f.ngo_id is null or f.ngo_id = p_ngo_id)
  ) then raise exception 'Fund is inactive or belongs to another NGO'; end if;

  period_id := public.get_finance_open_fiscal_period(coalesce(p_payment_date,current_date),null,p_ngo_id);
  memo_value := coalesce(nullif(trim(p_memo),''),trim(p_payee_name) || ' — ' || expense_account.name);

  insert into public.finance_payments(
    payment_number,payment_type,payment_date,amount,status,payee_name,ngo_id,fund_id,
    expense_account_id,payment_account_id,payment_method,reference_number,memo,
    document_id,approved_by_user_id,approved_at,created_by_user_id
  ) values (
    '','reimbursement',coalesce(p_payment_date,current_date),amount_value,'draft',trim(p_payee_name),
    p_ngo_id,p_fund_id,expense_account.id,payment_account.id,method_value,
    nullif(trim(p_reference_number),''),memo_value,p_document_id,auth.uid(),now(),auth.uid()
  ) returning * into payment;

  insert into public.finance_journal_entries(
    entry_date,memo,source_type,source_id,status,created_by_user_id,ngo_id,fiscal_period_id
  ) values (
    payment.payment_date,memo_value,'ngo_portal_expense',payment.id,'draft',auth.uid(),p_ngo_id,period_id
  ) returning * into entry;

  insert into public.finance_journal_lines(
    journal_entry_id,account_id,debit,credit,memo,fund_id,ngo_id,document_id,line_number
  ) values
    (entry.id,expense_account.id,amount_value,0,memo_value,p_fund_id,p_ngo_id,p_document_id,1),
    (entry.id,payment_account.id,0,amount_value,coalesce(nullif(trim(p_reference_number),''),method_value),p_fund_id,p_ngo_id,null,2);

  perform public.finance_validate_journal_entity_scope(entry.id);
  select round(sum(debit),2),round(sum(credit),2) into total_debit,total_credit
  from public.finance_journal_lines where journal_entry_id = entry.id;
  if total_debit is distinct from total_credit or total_debit <= 0 then
    raise exception 'Transaction did not produce a balanced journal entry';
  end if;

  update public.finance_journal_entries set
    status = 'posted',posted_at = now(),approved_by_user_id = auth.uid(),updated_at = now()
  where id = entry.id returning * into entry;
  update public.finance_payments set status = 'posted',journal_entry_id = entry.id,updated_at = now()
  where id = payment.id returning * into payment;

  if p_document_id is not null then
    insert into public.finance_document_links(document_id,entity_type,entity_id,link_notes,created_by_user_id)
    values
      (p_document_id,'payment',payment.id,'NGO portal receipt',auth.uid()),
      (p_document_id,'journal_entry',entry.id,'NGO portal receipt',auth.uid())
    on conflict do nothing;
  end if;
  perform public.finance_log_audit_event(
    'finance_payment',payment.id,'ngo_portal_expense_posted',
    jsonb_build_object('ngo_id',p_ngo_id,'journal_entry_id',entry.id,'amount',amount_value,'document_id',p_document_id)
  );
  return payment;
end;
$$;

revoke all on function public.org_rank_level(text) from public, anon;
revoke all on function public.current_staff_department_name() from public, anon;
revoke all on function public.can_access_workspace_area(text) from public, anon;
revoke all on function public.can_manage_ngo_portal_accounts() from public, anon;
revoke all on function public.can_route_report_to(uuid) from public, anon;
revoke all on function public.has_ngo_finance_access(uuid,text) from public, anon;
revoke all on function public.set_ngo_portal_membership(uuid,text,text) from public, anon;
revoke all on function public.request_finance_ngo_account(uuid,jsonb,text) from public, anon;
revoke all on function public.review_finance_ngo_account_request(uuid,text,text) from public, anon;
revoke all on function public.finance_quarter_bounds(integer,integer) from public, anon;
revoke all on function public.finance_quarter_is_locked(uuid,date) from public, anon;
revoke all on function public.ngo_portal_finance_account_catalog(uuid) from public, anon;
revoke all on function public.ngo_portal_recent_transactions(uuid,integer) from public, anon;
revoke all on function public.finance_quarter_readiness(uuid,integer,integer) from public, anon;
revoke all on function public.prepare_finance_quarter(uuid,integer,integer,boolean) from public, anon;
revoke all on function public.submit_finance_quarter(uuid) from public, anon;
revoke all on function public.review_finance_quarter(uuid,text,text) from public, anon;
revoke all on function public.create_and_post_ngo_portal_expense(uuid,uuid,uuid,text,date,numeric,text,text,text,uuid,uuid) from public, anon;

grant execute on function public.org_rank_level(text) to authenticated;
grant execute on function public.current_staff_department_name() to authenticated;
grant execute on function public.can_access_workspace_area(text) to authenticated;
grant execute on function public.can_manage_ngo_portal_accounts() to authenticated;
grant execute on function public.can_route_report_to(uuid) to authenticated;
grant execute on function public.has_ngo_finance_access(uuid,text) to authenticated;
grant execute on function public.set_ngo_portal_membership(uuid,text,text) to authenticated;
grant execute on function public.request_finance_ngo_account(uuid,jsonb,text) to authenticated;
grant execute on function public.review_finance_ngo_account_request(uuid,text,text) to authenticated;
grant execute on function public.finance_quarter_bounds(integer,integer) to authenticated;
grant execute on function public.finance_quarter_is_locked(uuid,date) to authenticated;
grant execute on function public.ngo_portal_finance_account_catalog(uuid) to authenticated;
grant execute on function public.ngo_portal_recent_transactions(uuid,integer) to authenticated;
grant execute on function public.finance_quarter_readiness(uuid,integer,integer) to authenticated;
grant execute on function public.prepare_finance_quarter(uuid,integer,integer,boolean) to authenticated;
grant execute on function public.submit_finance_quarter(uuid) to authenticated;
grant execute on function public.review_finance_quarter(uuid,text,text) to authenticated;
grant execute on function public.create_and_post_ngo_portal_expense(uuid,uuid,uuid,text,date,numeric,text,text,text,uuid,uuid) to authenticated;

comment on table public.ngo_portal_memberships is
  'Explicit NGO-scoped portal access. A member can never use this relation to access another NGO.';
comment on table public.finance_quarterly_submissions is
  'Formal quarterly NGO-to-HPG accounting package and review state. Submitted quarters lock NGO portal posting.';
