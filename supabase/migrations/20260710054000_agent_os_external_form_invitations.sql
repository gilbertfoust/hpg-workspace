-- Secure pre-activation form invitations for applicants who do not yet have
-- an HPG Workspace or NGO Portal account.
-- Raw invitation tokens are never stored. Only a SHA-256 hash is persisted.

create table if not exists public.agent_os_external_form_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  case_registry_id uuid not null references public.case_registry(id) on delete cascade,
  ngo_id uuid references public.ngos(id) on delete set null,
  form_template_id uuid not null references public.form_templates(id) on delete restrict,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending'
    check (status in ('pending','sent','processing','submitted','expired','revoked','failed')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  processing_started_at timestamptz,
  submitted_at timestamptz,
  submission_id uuid references public.form_submissions(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_agent text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.profiles(id) on delete set null,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_os_external_form_invitations_case_idx
  on public.agent_os_external_form_invitations(case_registry_id, created_at desc);

create index if not exists agent_os_external_form_invitations_status_idx
  on public.agent_os_external_form_invitations(status, expires_at);

create unique index if not exists agent_os_external_form_invitations_submission_unique
  on public.agent_os_external_form_invitations(submission_id)
  where submission_id is not null;

create unique index if not exists agent_os_external_form_invitations_active_unique
  on public.agent_os_external_form_invitations(case_registry_id, form_template_id)
  where status in ('pending','sent','processing');

create trigger agent_os_external_form_invitations_updated_at
before update on public.agent_os_external_form_invitations
for each row execute function public.agent_os_set_updated_at();

alter table public.agent_os_external_form_invitations enable row level security;

create policy "Internal users can read external form invitations"
  on public.agent_os_external_form_invitations for select to authenticated
  using (public.is_internal_user());

create policy "Internal users can create external form invitations"
  on public.agent_os_external_form_invitations for insert to authenticated
  with check (public.is_internal_user());

create policy "Internal users can update external form invitations"
  on public.agent_os_external_form_invitations for update to authenticated
  using (public.is_internal_user()) with check (public.is_internal_user());

create policy "Super admins can delete external form invitations"
  on public.agent_os_external_form_invitations for delete to authenticated
  using (public.is_super_admin());

grant select, insert, update on public.agent_os_external_form_invitations to authenticated;
grant all on public.agent_os_external_form_invitations to service_role;

create or replace view public.agent_os_external_form_invitation_status
with (security_invoker = true)
as
select
  i.id,
  i.case_registry_id,
  c.reference_number,
  c.organization_name,
  c.jurisdiction_class,
  i.ngo_id,
  i.form_template_id,
  f.name as form_name,
  i.recipient_email,
  i.recipient_name,
  i.status,
  i.expires_at,
  i.sent_at,
  i.opened_at,
  i.submitted_at,
  i.submission_id,
  i.work_item_id,
  i.last_error,
  i.created_at,
  i.updated_at
from public.agent_os_external_form_invitations i
join public.case_registry c on c.id = i.case_registry_id
join public.form_templates f on f.id = i.form_template_id;

grant select on public.agent_os_external_form_invitation_status to authenticated;

comment on table public.agent_os_external_form_invitations
  is 'One-time, expiring, hashed-token invitations for secure external forms before an NGO has portal access.';
