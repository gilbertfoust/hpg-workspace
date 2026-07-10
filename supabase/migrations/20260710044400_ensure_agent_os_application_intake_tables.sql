-- Track the website application intake tables required by the Agent OS case
-- registration triggers. These tables already exist in some deployed HPG
-- environments but were not fully represented in the repository migration
-- history. The migration is additive and does not replace existing records.

create table if not exists public.sponsorship_applications (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  representative_name text,
  email text not null,
  application_status text not null default 'received',
  sponsorship_model text,
  country_of_registration text,
  country_of_operation text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sponsorship_applications
  add column if not exists organization_name text,
  add column if not exists representative_name text,
  add column if not exists email text,
  add column if not exists application_status text not null default 'received',
  add column if not exists sponsorship_model text,
  add column if not exists country_of_registration text,
  add column if not exists country_of_operation text,
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  position text,
  recruitment_status text not null default 'received',
  resume_file_path text,
  resume_link text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.volunteer_applications
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists position text,
  add column if not exists recruitment_status text not null default 'received',
  add column if not exists resume_file_path text,
  add column if not exists resume_link text,
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.board_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  role_interest text,
  professional_sector text,
  resume_file_path text,
  resume_link text,
  conflict_status text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_applications
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists role_interest text,
  add column if not exists professional_sector text,
  add column if not exists resume_file_path text,
  add column if not exists resume_link text,
  add column if not exists conflict_status text,
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists sponsorship_applications_email_idx
  on public.sponsorship_applications(lower(email));
create index if not exists volunteer_applications_email_idx
  on public.volunteer_applications(lower(email));
create index if not exists board_applications_email_idx
  on public.board_applications(lower(email));

alter table public.sponsorship_applications enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.board_applications enable row level security;

-- Public forms submit through server-side Edge Functions using the service
-- role. No direct anon/authenticated table access is granted here.
grant all on public.sponsorship_applications to service_role;
grant all on public.volunteer_applications to service_role;
grant all on public.board_applications to service_role;

comment on table public.sponsorship_applications
  is 'Server-side website sponsorship application intake; Agent OS registers a permanent NGO case after insert.';
comment on table public.volunteer_applications
  is 'Server-side website volunteer application intake; Agent OS registers a permanent volunteer case after insert.';
comment on table public.board_applications
  is 'Server-side website board application intake; Agent OS registers a permanent board candidate case after insert.';
