-- CI only. Restore the schema dependencies for local SQL lint and the
-- Academy integration/read-only and Communications publication paths.
-- Catalog source: live HPG PostgreSQL, November 9, 2026. No rows are seeded.
-- The Marketing tables include only the columns consumed by the Academy.
-- Communications helpers retain exact digest and approval checks for the
-- release paths. Unrelated workflow transitions are outside this baseline.

alter table public.documents add column if not exists title text;
alter table public.ngo_portal_memberships
  add column if not exists approval_activation_id uuid not null default gen_random_uuid();
alter table public.ngos
  add column if not exists archived_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists merged_into_ngo_id uuid references public.ngos(id) on delete restrict;

create table public.marketing_channel_accounts (
  id uuid default gen_random_uuid() not null,
  platform text not null,
  ownership_status text default 'unverified'::text not null,
  constraint marketing_channel_accounts_ownership_status_check CHECK (ownership_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'access_requested'::text, 'access_confirmed'::text, 'inactive'::text, 'archived'::text])),
  constraint marketing_channel_accounts_pkey PRIMARY KEY (id),
  constraint marketing_channel_accounts_platform_check CHECK (platform = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'x'::text, 'youtube'::text, 'tiktok'::text, 'threads'::text, 'pinterest'::text, 'google_business'::text, 'website'::text, 'email'::text, 'other'::text]))
);

create table public.marketing_social_posts (
  id uuid default gen_random_uuid() not null,
  status text default 'idea'::text not null,
  platform_post_id text,
  publication_evidence_url text,
  constraint marketing_social_posts_pkey PRIMARY KEY (id),
  constraint marketing_social_posts_status_check CHECK (status = ANY (ARRAY['idea'::text, 'brief'::text, 'drafting'::text, 'creative'::text, 'review'::text, 'changes_requested'::text, 'approved'::text, 'scheduled'::text, 'published'::text, 'measured'::text, 'archived'::text, 'canceled'::text]))
);

create table public.communications_approvals (
  id uuid default gen_random_uuid() not null,
  entity_type text not null,
  entity_id uuid not null,
  approval_type text not null,
  decision text not null,
  notes text,
  decided_by_user_id uuid not null,
  decided_at timestamp with time zone default now() not null,
  evidence_url text,
  created_at timestamp with time zone default now() not null,
  workflow_cycle integer,
  version_number integer,
  subject_digest text,
  constraint communications_approvals_approval_type_check CHECK (approval_type = ANY (ARRAY['editorial'::text, 'fact_check'::text, 'legal'::text, 'executive'::text, 'publication'::text, 'communications_grant'::text, 'development_grant'::text, 'media_pitch'::text, 'distribution'::text])),
  constraint communications_approvals_decision_check CHECK (decision = ANY (ARRAY['approved'::text, 'changes_requested'::text, 'rejected'::text])),
  constraint communications_approvals_entity_type_check CHECK (entity_type = ANY (ARRAY['editorial_item'::text, 'publication'::text, 'grant_assignment'::text, 'media_pitch'::text])),
  constraint communications_approvals_pkey PRIMARY KEY (id)
);

alter table public.marketing_channel_accounts enable row level security;
alter table public.marketing_social_posts enable row level security;
alter table public.communications_approvals enable row level security;
revoke all on table public.marketing_channel_accounts, public.marketing_social_posts,
  public.communications_approvals from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.require_communications_staff()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null or not public.is_communications_staff() then
    raise exception 'Approved Communications department access is required.' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.communications_subject_digest(p_entity_type text, p_entity_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_digest text;
begin
  if p_entity_type = 'editorial_item' then
    select md5(concat_ws('|', item.workflow_cycle::text, item.current_version::text,
      item.title, item.pitch_summary, item.audience, item.sensitivity,
      version.headline, version.dek, version.body_markdown,
      version.source_disclosure, version.author_notes, version.change_summary,
      coalesce((select string_agg(concat_ws(':', source.id::text,
        source.source_name, source.organization_title, source.source_type,
        source.source_url, source.contact_reference, source.consent_status,
        source.attribution_status, source.quote_verified::text,
        source.verification_notes, source.evidence_url), '|' order by source.id)
        from public.communications_sources source where source.editorial_item_id = item.id), ''),
      coalesce((select string_agg(concat_ws(':', fact.id::text, fact.version_id::text,
        fact.claim_text, fact.result, fact.source_url, fact.notes), '|' order by fact.id)
        from public.communications_fact_checks fact where fact.editorial_item_id = item.id), ''),
      coalesce((select string_agg(concat_ws(':', rights.id::text,
        rights.subject_reference, rights.consent_type, rights.status,
        rights.scope_notes, rights.evidence_url, rights.granted_at::text,
        rights.expires_at::text), '|' order by rights.id)
        from public.communications_rights_consents rights where rights.editorial_item_id = item.id), '')
    )) into v_digest
    from public.communications_editorial_items item
    left join public.communications_content_versions version
      on version.editorial_item_id = item.id and version.version = item.current_version
    where item.id = p_entity_id;
  elsif p_entity_type = 'publication' then
    select md5(concat_ws('|', publication.workflow_cycle::text, publication.title,
      publication.theme, publication.design_proof_url, publication.subject_line,
      publication.preview_text, publication.audience_segment,
      publication.target_audience_size::text,
      coalesce((select string_agg(concat_ws(':', placement.id::text,
        placement.editorial_item_id::text, placement.position::text,
        placement.section_name, placement.is_featured::text, placement.layout_notes), '|' order by placement.position, placement.id)
        from public.communications_publication_items placement
        where placement.publication_id = publication.id), '')
    )) into v_digest
    from public.communications_publications publication where publication.id = p_entity_id;
  else
    raise exception 'Unsupported Communications approval subject.' using errcode = '22023';
  end if;
  if v_digest is null then raise exception 'Communications approval subject not found.' using errcode = 'P0002'; end if;
  return v_digest;
end;
$function$;

CREATE OR REPLACE FUNCTION private.has_current_communications_approval(p_entity_type text, p_entity_id uuid, p_approval_type text, p_workflow_cycle integer, p_version_number integer, p_subject_digest text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((
    select approval.decision = 'approved'
      and approval.workflow_cycle = p_workflow_cycle
      and approval.version_number is not distinct from p_version_number
      and approval.subject_digest = p_subject_digest
    from public.communications_approvals approval
    where approval.entity_type = p_entity_type
      and approval.entity_id = p_entity_id
      and approval.approval_type = p_approval_type
    order by approval.decided_at desc, approval.created_at desc, approval.id desc
    limit 1
  ), false);
$function$;

-- This isolated replay supports the two native publication transitions.
-- Request-linked work item automation belongs to the historical live module.
create function private.transition_communications_record(
  p_board_key text,
  p_entity_id uuid,
  p_target_status text,
  p_reason text,
  p_work_item_id uuid
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_entity_type text;
  v_current text;
  v_cycle integer;
  v_request_id uuid;
  v_has_evidence boolean;
begin
  perform private.require_communications_staff();

  if p_board_key = 'communications_editorial' and p_target_status = 'published' then
    v_entity_type := 'editorial_item';
    select item.status, item.workflow_cycle, item.request_id,
      item.published_at is not null
        and trim(coalesce(item.publication_url, '')) ~* '^https://[^[:space:]]+$'
        and trim(coalesce(item.publication_evidence_url, '')) ~* '^https://[^[:space:]]+$'
        and (item.embargo_until is null or item.published_at >= item.embargo_until)
    into v_current, v_cycle, v_request_id, v_has_evidence
    from public.communications_editorial_items item where item.id = p_entity_id for update;
  elsif p_board_key = 'communications_publications' and p_target_status = 'distributed' then
    v_entity_type := 'publication';
    select item.status, item.workflow_cycle, item.request_id,
      item.distributed_at is not null
        and trim(coalesce(item.distribution_evidence_url, '')) ~* '^https://[^[:space:]]+$'
    into v_current, v_cycle, v_request_id, v_has_evidence
    from public.communications_publications item where item.id = p_entity_id for update;
  else
    raise exception 'Unsupported Communications replay transition' using errcode = '0A000';
  end if;

  if v_request_id is not null then
    raise exception 'Request-linked Communications release is outside the isolated replay'
      using errcode = '0A000';
  end if;
  if v_current is null or v_current not in ('scheduled', p_target_status)
      or not coalesce(v_has_evidence, false) then
    raise exception 'Scheduled content and valid release evidence are required'
      using errcode = '23514';
  end if;
  if v_current = p_target_status then
    return;
  end if;

  if v_entity_type = 'editorial_item' then
    update public.communications_editorial_items
      set status = p_target_status, updated_at = now() where id = p_entity_id;
  else
    update public.communications_publications
      set status = p_target_status, updated_at = now() where id = p_entity_id;
  end if;

  insert into public.communications_events (
    entity_type, entity_id, event_type, from_status, to_status, actor_user_id,
    work_item_id, notes, event_metadata
  ) values (
    v_entity_type, p_entity_id, 'status_changed', v_current, p_target_status, auth.uid(),
    p_work_item_id, nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('board_key', p_board_key, 'workflow_cycle', v_cycle)
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.record_communications_release(p_board_key text, p_entity_id uuid, p_action text, p_occurred_at timestamp with time zone, p_primary_url text, p_evidence_url text, p_channel text DEFAULT NULL::text, p_summary text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  perform private.require_communications_staff();
  if p_occurred_at is null or trim(coalesce(p_evidence_url, '')) !~* '^https://[^[:space:]]+$' then
    raise exception 'Actual time and HTTPS evidence are required.' using errcode = '23514';
  end if;
  if nullif(trim(coalesce(p_primary_url, '')), '') is not null
     and trim(p_primary_url) !~* '^https://[^[:space:]]+$' then
    raise exception 'The public or provider URL must use HTTPS.' using errcode = '23514';
  end if;
  perform set_config('hpg.communications_workflow_action', 'true', true);
  if p_board_key = 'communications_editorial' and p_action = 'publish' then
    if not public.is_communications_approver() then raise exception 'Final Communications approval is required.' using errcode = '42501'; end if;
    update public.communications_editorial_items set
      published_at = p_occurred_at, publication_url = p_primary_url,
      publication_evidence_url = p_evidence_url, updated_at = now()
    where id = p_entity_id;
    perform private.transition_communications_record(p_board_key, p_entity_id, 'published', p_summary, null);
  elsif p_board_key = 'communications_publications' and p_action = 'distribute' then
    if not public.is_communications_approver() then raise exception 'Final Communications approval is required.' using errcode = '42501'; end if;
    update public.communications_publications set
      distributed_at = p_occurred_at, published_url = p_primary_url,
      distribution_evidence_url = p_evidence_url, external_campaign_id = coalesce(nullif(trim(p_channel), ''), external_campaign_id),
      updated_at = now()
    where id = p_entity_id;
    perform private.transition_communications_record(p_board_key, p_entity_id, 'distributed', p_summary, null);
  else
    raise exception 'Unsupported release action.' using errcode = '22023';
  end if;
  perform set_config('hpg.communications_workflow_action', 'false', true);
end;
$function$;

revoke all on function private.require_communications_staff() from public, anon, authenticated;
revoke all on function private.communications_subject_digest(text, uuid) from public, anon, authenticated;
revoke all on function private.has_current_communications_approval(text, uuid, text, integer, integer, text)
  from public, anon, authenticated;
revoke all on function private.transition_communications_record(text, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_communications_release(
  text, uuid, text, timestamptz, text, text, text, text
) from public, anon, authenticated;

-- The live agreement routine already includes the extension schema.
alter function public.issue_ngo_agreement(uuid, uuid) set search_path to public, extensions;

-- The live admin-record routine already validates and casts the module.
CREATE OR REPLACE FUNCTION public.complete_work_item_for_admin_records(_work_item_id uuid, _notes text DEFAULT NULL)
RETURNS public.work_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.work_items;
  resolved_department_id uuid;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Internal staff access required';
  END IF;

  UPDATE public.work_items
  SET status = 'complete',
      completed_at = COALESCE(completed_at, now()),
      archived_at = COALESCE(archived_at, now()),
      archived_by_user_id = COALESCE(archived_by_user_id, auth.uid()),
      archive_reason = COALESCE(_notes, 'Completed and sent to admin records'),
      updated_at = now()
  WHERE id = _work_item_id
  RETURNING * INTO item;

  IF item.id IS NULL THEN
    RAISE EXCEPTION 'Work item not found';
  END IF;

  resolved_department_id := item.department_id;
  IF resolved_department_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.org_units ou WHERE ou.id = resolved_department_id) THEN
    resolved_department_id := NULL;
  END IF;

  INSERT INTO public.work_item_admin_records (
    work_item_id,
    title,
    module,
    department_id,
    ngo_id,
    completed_by_user_id,
    completed_at,
    archive_reason,
    notes,
    snapshot_json
  ) VALUES (
    item.id,
    item.title,
    item.module::public.module_type,
    resolved_department_id,
    item.ngo_id,
    auth.uid(),
    COALESCE(item.completed_at, now()),
    COALESCE(_notes, 'Completed and sent to admin records'),
    _notes,
    to_jsonb(item)
  )
  ON CONFLICT (work_item_id) DO UPDATE
  SET title = EXCLUDED.title,
      module = EXCLUDED.module,
      department_id = EXCLUDED.department_id,
      ngo_id = EXCLUDED.ngo_id,
      completed_by_user_id = EXCLUDED.completed_by_user_id,
      completed_at = EXCLUDED.completed_at,
      archive_reason = EXCLUDED.archive_reason,
      notes = EXCLUDED.notes,
      snapshot_json = EXCLUDED.snapshot_json;

  RETURN item;
END;
$$;

-- The Trello worker is present in historical replay only. Lock its queue row
-- while allowing an item without a linked case to schedule a retry.
create or replace function public.agent_os_record_worker_failure(
  p_queue_type text,
  p_queue_item_id uuid,
  p_error_message text,
  p_diagnostics jsonb default '{}'::jsonb,
  p_is_material boolean default false,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_attempts integer;
  v_attempt integer;
  v_case_registry_id uuid;
  v_department_id uuid;
  v_next_attempt_at timestamptz;
  v_outcome text;
  v_recovery_id uuid;
  v_notify_roles jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_internal_user() then
    raise exception 'Insufficient privileges to record Agent OS worker failure';
  end if;

  if p_queue_type = 'communication' then
    select q.attempts, q.case_registry_id, q.department_id
      into v_current_attempts, v_case_registry_id, v_department_id
      from public.communication_queue q
     where q.id = p_queue_item_id
     for update;
  elsif p_queue_type = 'trello' then
    select q.attempts, q.case_registry_id, c.department_id
      into v_current_attempts, v_case_registry_id, v_department_id
      from public.trello_sync_queue q
      left join public.case_registry c on c.id = q.case_registry_id
     where q.id = p_queue_item_id
     for update of q;
  else
    raise exception 'Unsupported queue type: %', p_queue_type;
  end if;

  if v_current_attempts is null then
    raise exception 'Queue item not found';
  end if;

  v_attempt := v_current_attempts + 1;

  if v_attempt = 1 then
    v_next_attempt_at := p_occurred_at + interval '5 minutes';
    v_outcome := 'retry_scheduled';
  elsif v_attempt = 2 then
    v_next_attempt_at := p_occurred_at + interval '30 minutes';
    v_outcome := 'retry_scheduled';
  else
    v_next_attempt_at := null;
    v_outcome := 'terminal_failure';
  end if;

  if p_queue_type = 'communication' then
    update public.communication_queue
       set attempts = v_attempt,
           last_attempt_at = p_occurred_at,
           error_message = p_error_message,
           next_attempt_at = v_next_attempt_at,
           status = case when v_outcome = 'terminal_failure' then 'failed' else 'pending' end,
           locked_at = null,
           locked_by = null,
           updated_at = p_occurred_at
     where id = p_queue_item_id;
  else
    update public.trello_sync_queue
       set attempts = v_attempt,
           last_attempt_at = p_occurred_at,
           error_message = p_error_message,
           next_attempt_at = v_next_attempt_at,
           status = case when v_outcome = 'terminal_failure' then 'failed' else 'pending' end,
           locked_at = null,
           locked_by = null,
           updated_at = p_occurred_at
     where id = p_queue_item_id;
  end if;

  insert into public.agent_os_worker_failure_attempts(
    queue_type, queue_item_id, case_registry_id, responsible_department_id,
    attempt_number, outcome, error_message, diagnostics, next_attempt_at, occurred_at
  ) values (
    p_queue_type, p_queue_item_id, v_case_registry_id, v_department_id,
    v_attempt, v_outcome, p_error_message, coalesce(p_diagnostics, '{}'::jsonb),
    v_next_attempt_at, p_occurred_at
  ) on conflict (queue_type, queue_item_id, attempt_number) do nothing;

  if v_outcome = 'terminal_failure' then
    v_notify_roles := case when p_is_material then
      jsonb_build_array('responsible_department','technology','noemi_vale')
    else
      jsonb_build_array('responsible_department','technology')
    end;

    insert into public.agent_os_recovery_items(
      queue_type, queue_item_id, case_registry_id, responsible_department_id,
      assigned_department_id, assigned_role, status, failure_count, last_error,
      diagnostics, is_material, notify_roles, technology_work_required
    ) values (
      p_queue_type, p_queue_item_id, v_case_registry_id, v_department_id,
      public.agent_os_department_id('technology'), 'Technology',
      'pending_technology_review', v_attempt, p_error_message,
      coalesce(p_diagnostics, '{}'::jsonb), p_is_material, v_notify_roles, true
    )
    on conflict (queue_type, queue_item_id) do update set
      failure_count = excluded.failure_count,
      last_error = excluded.last_error,
      diagnostics = public.agent_os_recovery_items.diagnostics || excluded.diagnostics,
      is_material = excluded.is_material,
      notify_roles = excluded.notify_roles,
      status = case
        when public.agent_os_recovery_items.status in ('restored','abandoned','cancelled')
          then 'pending_technology_review'
        else public.agent_os_recovery_items.status
      end,
      updated_at = p_occurred_at
    returning id into v_recovery_id;
  end if;

  return jsonb_build_object(
    'queue_type', p_queue_type,
    'queue_item_id', p_queue_item_id,
    'attempt_number', v_attempt,
    'outcome', v_outcome,
    'next_attempt_at', v_next_attempt_at,
    'recovery_item_id', v_recovery_id
  );
end;
$$;
