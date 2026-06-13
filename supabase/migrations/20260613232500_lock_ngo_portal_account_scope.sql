-- Create a strict external NGO account scope and quarterly/annual compliance tracker.

create or replace function public.is_external_ngo_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'external_ngo'
  );
$$;

revoke all on function public.is_external_ngo_user() from public;
grant execute on function public.is_external_ngo_user() to authenticated;

-- External NGO accounts should upload only NGO-linked documents through the portal.
-- Internal users may still upload internal/department documents.
drop policy if exists "Users can upload documents for accessible NGOs" on public.documents;

create policy "Users can upload documents for accessible NGOs"
on public.documents
for insert
to authenticated
with check (
  (
    public.is_internal_user()
    and (
      ngo_id is not null
      or form_template_id is not null
      or department_id is not null
      or module is not null
    )
  )
  or (
    public.is_external_ngo_user()
    and ngo_id is not null
    and public.has_ngo_access(ngo_id)
    and work_item_id is null
    and form_template_id is null
    and department_id is null
    and module is null
  )
);

-- External NGO accounts may only view their own NGO-linked documents, never department-only documents.
drop policy if exists "View documents by NGO access" on public.documents;

create policy "View documents by NGO access"
on public.documents
for select
to authenticated
using (
  public.is_internal_user()
  or (
    public.is_external_ngo_user()
    and ngo_id is not null
    and public.has_ngo_access(ngo_id)
  )
);

create table if not exists public.ngo_compliance_periods (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  period_type text not null check (period_type in ('quarterly', 'annual')),
  period_label text not null,
  period_start date,
  period_end date,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'under_review', 'approved', 'needs_revision', 'overdue')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ngo_id, period_type, period_label)
);

alter table public.ngo_compliance_periods enable row level security;

drop policy if exists "Internal users can manage NGO compliance periods" on public.ngo_compliance_periods;
drop policy if exists "Portal users can view own NGO compliance periods" on public.ngo_compliance_periods;

create policy "Internal users can manage NGO compliance periods"
on public.ngo_compliance_periods
for all
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

create policy "Portal users can view own NGO compliance periods"
on public.ngo_compliance_periods
for select
to authenticated
using (
  public.is_external_ngo_user()
  and public.has_ngo_access(ngo_id)
);

create index if not exists idx_ngo_compliance_periods_ngo_id on public.ngo_compliance_periods(ngo_id);
create index if not exists idx_ngo_compliance_periods_status on public.ngo_compliance_periods(status);
create index if not exists idx_ngo_compliance_periods_due_date on public.ngo_compliance_periods(due_date);
