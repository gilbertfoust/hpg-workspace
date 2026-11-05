-- Canonical Communications magazine issues -> public HPG text editions.
-- Approved issues remain the source of truth. This bridge never exposes design
-- proofs, consent evidence, private media, source metadata or raw storage URLs.

alter table public.editorial_publications
  add column if not exists communications_publication_id uuid
    unique references public.communications_publications(id) on delete restrict;

alter table public.editorial_publications
  drop constraint if exists editorial_publications_exactly_one_editorial_source;
alter table public.editorial_publications
  add constraint editorial_publications_exactly_one_editorial_source
  check (num_nonnulls(editorial_item_id,communications_editorial_item_id,communications_publication_id)=1);

create or replace function public.get_communications_issue_preview(p_issue_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  issue public.communications_publications;
  articles jsonb;
begin
  if (select auth.uid()) is null or not (select public.is_communications_staff()) then
    raise exception 'Communications staff access required' using errcode='42501';
  end if;
  select * into issue from public.communications_publications where id=p_issue_id;
  if not found then raise exception 'Magazine issue not found' using errcode='P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title',v.headline,'summary',coalesce(v.dek,''),'body_markdown',v.body_markdown,
    'kind',case when e.content_type='interview' then 'interview' else 'article' end,
    'section',coalesce(p.section_name,''),'position',p.position,
    'editorial_item_id',e.id,'story_status',e.status
  ) order by p.position,p.id),'[]'::jsonb)
  into articles
  from public.communications_publication_items p
  join public.communications_editorial_items e on e.id=p.editorial_item_id
  join public.communications_content_versions v on v.editorial_item_id=e.id
    and v.version=e.current_version
  where p.publication_id=p_issue_id and e.status in ('scheduled','published')
    and v.status in ('editor_accepted','final');
  return jsonb_build_object(
    'issue_id',issue.id,'title',issue.title,'summary',coalesce(issue.theme,''),
    'status',issue.status,'planned_publish_at',issue.scheduled_at,
    'articles',articles,'internal_proof_only',true
  );
end;
$$;

-- Publication and its canonical distribution ledger are updated in one
-- transaction, with an exact-approval digest and frozen article text.
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
    select * into version from public.communications_content_versions
      where editorial_item_id=story.id and version=story.current_version for share;
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

create or replace function public.withdraw_communications_issue_native(p_issue_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare released public.editorial_publications;
begin
  if (select auth.uid()) is null or not (select public.is_communications_approver()) then
    raise exception 'Communications magazine publishing permission required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<10 then
    raise exception 'Document the withdrawal reason in at least ten characters' using errcode='23514';
  end if;
  update public.editorial_publications set
    is_live=false,withdrawn_at=now(),withdrawn_by=(select auth.uid())
  where communications_publication_id=p_issue_id and is_live=true
  returning * into released;
  if released.id is null then
    raise exception 'There is no live HPG magazine edition to withdraw' using errcode='P0002';
  end if;
  insert into public.communications_events(
    entity_type,entity_id,event_type,actor_user_id,event_metadata
  ) values(
    'publication',p_issue_id,'native_magazine_withdrawn',(select auth.uid()),
    jsonb_build_object('snapshot_id',released.id,'slug',released.slug,
      'reason',left(btrim(p_reason),500))
  );
  return true;
end;
$$;

revoke all on function public.get_communications_issue_preview(uuid) from public,anon;
revoke all on function public.publish_communications_issue_native(uuid,text) from public,anon;
revoke all on function public.withdraw_communications_issue_native(uuid,text) from public,anon;
grant execute on function public.get_communications_issue_preview(uuid) to authenticated;
grant execute on function public.publish_communications_issue_native(uuid,text) to authenticated;
grant execute on function public.withdraw_communications_issue_native(uuid,text) to authenticated;

comment on column public.editorial_publications.communications_publication_id is
  'Source canonical Communications issue ID, exactly one of three editorial publication sources.';
