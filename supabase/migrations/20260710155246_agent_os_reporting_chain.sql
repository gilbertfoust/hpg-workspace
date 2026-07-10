-- HPG Agent OS reporting chain.
-- Records specialist, Director, VP, and Noemi report packets and their source
-- relationships. It does not publish reports or place files in Google Drive.

create table if not exists public.agent_os_report_packets (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  report_type text not null check (
    report_type in (
      'specialist_update',
      'director_synthesis',
      'vp_department_report',
      'noemi_ceo_brief',
      'weekly_cabinet',
      'monthly_board',
      'donor_funder_internal',
      'ngo_portfolio_internal',
      'urgent_brief',
      'automation_health'
    )
  ),
  cadence text not null default 'ad_hoc' check (
    cadence in ('daily','weekly','monthly','urgent','ad_hoc')
  ),
  report_date date not null,
  reporting_period_start date,
  reporting_period_end date,
  department_id uuid references public.departments(id) on delete set null,
  subdepartment_function text,
  prepared_by_agent text not null,
  prepared_by_role text not null,
  status text not null default 'draft' check (
    status in ('draft','submitted','pending_review','approved','rejected','archived')
  ),
  audience text not null default 'internal_department' check (
    audience in ('internal_department','cabinet','executive','board_internal','donor_internal','portfolio_internal')
  ),
  quiet_day boolean not null default false,
  summary text not null,
  decisions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  source_links jsonb not null default '[]'::jsonb,
  human_review_required boolean not null default true,
  reviewed_by_name text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  raw_drive_document_id text,
  raw_drive_document_url text,
  executive_drive_ready boolean not null default false,
  executive_drive_document_id text,
  executive_drive_document_url text,
  external_publication_allowed boolean not null default false check (external_publication_allowed = false),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_period_end is null or reporting_period_start is null or reporting_period_end >= reporting_period_start),
  check (jsonb_typeof(decisions) = 'array'),
  check (jsonb_typeof(risks) = 'array'),
  check (jsonb_typeof(priorities) = 'array'),
  check (jsonb_typeof(opportunities) = 'array'),
  check (jsonb_typeof(follow_ups) = 'array'),
  check (jsonb_typeof(source_links) = 'array')
);

create table if not exists public.agent_os_report_packet_sources (
  report_packet_id uuid not null references public.agent_os_report_packets(id) on delete cascade,
  source_report_packet_id uuid not null references public.agent_os_report_packets(id) on delete restrict,
  relationship text not null default 'synthesizes' check (
    relationship in ('synthesizes','summarizes','escalates','supports','updates')
  ),
  created_at timestamptz not null default now(),
  primary key (report_packet_id, source_report_packet_id),
  check (report_packet_id <> source_report_packet_id)
);

create index if not exists agent_os_report_packets_review_idx
  on public.agent_os_report_packets(status, report_date, report_type)
  where status in ('submitted','pending_review');

create index if not exists agent_os_report_packets_department_idx
  on public.agent_os_report_packets(department_id, report_date desc);

create index if not exists agent_os_report_packet_sources_source_idx
  on public.agent_os_report_packet_sources(source_report_packet_id);

create or replace function public.agent_os_guard_report_packet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.report_type = 'noemi_ceo_brief' then
    if extract(isodow from new.report_date) in (6,7) and new.cadence = 'daily' then
      raise exception 'Routine Noemi CEO briefs are not permitted on weekends';
    end if;
    new.audience := 'executive';
    new.human_review_required := true;
    new.external_publication_allowed := false;
  end if;

  if new.quiet_day then
    if new.report_type <> 'noemi_ceo_brief' then
      raise exception 'Quiet-day reports are limited to Noemi CEO briefs';
    end if;
    if jsonb_array_length(new.decisions) > 0
       or jsonb_array_length(new.risks) > 0
       or jsonb_array_length(new.priorities) > 0
       or jsonb_array_length(new.opportunities) > 0
       or jsonb_array_length(new.follow_ups) > 0 then
      raise exception 'Quiet-day brief cannot contain material action arrays';
    end if;
  end if;

  if new.status in ('submitted','pending_review') and new.submitted_at is null then
    new.submitted_at := now();
  end if;

  if new.status = 'approved' then
    if nullif(btrim(coalesce(new.reviewed_by_name,'')), '') is null then
      raise exception 'Approved reports require a named human reviewer';
    end if;
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;

  new.external_publication_allowed := false;
  return new;
end;
$$;

revoke all on function public.agent_os_guard_report_packet() from public;

drop trigger if exists agent_os_report_packets_guard on public.agent_os_report_packets;
create trigger agent_os_report_packets_guard
before insert or update on public.agent_os_report_packets
for each row execute function public.agent_os_guard_report_packet();

drop trigger if exists agent_os_report_packets_set_updated_at on public.agent_os_report_packets;
create trigger agent_os_report_packets_set_updated_at
before update on public.agent_os_report_packets
for each row execute function public.agent_os_set_updated_at();

create or replace function public.agent_os_link_report_packet(
  p_report_packet_id uuid,
  p_source_report_packet_id uuid,
  p_relationship text default 'synthesizes'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_source_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to link Agent OS report packets';
  end if;

  select report_type into v_target_type
  from public.agent_os_report_packets
  where id = p_report_packet_id;

  select report_type into v_source_type
  from public.agent_os_report_packets
  where id = p_source_report_packet_id;

  if v_target_type is null or v_source_type is null then
    raise exception 'Target and source report packets must exist';
  end if;

  if not (
    (v_target_type = 'director_synthesis' and v_source_type = 'specialist_update')
    or (v_target_type = 'vp_department_report' and v_source_type = 'director_synthesis')
    or (v_target_type = 'noemi_ceo_brief' and v_source_type in ('vp_department_report','urgent_brief','automation_health'))
    or (v_target_type = 'weekly_cabinet' and v_source_type in ('vp_department_report','noemi_ceo_brief','urgent_brief','automation_health'))
    or (v_target_type = 'monthly_board' and v_source_type in ('weekly_cabinet','vp_department_report','noemi_ceo_brief'))
    or (v_target_type in ('donor_funder_internal','ngo_portfolio_internal') and v_source_type in ('specialist_update','director_synthesis','vp_department_report'))
  ) then
    raise exception 'Invalid report-chain relationship: % cannot synthesize %', v_target_type, v_source_type;
  end if;

  insert into public.agent_os_report_packet_sources(
    report_packet_id, source_report_packet_id, relationship
  ) values (
    p_report_packet_id, p_source_report_packet_id,
    coalesce(nullif(btrim(p_relationship),''), 'synthesizes')
  ) on conflict do nothing;
end;
$$;

revoke all on function public.agent_os_link_report_packet(uuid,uuid,text) from public;
grant execute on function public.agent_os_link_report_packet(uuid,uuid,text) to authenticated, service_role;

alter table public.agent_os_report_packets enable row level security;
alter table public.agent_os_report_packet_sources enable row level security;

drop policy if exists "Internal users can read report packets" on public.agent_os_report_packets;
create policy "Internal users can read report packets"
  on public.agent_os_report_packets for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create report packets" on public.agent_os_report_packets;
create policy "Internal users can create report packets"
  on public.agent_os_report_packets for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Internal users can update report packets" on public.agent_os_report_packets;
create policy "Internal users can update report packets"
  on public.agent_os_report_packets for update to authenticated
  using ((select public.is_internal_user()))
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete report packets" on public.agent_os_report_packets;
create policy "Super admins can delete report packets"
  on public.agent_os_report_packets for delete to authenticated
  using ((select public.is_super_admin()));

drop policy if exists "Internal users can read report packet sources" on public.agent_os_report_packet_sources;
create policy "Internal users can read report packet sources"
  on public.agent_os_report_packet_sources for select to authenticated
  using ((select public.is_internal_user()));

drop policy if exists "Internal users can create report packet sources" on public.agent_os_report_packet_sources;
create policy "Internal users can create report packet sources"
  on public.agent_os_report_packet_sources for insert to authenticated
  with check ((select public.is_internal_user()));

drop policy if exists "Super admins can delete report packet sources" on public.agent_os_report_packet_sources;
create policy "Super admins can delete report packet sources"
  on public.agent_os_report_packet_sources for delete to authenticated
  using ((select public.is_super_admin()));

grant select, insert, update on public.agent_os_report_packets to authenticated;
grant select, insert on public.agent_os_report_packet_sources to authenticated;
grant all on public.agent_os_report_packets to service_role;
grant all on public.agent_os_report_packet_sources to service_role;

create or replace view public.agent_os_report_review_queue
with (security_invoker = true)
as
select
  r.id,
  r.report_type,
  r.cadence,
  r.report_date,
  r.department_id,
  r.subdepartment_function,
  r.prepared_by_agent,
  r.prepared_by_role,
  r.status,
  r.audience,
  r.quiet_day,
  r.summary,
  r.decisions,
  r.risks,
  r.priorities,
  r.opportunities,
  r.follow_ups,
  r.source_links,
  r.human_review_required,
  r.submitted_at,
  r.executive_drive_ready,
  r.metadata,
  count(s.source_report_packet_id) as source_report_count
from public.agent_os_report_packets r
left join public.agent_os_report_packet_sources s on s.report_packet_id = r.id
where r.status in ('submitted','pending_review')
group by r.id;

grant select on public.agent_os_report_review_queue to authenticated;

create or replace view public.agent_os_reporting_chain_status
with (security_invoker = true)
as
select
  r.report_date,
  count(*) filter (where r.report_type = 'specialist_update') as specialist_updates,
  count(*) filter (where r.report_type = 'director_synthesis') as director_syntheses,
  count(*) filter (where r.report_type = 'vp_department_report') as vp_reports,
  count(*) filter (where r.report_type = 'noemi_ceo_brief') as noemi_briefs,
  count(*) filter (where r.report_type = 'noemi_ceo_brief' and r.status = 'approved') as approved_noemi_briefs,
  count(*) filter (where r.status in ('submitted','pending_review')) as pending_human_reviews,
  bool_and(not r.external_publication_allowed) as internal_only
from public.agent_os_report_packets r
group by r.report_date;

grant select on public.agent_os_reporting_chain_status to authenticated;

comment on table public.agent_os_report_packets is
  'Internal Agent OS reporting packets from specialist through Noemi. External publication is prohibited by schema.';
comment on function public.agent_os_link_report_packet(uuid,uuid,text) is
  'Links report sources only through approved specialist-to-Director-to-VP-to-Noemi reporting relationships.';
