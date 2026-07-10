-- NGO portal request forms are separate from internal departmental forms.
-- NGO users submit these to NGO Coordination first; staff can later route them internally.
--
-- Historical repair: the companion seed migration uses the portal-routing
-- columns below. They existed in production but were absent from the tracked
-- migration sequence, causing fresh migration replays to fail.

alter table public.form_templates
  add column if not exists form_audience text not null default 'staff',
  add column if not exists intake_module public.module_type not null default 'ngo_coordination'::public.module_type,
  add column if not exists audience text not null default 'staff',
  add column if not exists portal_visible boolean not null default false,
  add column if not exists triage_required boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'form_templates_form_audience_check'
      and conrelid = 'public.form_templates'::regclass
  ) then
    alter table public.form_templates
      add constraint form_templates_form_audience_check
      check (form_audience in ('staff', 'ngo_portal'));
  end if;
end $$;

create table if not exists public.ngo_request_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  request_type text not null,
  default_module module_type,
  schema_json jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_request_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.ngo_request_templates(id),
  ngo_id uuid not null references public.ngos(id),
  user_id uuid not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'submitted_to_ngo_coordination',
  requested_module module_type,
  routed_module module_type,
  routed_work_item_id uuid,
  coordinator_notes text,
  submitted_at timestamptz not null default now(),
  routed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_request_documents (
  id uuid primary key default gen_random_uuid(),
  request_submission_id uuid not null references public.ngo_request_submissions(id),
  document_id uuid not null references public.documents(id),
  created_at timestamptz not null default now(),
  unique (request_submission_id, document_id)
);

alter table public.ngo_request_templates enable row level security;
alter table public.ngo_request_submissions enable row level security;
alter table public.ngo_request_documents enable row level security;

create or replace function public.is_ngo_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('ngo_user', 'external_ngo')
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('ngo_user', 'external_ngo')
  );
$$;

create or replace function public.has_ngo_portal_access(_ngo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_internal_user()
    or exists (
      select 1 from public.contacts c
      where c.user_id = auth.uid()
        and c.ngo_id = _ngo_id
    );
$$;

drop policy if exists "ngo request templates readable" on public.ngo_request_templates;
create policy "ngo request templates readable"
on public.ngo_request_templates
for select
to authenticated
using (is_active = true and (public.is_ngo_user() or public.is_internal_user()));

drop policy if exists "ngo users create own requests" on public.ngo_request_submissions;
create policy "ngo users create own requests"
on public.ngo_request_submissions
for insert
to authenticated
with check (public.is_ngo_user() and user_id = auth.uid() and public.has_ngo_portal_access(ngo_id));

drop policy if exists "users view accessible ngo requests" on public.ngo_request_submissions;
create policy "users view accessible ngo requests"
on public.ngo_request_submissions
for select
to authenticated
using (public.has_ngo_portal_access(ngo_id));

drop policy if exists "internal users update ngo requests" on public.ngo_request_submissions;
create policy "internal users update ngo requests"
on public.ngo_request_submissions
for update
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

insert into public.ngo_request_templates (name, description, request_type, default_module, schema_json)
values ('Receipt Submission', 'Submit receipts for NGO Coordination review before Finance routing.', 'receipt_submission', 'finance', '[]'::jsonb);

insert into public.ngo_request_templates (name, description, request_type, default_module, schema_json)
values ('Support Request', 'Ask NGO Coordination for help.', 'support_request', 'ngo_coordination', '[]'::jsonb);
