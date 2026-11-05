-- Canonical Communications editorial release into the existing public text archive.
-- New publication snapshots are immutable to clients; original editor/fact-check
-- and final-release approvals remain authoritative and exact-package verified.
-- A published page contains only text. Signed URLs, consent evidence, sources,
-- and media binaries are not copied into the public snapshot.
alter table public.editorial_publications
  alter column editorial_item_id drop not null;
alter table public.editorial_publications
  add column if not exists communications_editorial_item_id uuid
    unique references public.communications_editorial_items(id) on delete restrict;
alter table public.editorial_publications
  add constraint editorial_publications_exactly_one_editorial_source
  check (num_nonnulls(editorial_item_id,communications_editorial_item_id)=1);

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
  select * into version from public.communications_content_versions
    where editorial_item_id=p_id and version=story.current_version for share;
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

create or replace function public.withdraw_communications_editorial_native(
  p_id uuid,p_reason text
) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare released public.editorial_publications;
begin
  if (select auth.uid()) is null or not (select public.is_communications_approver()) then
    raise exception 'Communications final publisher authorization required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<10 then
    raise exception 'An explanation of at least 10 characters is required' using errcode='23514';
  end if;
  update public.editorial_publications set
    is_live=false,withdrawn_at=now(),withdrawn_by=(select auth.uid())
    where communications_editorial_item_id=p_id and is_live=true
    returning * into released;
  if released.id is null then
    raise exception 'No live Communications public edition exists' using errcode='P0002';
  end if;
  insert into public.communications_events(
    entity_type,entity_id,event_type,actor_user_id,event_metadata
  ) values(
    'editorial_item',p_id,'native_publication_withdrawn',(select auth.uid()),
    jsonb_build_object('snapshot_id',released.id,'slug',released.slug,
      'reason',left(p_reason,500))
  );
  -- Preserve the canonical historical publication record and its audit trail.
  -- Public access is revoked at the snapshot layer; correction is a new workflow.
  return true;
end;
$$;

revoke all on function public.publish_communications_editorial_native(uuid,text) from public,anon,authenticated;
revoke all on function public.withdraw_communications_editorial_native(uuid,text) from public,anon,authenticated;
grant execute on function public.publish_communications_editorial_native(uuid,text) to authenticated;
grant execute on function public.withdraw_communications_editorial_native(uuid,text) to authenticated;

comment on column public.editorial_publications.communications_editorial_item_id
  is 'Source ID for an independently approved canonical Communications editorial item; mutually exclusive with legacy editorial_item_id.';
