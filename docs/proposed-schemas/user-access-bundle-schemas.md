# User Access Bundle — Supabase Backend

**Status: implemented** in migration `20260620180000_user_access_bundle_backend.sql`.

This document describes the schema that powers calendar events, upload notifications, potential sponsees, profile avatars, and the admin records FK fix.

Apply migrations with `supabase db push` or your deployment pipeline, then deploy edge functions:

- `process-upload-notification-events`
- `admin-update-role` (updated to sync `profiles.role`)

---
## 1. Calendar events (Phase 23)

```sql
create type public.calendar_event_type as enum (
  'meeting', 'deadline', 'birthday', 'compliance', 'training', 'other'
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type public.calendar_event_type not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  description text,
  ngo_id uuid references public.ngos(id) on delete set null,
  department_id uuid references public.org_units(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calendar_events_starts_at on public.calendar_events(starts_at);
alter table public.calendar_events enable row level security;

create policy "calendar events readable by authenticated"
  on public.calendar_events for select to authenticated using (true);

create policy "calendar events writable by admins"
  on public.calendar_events for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin', 'admin_pm')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin', 'admin_pm')
  ));
```

---

## 2. Upload notification events (Phase 25)

Durable queue for Slack/email dispatch (mirrors `form_notification_events`).

```sql
create table public.upload_notification_events (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  module text not null,
  department_id uuid references public.org_units(id) on delete set null,
  notification_type text not null check (notification_type in ('slack', 'email')),
  notification_status text not null default 'queued'
    check (notification_status in ('queued', 'sent', 'skipped', 'failed')),
  recipient text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_upload_notification_events_status on public.upload_notification_events(notification_status);
alter table public.upload_notification_events enable row level security;

create policy "upload notifications readable by authenticated"
  on public.upload_notification_events for select to authenticated using (true);

create policy "upload notifications insertable by authenticated"
  on public.upload_notification_events for insert to authenticated with check (true);
```

**Next integration step:** Edge function `process-upload-notification-events` reads queued rows, resolves `department_notification_routes.slack_webhook_secret_name`, posts to Slack.

---

## 3. Potential sponsees (Phase 26)

```sql
create type public.sponsee_outreach_status as enum (
  'research', 'contacted', 'in_conversation', 'on_hold', 'declined', 'converted'
);

create table public.potential_sponsees (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  country text,
  state_province text,
  city text,
  contact_person text,
  email text,
  phone text,
  website text,
  mission_area text,
  sponsorship_fit text,
  outreach_status public.sponsee_outreach_status not null default 'research',
  next_follow_up_date date,
  assigned_owner_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_potential_sponsees_outreach on public.potential_sponsees(outreach_status);
create index idx_potential_sponsees_follow_up on public.potential_sponsees(next_follow_up_date);
alter table public.potential_sponsees enable row level security;

create policy "potential sponsees readable by staff"
  on public.potential_sponsees for select to authenticated using (true);

create policy "potential sponsees writable by development and admin"
  on public.potential_sponsees for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin_pm', 'vp_development', 'department_lead', 'staff', 'staff_member')
  ))
  with check (true);
```

---

## 4. Profile avatars storage (Phase 30)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

create policy "users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins can upload any avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'admin_pm')
    )
  );
```

---

## 5. Admin records FK fix (Phase 22 follow-up)

`work_item_admin_records.department_id` should reference `org_units(id)` instead of `departments(id)` to match `work_items.department_id`.
