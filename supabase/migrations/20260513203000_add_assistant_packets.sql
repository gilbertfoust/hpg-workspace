-- HPG Assistant Phase 2: saved packet records and approval events
-- This migration is additive and does not modify existing NGO/work item tables.

create table if not exists public.assistant_packets (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  packet_type text not null default 'ngo_coordination_onboarding',
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'archived')),
  title text not null,
  summary text,
  packet_json jsonb not null,
  email_subject text,
  email_body text,
  cabinet_summary text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_packet_events (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.assistant_packets(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'reviewed', 'approval', 'archived', 'work_item_draft_created', 'note')),
  note text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_packets_ngo_id on public.assistant_packets(ngo_id);
create index if not exists idx_assistant_packets_status on public.assistant_packets(status);
create index if not exists idx_assistant_packets_created_at on public.assistant_packets(created_at desc);
create index if not exists idx_assistant_packet_events_packet_id on public.assistant_packet_events(packet_id);
create index if not exists idx_assistant_packet_events_ngo_id on public.assistant_packet_events(ngo_id);

create or replace function public.set_assistant_packets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assistant_packets_updated_at on public.assistant_packets;
create trigger trg_assistant_packets_updated_at
before update on public.assistant_packets
for each row execute function public.set_assistant_packets_updated_at();

alter table public.assistant_packets enable row level security;
alter table public.assistant_packet_events enable row level security;

-- Initial broad authenticated policies. These are intentionally compatible with the
-- current workspace while Phase 2 is being tested. Tighten by role/department after
-- the production role matrix is finalized.
drop policy if exists "assistant packets readable by authenticated users" on public.assistant_packets;
create policy "assistant packets readable by authenticated users"
on public.assistant_packets for select
to authenticated
using (true);

drop policy if exists "assistant packets insertable by authenticated users" on public.assistant_packets;
create policy "assistant packets insertable by authenticated users"
on public.assistant_packets for insert
to authenticated
with check (true);

drop policy if exists "assistant packets updatable by authenticated users" on public.assistant_packets;
create policy "assistant packets updatable by authenticated users"
on public.assistant_packets for update
to authenticated
using (true)
with check (true);

drop policy if exists "assistant packet events readable by authenticated users" on public.assistant_packet_events;
create policy "assistant packet events readable by authenticated users"
on public.assistant_packet_events for select
to authenticated
using (true);

drop policy if exists "assistant packet events insertable by authenticated users" on public.assistant_packet_events;
create policy "assistant packet events insertable by authenticated users"
on public.assistant_packet_events for insert
to authenticated
with check (true);
