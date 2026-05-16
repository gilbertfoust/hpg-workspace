-- Form workflow notifications
-- Adds department-level notification routing and durable notification attempt logs.

create table if not exists public.department_notification_routes (
  id uuid primary key default gen_random_uuid(),
  module text not null unique,
  department_name text not null,
  slack_channel text,
  slack_webhook_secret_name text,
  email_recipients text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_notification_events (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid not null references public.form_submissions(id) on delete cascade,
  form_template_id uuid not null references public.form_templates(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  module text not null,
  notification_type text not null check (notification_type in ('slack', 'email')),
  notification_status text not null default 'queued' check (notification_status in ('queued', 'sent', 'skipped', 'failed')),
  recipient text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_department_notification_routes_module on public.department_notification_routes(module);
create index if not exists idx_form_notification_events_submission on public.form_notification_events(form_submission_id);
create index if not exists idx_form_notification_events_work_item on public.form_notification_events(work_item_id);
create index if not exists idx_form_notification_events_status on public.form_notification_events(notification_status);

create or replace function public.set_department_notification_routes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_department_notification_routes_updated_at on public.department_notification_routes;
create trigger trg_department_notification_routes_updated_at
before update on public.department_notification_routes
for each row execute function public.set_department_notification_routes_updated_at();

alter table public.department_notification_routes enable row level security;
alter table public.form_notification_events enable row level security;

create policy "department notification routes readable by authenticated users"
on public.department_notification_routes for select
to authenticated
using (true);

create policy "department notification routes writable by authenticated users"
on public.department_notification_routes for all
to authenticated
using (true)
with check (true);

create policy "form notification events readable by authenticated users"
on public.form_notification_events for select
to authenticated
using (true);

create policy "form notification events insertable by authenticated users"
on public.form_notification_events for insert
to authenticated
with check (true);

create policy "form notification events updatable by authenticated users"
on public.form_notification_events for update
to authenticated
using (true)
with check (true);

insert into public.department_notification_routes (module, department_name, slack_channel, email_recipients)
values
  ('ngo_coordination', 'NGO Coordination', '#ngo-coordination', '{}'),
  ('administration', 'Administration', '#administration', '{}'),
  ('operations', 'Operations', '#operations', '{}'),
  ('program', 'Program', '#program', '{}'),
  ('curriculum', 'Curriculum', '#curriculum', '{}'),
  ('development', 'Development', '#development', '{}'),
  ('partnership', 'Partnership Development', '#partnerships', '{}'),
  ('marketing', 'Marketing', '#marketing', '{}'),
  ('communications', 'Communications', '#communications', '{}'),
  ('hr', 'Human Resources', '#hr', '{}'),
  ('it', 'Technology', '#it', '{}'),
  ('finance', 'Finance', '#finance', '{}'),
  ('legal', 'Legal / Compliance', '#legal-compliance', '{}')
on conflict (module) do nothing;
