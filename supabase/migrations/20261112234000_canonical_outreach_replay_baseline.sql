-- Replay baseline for the canonical Development outreach prospect register.
-- HPG production already contains this table. This migration creates the SAME
-- canonical table only in fresh/local databases, not a parallel prospect system.
do $bootstrap$
begin
 if to_regclass('public.development_outreach_prospects') is null then
  create table public.development_outreach_prospects (
   id uuid primary key default gen_random_uuid(),
   prospect_name text not null unique,
   prospect_type text not null default 'community_partner',
   geography text,
   website text,
   outreach_categories text[] not null default '{}',
   approach_route text not null default 'verify_route',
   beneficiary_scope text not null default 'HPG',
   pipeline_stage text not null default 'identified',
   priority text not null default 'medium',
   contact_name text,
   contact_title text,
   contact_email text,
   contact_phone text,
   owner_user_id uuid references public.profiles(id) on delete set null,
   next_action text,
   next_action_due_at timestamptz,
   source_reference text,
   notes text,
   created_at timestamptz not null default now(),
   updated_at timestamptz not null default now(),
   constraint outreach_prospect_type_check check (prospect_type in ('local_vendor','national_vendor','restaurant','retailer','funding_platform','foundation','community_partner','other')),
   constraint outreach_prospect_scope_check check (beneficiary_scope in ('HPG','GYLFH','Both','NGO portfolio')),
   constraint outreach_prospect_stage_check check (pipeline_stage in ('identified','researching','contact_ready','outreach_sent','meeting_scheduled','meeting_complete','proposal_requested','committed','declined','on_hold')),
   constraint outreach_prospect_priority_check check (priority in ('low','medium','high','urgent'))
  );
  alter table public.development_outreach_prospects enable row level security;
  grant select on public.development_outreach_prospects to authenticated;
  create policy development_outreach_replay_read on public.development_outreach_prospects
   for select to authenticated using (public.is_internal_user());
 end if;
end $bootstrap$;
