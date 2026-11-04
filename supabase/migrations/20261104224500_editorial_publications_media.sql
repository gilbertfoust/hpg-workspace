-- Public publication snapshots and private, rights-reviewed editorial asset library.
-- Native public publication copies ONLY approved editorial text into a separate
-- explicitly public table. Interview consent, transcripts, drafts, audits and
-- private media remain inaccessible to public users.

create table if not exists public.editorial_publications (
  id uuid primary key default gen_random_uuid(),
  editorial_item_id uuid not null unique references public.editorial_items(id) on delete restrict,
  slug text not null unique check (length(slug) between 4 and 90 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('issue','article','interview','press_release','newsletter','research_brief')),
  title text not null,
  summary text not null default '',
  body_markdown text not null default '',
  contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(contributions) = 'array'),
  editorial_revision integer not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id) on delete restrict,
  is_live boolean not null default true,
  withdrawn_at timestamptz,
  withdrawn_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists editorial_publications_live_idx on public.editorial_publications(is_live,published_at desc);
alter table public.editorial_publications enable row level security;
revoke all on public.editorial_publications from public, anon, authenticated;
grant select on public.editorial_publications to anon, authenticated;
grant all on public.editorial_publications to service_role;

create policy "Only released editorial snapshots are publicly readable"
on public.editorial_publications for select to anon, authenticated
using (is_live = true);

-- This snapshot route deliberately includes no consent-document references,
-- private interviews/recordings, bylines beyond authored content, or assets.
create or replace function public.publish_editorial_native(p_id uuid, p_slug text)
returns public.editorial_publications
language plpgsql security definer set search_path = ''
as $$
declare
  item public.editorial_items;
  publication public.editorial_publications;
  issue_count integer;
  invalid_count integer;
  contribution_snapshot jsonb;
begin
  if (select auth.uid()) is null or not (select public.can_approve_editorial()) then
    raise exception 'Editorial publisher permission required';
  end if;
  if p_slug is null or length(p_slug) not between 4 and 90
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Publication URL slug must contain lowercase letters, numbers and hyphens';
  end if;
  select * into item from public.editorial_items where id=p_id for update;
  if not found or item.status <> 'approved' or item.approved_by is null then
    raise exception 'Editorial content requires independent approval before publication';
  end if;
  if item.kind = 'interview' and (not item.consent_confirmed or item.consent_document_id is null) then
    raise exception 'Interview publication requires documented consent';
  end if;
  if item.kind = 'issue' then
    select count(*) into issue_count from public.editorial_issue_items m where m.issue_id = item.id;
    if issue_count = 0 then raise exception 'A magazine issue requires contributions'; end if;
    select count(*) into invalid_count
    from public.editorial_issue_items m
    join public.editorial_items child on child.id=m.content_id
    where m.issue_id=item.id and (
      child.status not in ('approved','published')
      or (child.kind='interview' and (not child.consent_confirmed or child.consent_document_id is null))
    );
    if invalid_count > 0 then
      raise exception 'Each issue contribution must be approved, with interview consent recorded';
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'title', child.title, 'summary', child.summary,
        'body_markdown', child.body_markdown, 'kind', child.kind
      ) order by m.sort_order,m.created_at
    ),'[]'::jsonb) into contribution_snapshot
    from public.editorial_issue_items m
    join public.editorial_items child on child.id=m.content_id
    where m.issue_id=item.id;
  else
    contribution_snapshot := '[]'::jsonb;
  end if;

  insert into public.editorial_publications
    (editorial_item_id, slug, kind, title, summary, body_markdown,
     contributions, editorial_revision, published_by)
  values
    (item.id,p_slug,item.kind,item.title,item.summary,item.body_markdown,
     contribution_snapshot,item.revision,(select auth.uid()))
  returning * into publication;

  update public.editorial_items
    set status='published',published_at=publication.published_at
    where id=item.id;
  insert into public.editorial_events(editorial_item_id,actor_id,action,detail)
    values(item.id,(select auth.uid()),'native_publication_created',
      jsonb_build_object('slug',publication.slug,'snapshot_id',publication.id,'contribution_count',jsonb_array_length(publication.contributions)));
  return publication;
end;
$$;

create or replace function public.withdraw_editorial_native(p_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare result public.editorial_publications;
begin
  if (select auth.uid()) is null or not (select public.can_approve_editorial()) then
    raise exception 'Editorial publisher permission required';
  end if;
  if length(btrim(coalesce(p_reason,''))) < 10 then
    raise exception 'A withdrawal reason of at least 10 characters is required';
  end if;
  update public.editorial_publications
    set is_live=false, withdrawn_at=now(), withdrawn_by=(select auth.uid())
    where editorial_item_id=p_id and is_live=true
    returning * into result;
  if result.id is null then raise exception 'No live native publication exists'; end if;
  insert into public.editorial_events(editorial_item_id,actor_id,action,detail)
    values(p_id,(select auth.uid()),'native_publication_withdrawn',
      jsonb_build_object('reason',left(p_reason,500),'snapshot_id',result.id));
  return true;
end;
$$;

revoke all on function public.publish_editorial_native(uuid,text) from public, anon;
revoke all on function public.withdraw_editorial_native(uuid,text) from public, anon;
grant execute on function public.publish_editorial_native(uuid,text) to authenticated;
grant execute on function public.withdraw_editorial_native(uuid,text) to authenticated;

-- Private media library. No media file is made public by this migration.
-- Storage access is scoped to editorial roles; uploads use unique per-user paths.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('editorial-media-private','editorial-media-private',false,104857600,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf',
    'video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav'])
on conflict (id) do nothing;

create table if not exists public.editorial_assets (
  id uuid primary key default gen_random_uuid(),
  editorial_item_id uuid not null references public.editorial_items(id) on delete restrict,
  bucket_name text not null default 'editorial-media-private'
     check (bucket_name = 'editorial-media-private'),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  alt_text text not null default '',
  attribution text not null default '',
  license_type text not null default 'unknown'
    check (license_type in ('unknown','owned','licensed','permission','public_domain')),
  rights_document_id uuid references public.documents(id) on delete restrict,
  rights_status text not null default 'pending' check (rights_status in ('pending','cleared','rejected')),
  rights_note text not null default '',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editorial_assets_item_idx on public.editorial_assets(editorial_item_id,created_at desc);
alter table public.editorial_assets enable row level security;
revoke all on public.editorial_assets from public, anon, authenticated;
grant select on public.editorial_assets to authenticated;
grant insert (editorial_item_id,storage_path,file_name,content_type,file_size,alt_text,attribution,license_type,rights_document_id) on public.editorial_assets to authenticated;
grant update (alt_text,attribution,license_type,rights_document_id) on public.editorial_assets to authenticated;
grant all on public.editorial_assets to service_role;

create policy "Editorial members read private asset metadata"
on public.editorial_assets for select to authenticated
using ((select public.can_write_editorial()));

create policy "Editorial members register their own uploads"
on public.editorial_assets for insert to authenticated
with check (
  (select public.can_write_editorial())
  and uploaded_by = (select auth.uid())
  and bucket_name = 'editorial-media-private'
  and split_part(storage_path,'/',1) = (select auth.uid())::text
  and rights_status = 'pending'
  and reviewed_at is null and reviewed_by is null
);

create policy "Editorial members annotate pending media"
on public.editorial_assets for update to authenticated
using ((select public.can_write_editorial()) and rights_status='pending')
with check ((select public.can_write_editorial()) and rights_status='pending');

create policy "Editorial staff view private media objects"
on storage.objects for select to authenticated
using (bucket_id='editorial-media-private' and (select public.can_write_editorial()));

create policy "Editorial staff upload under their own folder"
on storage.objects for insert to authenticated
with check (bucket_id='editorial-media-private'
  and (select public.can_write_editorial())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Uploader can clean up unreviewed media"
on storage.objects for delete to authenticated
using (bucket_id='editorial-media-private'
 and (select public.can_write_editorial())
 and (storage.foldername(name))[1] = (select auth.uid())::text
 and not exists (select 1 from public.editorial_assets a
   where a.storage_path=storage.objects.name and a.rights_status='cleared')
);

-- Rights review is explicitly controlled by a second reviewer.
create or replace function public.review_editorial_asset(p_id uuid, p_decision text, p_note text default '')
returns public.editorial_assets language plpgsql security definer set search_path = ''
as $$
declare asset public.editorial_assets;
begin
  if (select auth.uid()) is null or not (select public.can_approve_editorial()) then
    raise exception 'Editorial asset reviewer permission required';
  end if;
  if p_decision not in ('cleared','rejected') then raise exception 'Invalid media rights decision'; end if;
  select * into asset from public.editorial_assets where id=p_id for update;
  if not found or asset.rights_status <> 'pending' then
    raise exception 'Media asset is not awaiting rights review';
  end if;
  if asset.uploaded_by=(select auth.uid()) then
    raise exception 'An independent reviewer must clear the uploader''s media';
  end if;
  if p_decision='cleared' then
    if asset.license_type='unknown' then raise exception 'Specify a verifiable rights basis'; end if;
    if asset.license_type in ('licensed','permission') and asset.rights_document_id is null then
      raise exception 'Permission or license documentation is required';
    end if;
    if asset.content_type like 'image/%' and length(btrim(asset.alt_text))=0 then
      raise exception 'Accessible image alternative text is required';
    end if;
    if length(btrim(asset.attribution))=0 then
      raise exception 'Provide creator or source attribution';
    end if;
  elsif length(btrim(coalesce(p_note,'')))<5 then
    raise exception 'Explain the rights rejection';
  end if;
  update public.editorial_assets
    set rights_status=p_decision,rights_note=left(coalesce(p_note,''),1000),
        reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
    where id=p_id returning * into asset;
  insert into public.editorial_events(editorial_item_id,actor_id,action,detail)
    values(asset.editorial_item_id,(select auth.uid()),'media_rights_'||p_decision,
      jsonb_build_object('asset_id',asset.id,'note',left(coalesce(p_note,''),1000)));
  return asset;
end;
$$;

revoke all on function public.review_editorial_asset(uuid,text,text) from public, anon;
grant execute on function public.review_editorial_asset(uuid,text,text) to authenticated;

comment on table public.editorial_publications is 'Deliberately public text-only snapshots of approved editorial content. No interview consent documents or private media.';
comment on table public.editorial_assets is 'Private editorial media evidence; rights clearance does not itself publish the binary object.';
