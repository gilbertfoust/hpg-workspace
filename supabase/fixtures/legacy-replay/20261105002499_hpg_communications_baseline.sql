-- CI-ONLY communications source-schema baseline derived from actual HPG
-- PostgreSQL catalogs on 2026-11-08; required by November 5 releases.
-- The original Communications module was provisioned outside the checked-in
-- migration history. These tables are EMPTY and are recreated on disposable
-- CI Postgres only. Never apply this fixture on the production database.
-- FK constraints to external Communications tables not present in the old
-- Git history are intentionally deferred until a separately reviewed
-- whole-module metadata parity reconciliation.

-- Restore the live authorization predicates referenced by the canonical
-- magazine and private-media migrations. Keep their role checks intact.
create function private.communications_department_id()
returns uuid
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select unit.id
  from public.org_units unit
  where lower(trim(unit.department_name)) = 'communications'
    and unit.sub_department_name is null
  order by unit.created_at, unit.id
  limit 1;
$$;
revoke all on function private.communications_department_id() from public, anon, authenticated;

create function public.is_communications_staff()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select public.is_internal_user()
    and public.can_access_workspace_area('communications');
$$;
revoke all on function public.is_communications_staff() from public, anon;
grant execute on function public.is_communications_staff() to authenticated, service_role;

create function public.is_communications_approver()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select public.is_communications_staff()
    and (
      public.is_admin_user()
      or public.is_department_member(private.communications_department_id())
    )
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role in ('super_admin', 'admin_pm', 'vp_communications', 'department_lead')
        and profile.is_approved
        and lower(trim(profile.approval_status)) = 'approved'
    );
$$;
revoke all on function public.is_communications_approver() from public, anon;
grant execute on function public.is_communications_approver() to authenticated, service_role;

create table if not exists public.communications_editorial_items (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid,
  "ngo_id" uuid,
  "program_project_id" uuid,
  "grant_application_id" uuid,
  "content_type" text not null,
  "title" text not null,
  "slug" text,
  "pitch_summary" text not null,
  "story_angle" text,
  "beat" text,
  "audience" text,
  "channels" text[] default '{}'::text[] not null,
  "sensitivity" text default 'routine'::text not null,
  "status" text default 'pitch'::text not null,
  "workflow_cycle" integer default 1 not null,
  "priority" text default 'medium'::text not null,
  "owner_user_id" uuid,
  "editor_user_id" uuid,
  "fact_checker_user_id" uuid,
  "legal_reviewer_user_id" uuid,
  "word_target" integer,
  "due_at" timestamptz,
  "scheduled_at" timestamptz,
  "embargo_until" timestamptz,
  "published_at" timestamptz,
  "publication_url" text,
  "publication_evidence_url" text,
  "current_version" integer default 0 not null,
  "work_item_id" uuid,
  "created_by_user_id" uuid not null,
  "archived_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_editorial_items_pkey primary key (id)
);


create table if not exists public.communications_publications (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid,
  "publication_type" text not null,
  "title" text not null,
  "issue_code" text,
  "theme" text,
  "subject_line" text,
  "preview_text" text,
  "audience_segment" text not null,
  "target_audience_size" integer,
  "channels" text[] default '{}'::text[] not null,
  "status" text default 'planning'::text not null,
  "workflow_cycle" integer default 1 not null,
  "priority" text default 'medium'::text not null,
  "editor_user_id" uuid,
  "production_owner_user_id" uuid,
  "reviewer_user_id" uuid,
  "due_at" timestamptz,
  "scheduled_at" timestamptz,
  "distributed_at" timestamptz,
  "design_proof_url" text,
  "published_url" text,
  "distribution_evidence_url" text,
  "external_campaign_id" text,
  "work_item_id" uuid,
  "created_by_user_id" uuid not null,
  "archived_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "ngo_id" uuid,
  constraint communications_publications_pkey primary key (id)
);


create table if not exists public.communications_content_versions (
  "id" uuid default gen_random_uuid() not null,
  "editorial_item_id" uuid not null,
  "version" integer not null,
  "headline" text not null,
  "dek" text,
  "body_markdown" text not null,
  "source_disclosure" text,
  "author_notes" text,
  "change_summary" text,
  "status" text default 'submitted'::text not null,
  "created_by_user_id" uuid not null,
  "submitted_at" timestamptz,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamptz,
  "review_notes" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_content_versions_pkey primary key (id)
);


create table if not exists public.communications_sources (
  "id" uuid default gen_random_uuid() not null,
  "editorial_item_id" uuid not null,
  "source_name" text not null,
  "organization_title" text,
  "source_type" text default 'interview'::text not null,
  "source_url" text,
  "contact_reference" text,
  "consent_status" text default 'not_required'::text not null,
  "attribution_status" text default 'on_record'::text not null,
  "quote_verified" boolean default false not null,
  "verification_notes" text,
  "evidence_url" text,
  "created_by_user_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_sources_pkey primary key (id)
);


create table if not exists public.communications_rights_consents (
  "id" uuid default gen_random_uuid() not null,
  "editorial_item_id" uuid not null,
  "subject_reference" text not null,
  "consent_type" text not null,
  "status" text default 'required'::text not null,
  "scope_notes" text,
  "evidence_url" text,
  "granted_at" timestamptz,
  "expires_at" timestamptz,
  "verified_by_user_id" uuid,
  "created_by_user_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_rights_consents_pkey primary key (id)
);


create table if not exists public.communications_fact_checks (
  "id" uuid default gen_random_uuid() not null,
  "editorial_item_id" uuid not null,
  "version_id" uuid,
  "claim_text" text not null,
  "source_url" text,
  "result" text default 'pending'::text not null,
  "notes" text,
  "checked_by_user_id" uuid,
  "checked_at" timestamptz,
  "created_by_user_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_fact_checks_pkey primary key (id)
);


create table if not exists public.communications_events (
  "id" bigint generated by default as identity not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "event_type" text not null,
  "from_status" text,
  "to_status" text,
  "actor_user_id" uuid,
  "work_item_id" uuid,
  "notes" text,
  "event_metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null,
  constraint communications_events_pkey primary key (id)
);


create table if not exists public.communications_publication_items (
  "id" uuid default gen_random_uuid() not null,
  "publication_id" uuid not null,
  "editorial_item_id" uuid not null,
  "section_name" text,
  "position" integer default 100 not null,
  "is_featured" boolean default false not null,
  "layout_notes" text,
  "created_by_user_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint communications_publication_items_pkey primary key (id)
);


alter table public.communications_content_versions add constraint "communications_content_versions_body_markdown_check" CHECK ((length(TRIM(BOTH FROM body_markdown)) >= 20));

alter table public.communications_content_versions add constraint "communications_content_versions_headline_check" CHECK (((length(TRIM(BOTH FROM headline)) >= 3) AND (length(TRIM(BOTH FROM headline)) <= 240)));

alter table public.communications_content_versions add constraint "communications_content_versions_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'changes_requested'::text, 'editor_accepted'::text, 'final'::text, 'superseded'::text])));

alter table public.communications_content_versions add constraint "communications_content_versions_version_check" CHECK ((version > 0));

alter table public.communications_content_versions add constraint "communications_content_versions_editorial_item_id_fkey" FOREIGN KEY (editorial_item_id) REFERENCES communications_editorial_items(id) ON DELETE CASCADE;

alter table public.communications_content_versions add constraint "communications_content_versions_editorial_item_id_version_key" UNIQUE (editorial_item_id, version);

alter table public.communications_editorial_items add constraint "communications_editorial_items_content_type_check" CHECK ((content_type = ANY (ARRAY['news_article'::text, 'investigative_feature'::text, 'magazine_feature'::text, 'newsletter_story'::text, 'press_release'::text, 'media_advisory'::text, 'impact_story'::text, 'interview'::text, 'op_ed'::text, 'internal_memo'::text, 'web_copy'::text, 'grant_narrative'::text])));

alter table public.communications_editorial_items add constraint "communications_editorial_items_current_version_check" CHECK ((current_version >= 0));

alter table public.communications_editorial_items add constraint "communications_editorial_items_pitch_summary_check" CHECK ((length(TRIM(BOTH FROM pitch_summary)) >= 10));

alter table public.communications_editorial_items add constraint "communications_editorial_items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));

alter table public.communications_editorial_items add constraint "communications_editorial_items_sensitivity_check" CHECK ((sensitivity = ANY (ARRAY['routine'::text, 'privacy'::text, 'safeguarding'::text, 'legal'::text, 'executive_statement'::text])));

alter table public.communications_editorial_items add constraint "communications_editorial_items_status_check" CHECK ((status = ANY (ARRAY['pitch'::text, 'assigned'::text, 'reporting'::text, 'drafting'::text, 'editorial_review'::text, 'revisions'::text, 'fact_check'::text, 'approval'::text, 'scheduled'::text, 'published'::text, 'archived'::text, 'canceled'::text])));

alter table public.communications_editorial_items add constraint "communications_editorial_items_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 3) AND (length(TRIM(BOTH FROM title)) <= 240)));

alter table public.communications_editorial_items add constraint "communications_editorial_items_word_target_check" CHECK (((word_target IS NULL) OR (word_target > 0)));

alter table public.communications_editorial_items add constraint "communications_editorial_items_workflow_cycle_check" CHECK ((workflow_cycle > 0));

alter table public.communications_events add constraint "communications_events_entity_type_check" CHECK ((entity_type = ANY (ARRAY['request'::text, 'editorial_item'::text, 'publication'::text, 'grant_assignment'::text, 'media_pitch'::text, 'media_contact'::text, 'template'::text])));

alter table public.communications_fact_checks add constraint "communications_fact_checks_claim_text_check" CHECK ((length(TRIM(BOTH FROM claim_text)) >= 3));

alter table public.communications_fact_checks add constraint "communications_fact_checks_result_check" CHECK ((result = ANY (ARRAY['pending'::text, 'verified'::text, 'corrected'::text, 'disputed'::text, 'removed'::text])));

alter table public.communications_fact_checks add constraint "communications_fact_checks_editorial_item_id_fkey" FOREIGN KEY (editorial_item_id) REFERENCES communications_editorial_items(id) ON DELETE CASCADE;

alter table public.communications_fact_checks add constraint "communications_fact_checks_version_id_fkey" FOREIGN KEY (version_id) REFERENCES communications_content_versions(id) ON DELETE SET NULL;

alter table public.communications_publication_items add constraint "communications_publication_items_position_check" CHECK (("position" >= 0));

alter table public.communications_publication_items add constraint "communications_publication_items_editorial_item_id_fkey" FOREIGN KEY (editorial_item_id) REFERENCES communications_editorial_items(id) ON DELETE RESTRICT;

alter table public.communications_publication_items add constraint "communications_publication_items_publication_id_fkey" FOREIGN KEY (publication_id) REFERENCES communications_publications(id) ON DELETE CASCADE;

alter table public.communications_publication_items add constraint "communications_publication_it_publication_id_editorial_item_key" UNIQUE (publication_id, editorial_item_id);

alter table public.communications_publications add constraint "communications_publications_audience_segment_check" CHECK ((length(TRIM(BOTH FROM audience_segment)) >= 2));

alter table public.communications_publications add constraint "communications_publications_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));

alter table public.communications_publications add constraint "communications_publications_publication_type_check" CHECK ((publication_type = ANY (ARRAY['magazine_issue'::text, 'newsletter_campaign'::text, 'special_report'::text, 'press_packet'::text])));

alter table public.communications_publications add constraint "communications_publications_status_check" CHECK ((status = ANY (ARRAY['planning'::text, 'commissioning'::text, 'production'::text, 'review'::text, 'changes_requested'::text, 'approved'::text, 'scheduled'::text, 'distributed'::text, 'archived'::text, 'canceled'::text])));

alter table public.communications_publications add constraint "communications_publications_target_audience_size_check" CHECK (((target_audience_size IS NULL) OR (target_audience_size >= 0)));

alter table public.communications_publications add constraint "communications_publications_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 3) AND (length(TRIM(BOTH FROM title)) <= 240)));

alter table public.communications_publications add constraint "communications_publications_workflow_cycle_check" CHECK ((workflow_cycle > 0));

alter table public.communications_rights_consents add constraint "communications_rights_consents_consent_type_check" CHECK ((consent_type = ANY (ARRAY['interview'::text, 'quotation'::text, 'photograph'::text, 'video'::text, 'audio'::text, 'beneficiary_story'::text, 'minor_guardian'::text, 'license'::text, 'trademark'::text, 'other'::text])));

alter table public.communications_rights_consents add constraint "communications_rights_consents_status_check" CHECK ((status = ANY (ARRAY['required'::text, 'requested'::text, 'granted'::text, 'restricted'::text, 'declined'::text, 'expired'::text, 'not_required'::text])));

alter table public.communications_rights_consents add constraint "communications_rights_consents_subject_reference_check" CHECK ((length(TRIM(BOTH FROM subject_reference)) >= 2));

alter table public.communications_rights_consents add constraint "communications_rights_consents_editorial_item_id_fkey" FOREIGN KEY (editorial_item_id) REFERENCES communications_editorial_items(id) ON DELETE CASCADE;

alter table public.communications_sources add constraint "communications_sources_attribution_status_check" CHECK ((attribution_status = ANY (ARRAY['on_record'::text, 'background'::text, 'not_for_attribution'::text, 'off_record'::text])));

alter table public.communications_sources add constraint "communications_sources_consent_status_check" CHECK ((consent_status = ANY (ARRAY['not_required'::text, 'requested'::text, 'granted'::text, 'declined'::text, 'restricted'::text])));

alter table public.communications_sources add constraint "communications_sources_source_name_check" CHECK ((length(TRIM(BOTH FROM source_name)) >= 2));

alter table public.communications_sources add constraint "communications_sources_source_type_check" CHECK ((source_type = ANY (ARRAY['interview'::text, 'document'::text, 'dataset'::text, 'official_record'::text, 'expert'::text, 'participant'::text, 'observation'::text, 'other'::text])));

alter table public.communications_sources add constraint "communications_sources_editorial_item_id_fkey" FOREIGN KEY (editorial_item_id) REFERENCES communications_editorial_items(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS communications_content_versions_editorial_item_id_version_key ON public.communications_content_versions USING btree (editorial_item_id, version);

CREATE INDEX IF NOT EXISTS communications_versions_creator_idx ON public.communications_content_versions USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_versions_item_idx ON public.communications_content_versions USING btree (editorial_item_id, version DESC);

CREATE INDEX IF NOT EXISTS communications_versions_reviewer_idx ON public.communications_content_versions USING btree (reviewed_by_user_id) WHERE (reviewed_by_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_creator_idx ON public.communications_editorial_items USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_editorial_editor_idx ON public.communications_editorial_items USING btree (editor_user_id, status);

CREATE INDEX IF NOT EXISTS communications_editorial_fact_checker_idx ON public.communications_editorial_items USING btree (fact_checker_user_id) WHERE (fact_checker_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_grant_idx ON public.communications_editorial_items USING btree (grant_application_id) WHERE (grant_application_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_legal_reviewer_idx ON public.communications_editorial_items USING btree (legal_reviewer_user_id) WHERE (legal_reviewer_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_ngo_idx ON public.communications_editorial_items USING btree (ngo_id) WHERE (ngo_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_owner_idx ON public.communications_editorial_items USING btree (owner_user_id, status);

CREATE INDEX IF NOT EXISTS communications_editorial_program_project_idx ON public.communications_editorial_items USING btree (program_project_id) WHERE (program_project_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_request_idx ON public.communications_editorial_items USING btree (request_id) WHERE (request_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS communications_editorial_slug_unique ON public.communications_editorial_items USING btree (slug) WHERE (slug IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_editorial_status_due_idx ON public.communications_editorial_items USING btree (status, due_at);

CREATE INDEX IF NOT EXISTS communications_editorial_work_item_idx ON public.communications_editorial_items USING btree (work_item_id) WHERE (work_item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_events_actor_idx ON public.communications_events USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_events_entity_created_idx ON public.communications_events USING btree (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS communications_events_work_item_idx ON public.communications_events USING btree (work_item_id) WHERE (work_item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_fact_checks_checker_idx ON public.communications_fact_checks USING btree (checked_by_user_id) WHERE (checked_by_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_fact_checks_creator_idx ON public.communications_fact_checks USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_fact_checks_item_idx ON public.communications_fact_checks USING btree (editorial_item_id, result);

CREATE INDEX IF NOT EXISTS communications_fact_checks_version_idx ON public.communications_fact_checks USING btree (version_id) WHERE (version_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS communications_publication_it_publication_id_editorial_item_key ON public.communications_publication_items USING btree (publication_id, editorial_item_id);

CREATE INDEX IF NOT EXISTS communications_publication_items_creator_idx ON public.communications_publication_items USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_publication_items_item_idx ON public.communications_publication_items USING btree (editorial_item_id);

CREATE INDEX IF NOT EXISTS communications_publications_creator_idx ON public.communications_publications USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_publications_editor_idx ON public.communications_publications USING btree (editor_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS communications_publications_issue_code_unique ON public.communications_publications USING btree (publication_type, issue_code) WHERE (issue_code IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_publications_ngo ON public.communications_publications USING btree (ngo_id) WHERE (ngo_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_publications_production_owner_idx ON public.communications_publications USING btree (production_owner_user_id);

CREATE INDEX IF NOT EXISTS communications_publications_request_idx ON public.communications_publications USING btree (request_id) WHERE (request_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_publications_reviewer_idx ON public.communications_publications USING btree (reviewer_user_id) WHERE (reviewer_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_publications_status_due_idx ON public.communications_publications USING btree (status, due_at);

CREATE INDEX IF NOT EXISTS communications_publications_work_item_idx ON public.communications_publications USING btree (work_item_id) WHERE (work_item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_rights_creator_idx ON public.communications_rights_consents USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_rights_item_idx ON public.communications_rights_consents USING btree (editorial_item_id, status);

CREATE INDEX IF NOT EXISTS communications_rights_verifier_idx ON public.communications_rights_consents USING btree (verified_by_user_id) WHERE (verified_by_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS communications_sources_creator_idx ON public.communications_sources USING btree (created_by_user_id);

CREATE INDEX IF NOT EXISTS communications_sources_item_idx ON public.communications_sources USING btree (editorial_item_id, created_at);

alter table public.communications_editorial_items enable row level security;

revoke all on public.communications_editorial_items from public,anon,authenticated;

grant all on public.communications_editorial_items to service_role;

alter table public.communications_publications enable row level security;

revoke all on public.communications_publications from public,anon,authenticated;

grant all on public.communications_publications to service_role;

alter table public.communications_content_versions enable row level security;

revoke all on public.communications_content_versions from public,anon,authenticated;

grant all on public.communications_content_versions to service_role;

alter table public.communications_sources enable row level security;

revoke all on public.communications_sources from public,anon,authenticated;

grant all on public.communications_sources to service_role;

alter table public.communications_rights_consents enable row level security;

revoke all on public.communications_rights_consents from public,anon,authenticated;

grant all on public.communications_rights_consents to service_role;

alter table public.communications_fact_checks enable row level security;

revoke all on public.communications_fact_checks from public,anon,authenticated;

grant all on public.communications_fact_checks to service_role;

alter table public.communications_events enable row level security;

revoke all on public.communications_events from public,anon,authenticated;

grant all on public.communications_events to service_role;

alter table public.communications_publication_items enable row level security;

revoke all on public.communications_publication_items from public,anon,authenticated;

grant all on public.communications_publication_items to service_role;
