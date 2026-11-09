-- Preserve the existing RPC signatures, grants and workflow guards while
-- removing the ambiguous column references identified by the release lint.

CREATE OR REPLACE FUNCTION public.void_transaction(
  _transaction_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
  reason_for_void text;
BEGIN
  SELECT * INTO txn FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT public.can_post_ngo_transaction(txn.ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to void transactions for this NGO';
  END IF;

  IF txn.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted transactions can be voided. Current status: %', txn.status;
  END IF;

  reason_for_void := COALESCE(NULLIF(trim(_reason), ''), 'Voided by user');

  UPDATE public.transactions
  SET status = 'voided',
      is_void = true,
      voided_at = now(),
      voided_by_user_id = auth.uid(),
      void_reason = reason_for_void,
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO txn;

  PERFORM public.log_transaction_audit(
    txn.id,
    'voided',
    jsonb_build_object('transaction_number', txn.transaction_number),
    reason_for_void
  );

  RETURN txn;
END;
$$;

-- Retain the two-argument HPG entry point and use the current scoped
-- generator, including its authorization and locked-package handling.
CREATE OR REPLACE FUNCTION public.generate_finance_year_end_package(
  _fiscal_year integer,
  _label text DEFAULT NULL
)
RETURNS public.finance_year_end_packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.generate_finance_year_end_package(_fiscal_year, NULL::uuid, _label);
END;
$$;

create or replace function public.publish_communications_editorial_native(
  p_id uuid, p_slug text
) returns public.editorial_publications
language plpgsql security definer
set search_path = ''
as $$
declare
  story public.communications_editorial_items;
  version public.communications_content_versions;
  released public.editorial_publications;
  digest text;
  target_url text;
  published_kind text;
begin
  if (select auth.uid()) is null or not (select public.is_communications_approver()) then
    raise exception 'Communications final publisher authorization required' using errcode='42501';
  end if;
  if p_slug is null or length(p_slug) not between 4 and 90
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Choose a lowercase public URL name of 4 to 90 characters' using errcode='23514';
  end if;
  select * into story from public.communications_editorial_items
    where id=p_id for update;
  if not found or story.status <> 'scheduled' then
    raise exception 'Only an independently approved scheduled Communications story can be released' using errcode='23514';
  end if;
  if story.scheduled_at is null or story.scheduled_at>now()
      or (story.embargo_until is not null and story.embargo_until>now()) then
    raise exception 'Scheduled publication time and embargo must have passed' using errcode='23514';
  end if;
  if story.current_version < 1 then
    raise exception 'A submitted and reviewed editorial version is required' using errcode='23514';
  end if;
  select content_version.* into version from public.communications_content_versions content_version
    where content_version.editorial_item_id=p_id
      and content_version.version=story.current_version for share;
  if not found or version.status not in ('editor_accepted','final')
    or length(btrim(version.body_markdown))<20 then
    raise exception 'The current editorial text has not passed independent review' using errcode='23514';
  end if;
  -- Prevent the private media library and signed file URLs from leaking via
  -- pasted Markdown. Human review must also check names and sensitive details.
  if concat_ws(' ',version.headline,version.dek,version.body_markdown,story.pitch_summary) ~* '(editorial-media-private|/storage/v1/object/sign/)' then
    raise exception 'Remove private storage links from text before publishing' using errcode='23514';
  end if;
  -- Freeze evidence rows during the final authorization/release transaction.
  perform 1 from public.communications_sources where editorial_item_id=p_id for share;
  perform 1 from public.communications_rights_consents where editorial_item_id=p_id for share;
  perform 1 from public.communications_fact_checks where editorial_item_id=p_id for share;
  if exists(
    select 1 from public.communications_fact_checks fact
    where fact.editorial_item_id=p_id and fact.result in ('pending','disputed')
  ) then
    raise exception 'Resolve disputed or pending factual claims before publication' using errcode='23514';
  end if;
  if exists(
    select 1 from public.communications_rights_consents rights
    where rights.editorial_item_id=p_id
      and (rights.status not in ('granted','not_required')
        or (rights.status='granted' and (
          rights.evidence_url is null
          or rights.evidence_url !~* '^https://[^[:space:]]+$'
          or (rights.expires_at is not null and rights.expires_at<=now())
        )))
  ) then
    raise exception 'Each required consent must have valid, current HTTPS evidence' using errcode='23514';
  end if;
  if story.content_type in ('interview','impact_story') and not exists(
    select 1 from public.communications_rights_consents rights
    where rights.editorial_item_id=p_id
      and rights.consent_type in ('interview','beneficiary_story','quotation')
      and rights.status='granted'
      and rights.evidence_url ~* '^https://[^[:space:]]+$'
      and (rights.expires_at is null or rights.expires_at>now())
  ) then
    raise exception 'Interviews and impact stories require documented, active consent' using errcode='23514';
  end if;
  digest := private.communications_subject_digest('editorial_item',p_id);
  if not private.has_current_communications_approval(
    'editorial_item',p_id,'editorial',story.workflow_cycle,story.current_version,digest
  ) or not private.has_current_communications_approval(
    'editorial_item',p_id,'fact_check',story.workflow_cycle,story.current_version,digest
  ) or not (
    private.has_current_communications_approval(
      'editorial_item',p_id,'publication',story.workflow_cycle,story.current_version,digest
    ) or private.has_current_communications_approval(
      'editorial_item',p_id,'executive',story.workflow_cycle,story.current_version,digest
    )
  ) then
    raise exception 'Fresh independent editor, fact-check and publication approvals are required' using errcode='23514';
  end if;
  if story.sensitivity in ('privacy','safeguarding','legal') and not
    private.has_current_communications_approval(
      'editorial_item',p_id,'legal',story.workflow_cycle,story.current_version,digest
    ) then
    raise exception 'Sensitive material requires current Legal approval' using errcode='23514';
  end if;
  if exists(select 1 from public.editorial_publications
    where communications_editorial_item_id=p_id) then
    raise exception 'A snapshot already exists; use the correction workflow rather than silently replacing published text'
    using errcode='23514';
  end if;

  target_url := 'https://gilbertfoust.github.io/hpg-workspace/publications/'||p_slug;
  published_kind := case story.content_type
    when 'interview' then 'interview'
    when 'press_release' then 'press_release'
    when 'newsletter_story' then 'newsletter'
    else 'article' end;

  insert into public.editorial_publications (
    communications_editorial_item_id,slug,kind,title,summary,body_markdown,
    contributions,editorial_revision,published_by
  ) values (
    p_id,p_slug,published_kind,version.headline,
    coalesce(version.dek,story.pitch_summary,''),version.body_markdown,
    '[]'::jsonb,story.current_version,(select auth.uid())
  ) returning * into released;

  -- The original state machine verifies publication evidence and fresh approvals.
  perform public.record_communications_release(
    'communications_editorial',p_id,'publish',released.published_at,
    target_url,target_url,'hpg_publications','Approved HPG web edition released'
  );
  insert into public.communications_events(
    entity_type,entity_id,event_type,actor_user_id,from_status,to_status,event_metadata
  ) values (
    'editorial_item',p_id,'native_publication_created',(select auth.uid()),
    'scheduled','published',jsonb_build_object(
      'slug',p_slug,'snapshot_id',released.id,'editorial_version',story.current_version,
      'publication_url',target_url
    )
  );
  return released;
end;
$$;

create or replace function public.publish_communications_issue_native(p_issue_id uuid,p_slug text)
returns public.editorial_publications
language plpgsql security definer set search_path = ''
as $$
declare
  issue public.communications_publications;
  placement record;
  story public.communications_editorial_items;
  version public.communications_content_versions;
  released public.editorial_publications;
  articles jsonb := '[]'::jsonb;
  issue_digest text;
  story_digest text;
  release_url text;
  items_count integer := 0;
begin
  if (select auth.uid()) is null or not (select public.is_communications_approver()) then
    raise exception 'Communications magazine publishing permission required' using errcode='42501';
  end if;
  if p_slug is null or length(p_slug) not between 4 and 90
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Use a unique lowercase publication URL name (4-90 characters)' using errcode='23514';
  end if;
  select * into issue from public.communications_publications
    where id=p_issue_id for update;
  if not found or issue.publication_type <> 'magazine_issue'
      or issue.status <> 'scheduled' then
    raise exception 'Only scheduled, approved magazine issues can be published' using errcode='23514';
  end if;
  if issue.scheduled_at is null or issue.scheduled_at > now() then
    raise exception 'Wait until the approved magazine release time' using errcode='23514';
  end if;
  if issue.design_proof_url is null
    or issue.design_proof_url !~* '^https://[^[:space:]]+$' then
    raise exception 'A reviewed HTTPS magazine design proof is required' using errcode='23514';
  end if;
  if exists(select 1 from public.editorial_publications
    where communications_publication_id=p_issue_id) then
    raise exception 'Issue already has a public snapshot. Use the correction process rather than overwriting its history' using errcode='23514';
  end if;

  -- Lock all placements so the release cannot race with assembly changes.
  perform 1 from public.communications_publication_items p
    where p.publication_id=p_issue_id for share;

  issue_digest := private.communications_subject_digest('publication',p_issue_id);
  if not private.has_current_communications_approval(
        'publication',p_issue_id,'publication',issue.workflow_cycle,null,issue_digest
      ) or not private.has_current_communications_approval(
        'publication',p_issue_id,'distribution',issue.workflow_cycle,null,issue_digest
      ) then
    raise exception 'Fresh independent publication and distribution approvals are required for this issue' using errcode='23514';
  end if;

  for placement in
    select p.editorial_item_id,p.section_name,p.position
    from public.communications_publication_items p
    where p.publication_id=p_issue_id
    order by p.position,p.id
  loop
    select * into story from public.communications_editorial_items
      where id=placement.editorial_item_id for share;
    if not found or story.status not in ('scheduled','published')
      or (story.embargo_until is not null and story.embargo_until>now())
      or (story.scheduled_at is not null and story.scheduled_at>now()) then
      raise exception 'Every magazine story must be approved and free of an active embargo' using errcode='23514';
    end if;
    select content_version.* into version from public.communications_content_versions content_version
      where content_version.editorial_item_id=story.id
        and content_version.version=story.current_version for share;
    if not found or version.status not in ('editor_accepted','final')
      or length(btrim(version.body_markdown))<20 then
      raise exception 'An approved and complete version is required for every placed story' using errcode='23514';
    end if;
    if concat_ws(' ',version.headline,version.dek,version.body_markdown,story.pitch_summary)
       ~* '(editorial-media-private|communications-media-private|/storage/v1/object/sign/)' then
      raise exception 'Remove private storage links from approved magazine text' using errcode='23514';
    end if;

    perform 1 from public.communications_sources where editorial_item_id=story.id for share;
    perform 1 from public.communications_rights_consents where editorial_item_id=story.id for share;
    perform 1 from public.communications_fact_checks where editorial_item_id=story.id for share;
    if exists(select 1 from public.communications_fact_checks
      where editorial_item_id=story.id and result in ('pending','disputed')) then
      raise exception 'Unresolved claims block release of magazine content' using errcode='23514';
    end if;
    if exists(select 1 from public.communications_rights_consents rights
       where rights.editorial_item_id=story.id and (
         rights.status not in ('granted','not_required')
         or (rights.status='granted' and (
           rights.evidence_url is null
           or rights.evidence_url !~* '^https://[^[:space:]]+$'
           or (rights.expires_at is not null and rights.expires_at<=now())
         ))
       )) then
      raise exception 'Every placed story requires current consent and rights evidence' using errcode='23514';
    end if;
    if story.content_type in ('interview','impact_story')
      and not exists(select 1 from public.communications_rights_consents rights
        where rights.editorial_item_id=story.id and rights.status='granted'
          and rights.consent_type in ('interview','beneficiary_story','quotation')
          and rights.evidence_url ~* '^https://[^[:space:]]+$'
          and (rights.expires_at is null or rights.expires_at>now())) then
      raise exception 'Interviews and impact stories must have documented, active permission' using errcode='23514';
    end if;
    story_digest := private.communications_subject_digest('editorial_item',story.id);
    if not private.has_current_communications_approval(
         'editorial_item',story.id,'editorial',story.workflow_cycle,story.current_version,story_digest)
      or not private.has_current_communications_approval(
         'editorial_item',story.id,'fact_check',story.workflow_cycle,story.current_version,story_digest)
      or not (
        private.has_current_communications_approval(
          'editorial_item',story.id,'publication',story.workflow_cycle,story.current_version,story_digest)
        or private.has_current_communications_approval(
          'editorial_item',story.id,'executive',story.workflow_cycle,story.current_version,story_digest)
      ) then
      raise exception 'A placed story lacks current editor, fact-check or publication approval' using errcode='23514';
    end if;
    if story.sensitivity in ('privacy','safeguarding','legal')
      and not private.has_current_communications_approval(
        'editorial_item',story.id,'legal',story.workflow_cycle,story.current_version,story_digest) then
      raise exception 'Sensitive magazine stories require current Legal approval' using errcode='23514';
    end if;

    articles := articles || jsonb_build_array(jsonb_build_object(
      'title',version.headline,'summary',coalesce(version.dek,''),
      'body_markdown',version.body_markdown,
      'kind',case when story.content_type='interview' then 'interview' else 'article' end,
      'section',coalesce(placement.section_name,''),'position',placement.position
    ));
    items_count := items_count + 1;
  end loop;

  if items_count = 0 then
    raise exception 'Magazine issue must have at least one independently approved story' using errcode='23514';
  end if;

  release_url := 'https://gilbertfoust.github.io/hpg-workspace/publications/'||p_slug;
  insert into public.editorial_publications(
    communications_publication_id,slug,kind,title,summary,body_markdown,
    contributions,editorial_revision,published_at,published_by
  ) values(
    p_issue_id,p_slug,'issue',issue.title,coalesce(issue.theme,''),
    '',articles,issue.workflow_cycle,now(),(select auth.uid())
  ) returning * into released;

  -- Preserve the canonical distribution status, date, and audit evidence.
  perform public.record_communications_release(
    'communications_publications',p_issue_id,'distribute',released.published_at,
    release_url,release_url,'hpg_publications','Authorized HPG magazine text edition release'
  );
  insert into public.communications_events(
    entity_type,entity_id,event_type,actor_user_id,from_status,to_status,event_metadata
  ) values(
    'publication',p_issue_id,'native_magazine_published',(select auth.uid()),
    'scheduled','distributed',jsonb_build_object(
       'snapshot_id',released.id,'slug',p_slug,'issue_cycle',issue.workflow_cycle,
       'contributions',items_count,'public_url',release_url)
  );
  return released;
end;
$$;

CREATE OR REPLACE FUNCTION public.finance_ensure_fiscal_calendar(
  _ngo_id uuid,
  _fiscal_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_start date;
BEGIN
  IF _fiscal_year < 1900 OR _fiscal_year > 2200 THEN
    RAISE EXCEPTION 'Fiscal year is outside the supported range';
  END IF;

  IF _ngo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  FOR month_number IN 1..12 LOOP
    period_start := make_date(_fiscal_year, month_number, 1);
    INSERT INTO public.finance_fiscal_periods (
      ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
    ) VALUES (
      _ngo_id,
      to_char(period_start, 'Mon YYYY'),
      _fiscal_year,
      month_number,
      'month',
      period_start,
      (period_start + interval '1 month - 1 day')::date,
      'open'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  FOR quarter_number IN 1..4 LOOP
    period_start := make_date(_fiscal_year, ((quarter_number - 1) * 3) + 1, 1);
    INSERT INTO public.finance_fiscal_periods (
      ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
    ) VALUES (
      _ngo_id,
      'Q' || quarter_number || ' ' || _fiscal_year,
      _fiscal_year,
      quarter_number,
      'quarter',
      period_start,
      (period_start + interval '3 months - 1 day')::date,
      'open'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.finance_fiscal_periods (
    ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
  ) VALUES (
    _ngo_id,
    'FY' || _fiscal_year,
    _fiscal_year,
    1,
    'year',
    make_date(_fiscal_year, 1, 1),
    make_date(_fiscal_year, 12, 31),
    'open'
  ) ON CONFLICT DO NOTHING;
END;
$$;

create or replace function private.sync_academy_user_paths(p_user uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare person record;rule record;added integer:=0;elig boolean;matched_ids text[]:=array[]::text[];
begin
  select p.*,coalesce(o.department_name,'') department_name into person
  from public.profiles p left join public.org_units o on o.id=p.department_id
  where p.id=p_user;
  if not found then return 0; end if;
  elig:= person.is_approved and lower(trim(coalesce(person.approval_status,'')))='approved'
    and person.access_status='active'
    and person.role in(
      'super_admin','admin_pm','vp_operations','vp_programs','vp_development',
      'vp_finance','vp_communications','department_lead','ngo_coordinator',
      'executive_secretariat','staff','staff_member','viewer','board'
    );
  if not elig then
    update public.academy_course_assignments
    set status='paused',changed_at=now()
    where user_id=p_user and status='assigned';
    return 0;
  end if;
  for rule in select * from public.academy_pathway_rules
    where active order by sequence,track_id loop
    if rule.common_to_all or person.role=any(rule.profile_roles)
      or exists(select 1 from unnest(rule.departments) d
        where lower(person.department_name) like '%'||lower(d)||'%')
      or exists(select 1 from unnest(rule.job_keywords) k
        where lower(coalesce(person.job_title,'')) like '%'||lower(k)||'%')
    then
      matched_ids:=array_append(matched_ids,rule.track_id);
      insert into public.academy_course_assignments
        (user_id,track_id,source,status,required,due_at)
      values(p_user,rule.track_id,'automatic','assigned',true,
        case when rule.deadline_days is null then null
          else now()+make_interval(days=>rule.deadline_days) end)
      on conflict(user_id,track_id) do update
      set status='assigned',required=true,changed_at=now()
      where public.academy_course_assignments.source='automatic'
        and public.academy_course_assignments.status<>'assigned';
      added:=added+1;
    end if;
  end loop;
  update public.academy_course_assignments a set status='removed',changed_at=now()
  where a.user_id=p_user and a.source='automatic' and a.status='assigned'
    and not (a.track_id=any(matched_ids));
  return added;
end;
$$;

create or replace function public.admin_upsert_form_template(
  p_template_id uuid,
  p_name text,
  p_module public.module_type,
  p_description text,
  p_schema_json jsonb,
  p_mapping_json jsonb default '{}'::jsonb,
  p_form_audience text default 'staff',
  p_intake_module public.module_type default 'ngo_coordination',
  p_is_active boolean default true
)
returns public.form_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.form_templates;
  field_row jsonb;
  field_name text;
  field_type text;
  seen_names text[] := array[]::text[];
  next_version integer;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Administrator access required';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Form name is required'; end if;
  if p_form_audience not in ('staff','ngo_portal') then
    raise exception 'Invalid form audience';
  end if;
  if jsonb_typeof(p_schema_json) <> 'object'
     or jsonb_typeof(coalesce(p_schema_json->'fields','[]'::jsonb)) <> 'array' then
    raise exception 'Form schema must contain a fields array';
  end if;

  for field_row in select value from jsonb_array_elements(coalesce(p_schema_json->'fields','[]'::jsonb))
  loop
    field_name := nullif(trim(field_row->>'name'), '');
    field_type := lower(coalesce(field_row->>'type', ''));
    if field_name is null or nullif(trim(field_row->>'label'), '') is null then
      raise exception 'Every field needs a name and label';
    end if;
    if field_name = any(seen_names) then raise exception 'Duplicate field name: %', field_name; end if;
    if field_type not in ('text','textarea','email','tel','url','number','date','select','multiselect','checkbox','file') then
      raise exception 'Unsupported field type: %', field_type;
    end if;
    if field_type in ('select','multiselect')
       and jsonb_array_length(coalesce(field_row->'options','[]'::jsonb)) = 0 then
      raise exception 'Field % requires at least one option', field_name;
    end if;
    seen_names := array_append(seen_names, field_name);
  end loop;

  if p_template_id is null then
    insert into public.form_templates(
      name, module, description, schema_json, mapping_json, version, is_active,
      created_by_user_id, form_audience, intake_module, portal_visible
    ) values (
      trim(p_name), p_module, nullif(trim(p_description), ''), p_schema_json,
      coalesce(p_mapping_json,'{}'::jsonb), 1, coalesce(p_is_active,true),
      auth.uid(), p_form_audience, p_intake_module,
      p_form_audience = 'ngo_portal'
    ) returning * into row_out;
  else
    select coalesce(version,0) + 1 into next_version
    from public.form_templates where id = p_template_id for update;
    if next_version is null then raise exception 'Form template not found'; end if;

    update public.form_templates
    set name = trim(p_name), module = p_module,
        description = nullif(trim(p_description), ''),
        schema_json = p_schema_json,
        mapping_json = coalesce(p_mapping_json,'{}'::jsonb),
        version = next_version,
        is_active = coalesce(p_is_active,true),
        form_audience = p_form_audience,
        intake_module = p_intake_module,
        portal_visible = p_form_audience = 'ngo_portal',
        updated_at = now()
    where id = p_template_id
    returning * into row_out;
  end if;

  insert into public.form_template_versions(
    form_template_id, version, name, module, description, schema_json,
    mapping_json, form_audience, intake_module, is_active, published_by_user_id
  ) values (
    row_out.id, coalesce(row_out.version,1), row_out.name, row_out.module,
    row_out.description, row_out.schema_json, coalesce(row_out.mapping_json,'{}'::jsonb),
    row_out.form_audience, row_out.intake_module, coalesce(row_out.is_active,true), auth.uid()
  ) on conflict (form_template_id, version) do nothing;

  insert into public.audit_log(actor_user_id, action_type, entity_type, entity_id, reason, after_json)
  values (
    auth.uid(), case when p_template_id is null then 'create' else 'publish_version' end,
    'form_template', row_out.id, 'HPG governed form template saved',
    jsonb_build_object('version', row_out.version, 'module', row_out.module, 'audience', row_out.form_audience)
  );

  return row_out;
end;
$$;
