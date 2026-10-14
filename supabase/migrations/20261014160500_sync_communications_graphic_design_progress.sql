CREATE OR REPLACE FUNCTION private.sync_communications_request_for_work_item(p_work_item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_work public.work_items%rowtype;
  v_request_id uuid;
  v_requester uuid;
  v_lead uuid;
  v_form_submission_id uuid;
  v_form_submitter uuid;
  v_payload jsonb := '{}'::jsonb;
  v_mapping jsonb := '{}'::jsonb;
  v_request_type text;
  v_audience text;
  v_brief text;
  v_channels text[] := '{}'::text[];
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
begin
  select * into v_work from public.work_items where id = p_work_item_id;
  if not found or v_work.deleted_at is not null or coalesce(v_work.source_system, '') = 'communications_hub' then
    return null;
  end if;

  if not (
    lower(coalesce(v_work.module, '')) = 'communications'
    or v_work.department_id = private.communications_department_id()
    or exists (
      select 1
      from public.form_submissions submission
      join public.form_templates template on template.id = submission.form_template_id
      where submission.work_item_id = v_work.id
        and (template.module::text = 'communications' or template.intake_module::text = 'communications')
    )
  ) then
    return null;
  end if;

  select unit.lead_user_id into v_lead
  from public.org_units unit
  where unit.id = private.communications_department_id();

  select submission.id, submission.submitted_by_user_id, submission.payload_json,
         coalesce(template.mapping_json, '{}'::jsonb)
  into v_form_submission_id, v_form_submitter, v_payload, v_mapping
  from public.form_submissions submission
  join public.form_templates template on template.id = submission.form_template_id
  where submission.work_item_id = v_work.id
  order by submission.submitted_at desc nulls last, submission.created_at desc, submission.id
  limit 1;

  select profile.id into v_requester
  from public.profiles profile
  where profile.id = coalesce(v_form_submitter, v_work.created_by_user_id, v_work.owner_user_id)
    and profile.is_approved
    and lower(trim(profile.approval_status)) = 'approved'
    and coalesce(profile.access_status, 'active') = 'active'
    and (
      profile.role in ('super_admin','admin_pm','department_lead','vp_communications')
      or profile.department_id is not null
      or exists (
        select 1 from public.department_memberships membership
        where membership.user_id = profile.id and membership.is_active
      )
    )
  limit 1;
  v_requester := coalesce(v_requester, v_lead);

  v_requester := coalesce(v_requester, v_lead);
  if v_requester is null then
    raise exception 'A human Communications lead is required before intake can be materialized.' using errcode = '23514';
  end if;

  v_request_type := coalesce(nullif(v_mapping#>>'{communications_request,request_type}', ''), case
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%newsletter%' then 'newsletter'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%press release%' then 'press_release'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%media advisory%' then 'media_advisory'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%grant%' then 'grant_narrative'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%memo%' then 'internal_communication'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%mission%history%organizational narrative%' then 'website_copy'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%story%' then 'impact_story'
    when lower(concat_ws(' ', v_work.type, v_work.title)) like '%media pitch%' then 'media_pitch'
    else 'other'
  end);
  if v_request_type not in (
    'journalism_story','magazine_feature','newsletter','press_release','media_advisory',
    'grant_narrative','internal_communication','website_copy','impact_story','media_pitch','other'
  ) then v_request_type := 'other'; end if;

  v_audience := nullif(trim(coalesce(
    v_payload->>'audience', v_payload->>'intended_audience',
    case when v_work.ngo_id is not null then 'HPG, the sponsored NGO, and approved external audiences' end,
    'HPG internal and partner stakeholders'
  )), '');
  v_brief := trim(coalesce(
    nullif(v_payload->>'brief', ''), nullif(v_payload->>'description', ''),
    nullif(v_work.description, ''), v_work.title
  ));
  if length(v_brief) < 10 then v_brief := concat('Communications support requested for ', v_work.title, '.'); end if;
  if v_request_type = 'newsletter' then v_channels := array['email']; end if;
  if lower(concat_ws(' ', v_work.type, v_work.title)) like '%social media%' then v_channels := array['social']; end if;

  select request.id into v_request_id
  from public.communications_requests request
  where request.source_work_item_id = v_work.id
  order by request.created_at, request.id
  limit 1;

  perform set_config('request.jwt.claim.sub', v_requester::text, true);
  if v_request_id is null then
    v_request_id := public.submit_communications_request(jsonb_build_object(
      'request_type', v_request_type,
      'title', left(v_work.title, 240),
      'brief', left(v_brief, 5000),
      'audience', v_audience,
      'channels', to_jsonb(v_channels),
      'priority', case lower(trim(v_work.priority)) when 'high' then 'high' when 'urgent' then 'urgent' when 'low' then 'low' else 'medium' end,
      'requested_due_at', case when v_work.due_date is null then null else (v_work.due_date::timestamp + time '17:00')::text end,
      'ngo_id', v_work.ngo_id,
      'source_work_item_id', v_work.id,
      'source_form_submission_id', v_form_submission_id,
      'source_system', coalesce(nullif(v_work.source_system, ''), case when v_form_submission_id is null then 'work_items' else 'forms' end),
      'source_reference', concat('work-item:', v_work.id::text, case when v_form_submission_id is null then '' else concat(';form-submission:', v_form_submission_id::text) end)
    ));
  end if;

  perform set_config('request.jwt.claim.sub', v_lead::text, true);
  perform set_config('hpg.communications_workflow_action', 'true', true);
  update public.communications_requests
  set request_type = v_request_type,
      title = left(v_work.title, 240),
      brief = left(v_brief, 5000),
      audience = v_audience,
      channels = v_channels,
      priority = case lower(trim(v_work.priority)) when 'high' then 'high' when 'urgent' then 'urgent' when 'low' then 'low' else 'medium' end,
      requested_due_at = case when v_work.due_date is null then null else v_work.due_date::timestamp + time '17:00' end,
      assigned_user_id = v_lead,
      ngo_id = coalesce(communications_requests.ngo_id, v_work.ngo_id),
      source_form_submission_id = coalesce(communications_requests.source_form_submission_id, v_form_submission_id),
      source_system = coalesce(nullif(v_work.source_system, ''), case when v_form_submission_id is null then 'work_items' else 'forms' end),
      source_reference = concat('work-item:', v_work.id::text, case when v_form_submission_id is null then '' else concat(';form-submission:', v_form_submission_id::text) end),
      status = case when v_work.type = 'Communications Graphic Design' and communications_requests.linked_entity_id is null then
        case lower(replace(v_work.status,'_',' '))
          when 'complete' then 'delivered'
          when 'completed' then 'delivered'
          when 'canceled' then 'canceled'
          when 'rejected' then 'canceled'
          when 'in progress' then 'in_production'
          when 'submitted' then 'in_production'
          when 'under review' then 'in_production'
          when 'approved' then 'in_production'
          else 'triaged' end
        when communications_requests.status = 'new' then 'triaged' else communications_requests.status end,
      delivered_at = case when v_work.type = 'Communications Graphic Design' and communications_requests.linked_entity_id is null then
        case when lower(v_work.status) in ('complete','completed') then coalesce(v_work.completed_at,communications_requests.delivered_at,now()) else null end
        else communications_requests.delivered_at end,
      triage_notes = coalesce(communications_requests.triage_notes, 'Automatically materialized from the authoritative departmental work item; human Communications acceptance remains required.'),
      updated_at = now()
  where id = v_request_id;
  perform set_config('hpg.communications_workflow_action', 'false', true);
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  return v_request_id;
end;
$function$
