-- Attach private media to canonical Communications stories without copying files
-- into a second content system or making any object publicly readable.
-- Standalone editorial media remains in its original private bucket.

alter table public.editorial_assets
  alter column editorial_item_id drop not null;
alter table public.editorial_assets
  add column if not exists communications_editorial_item_id uuid
    references public.communications_editorial_items(id) on delete restrict;

alter table public.editorial_assets
  drop constraint if exists editorial_assets_bucket_name_check;
alter table public.editorial_assets
  add constraint editorial_assets_source_bucket_consistency
  check (
    (editorial_item_id is not null and communications_editorial_item_id is null
      and bucket_name='editorial-media-private')
    or
    (communications_editorial_item_id is not null and editorial_item_id is null
      and bucket_name='communications-editorial-private')
  );
create index if not exists editorial_assets_canonical_story_idx
  on public.editorial_assets(communications_editorial_item_id,created_at desc);

-- An independent private bucket separates original Communications media from
-- standalone production assets. It cannot serve public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('communications-editorial-private','communications-editorial-private',false,104857600,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf',
    'video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav'])
on conflict(id) do nothing;

revoke insert on public.editorial_assets from authenticated;
grant insert(
  editorial_item_id,communications_editorial_item_id,bucket_name,storage_path,
  file_name,content_type,file_size,alt_text,attribution,license_type,rights_document_id
) on public.editorial_assets to authenticated;

drop policy if exists "Editorial members read private asset metadata" on public.editorial_assets;
drop policy if exists "Editorial members register their own uploads" on public.editorial_assets;
drop policy if exists "Editorial members annotate pending media" on public.editorial_assets;

create policy "Scoped editorial members read private asset metadata"
on public.editorial_assets for select to authenticated
using (
  (editorial_item_id is not null and (select public.can_write_editorial()))
  or
  (communications_editorial_item_id is not null and (select public.is_communications_staff()))
);

create policy "Scoped editorial members register own private uploads"
on public.editorial_assets for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and split_part(storage_path,'/',1)=(select auth.uid())::text
  and rights_status='pending' and reviewed_by is null and reviewed_at is null
  and (
    (editorial_item_id is not null and communications_editorial_item_id is null
      and bucket_name='editorial-media-private' and (select public.can_write_editorial()))
    or
    (communications_editorial_item_id is not null and editorial_item_id is null
      and bucket_name='communications-editorial-private' and (select public.is_communications_staff()))
  )
);

create policy "Scoped editorial members annotate pending private media"
on public.editorial_assets for update to authenticated
using (
  rights_status='pending' and (
    (editorial_item_id is not null and (select public.can_write_editorial()))
    or (communications_editorial_item_id is not null and (select public.is_communications_staff()))
  )
)
with check (
  rights_status='pending' and (
    (editorial_item_id is not null and (select public.can_write_editorial()))
    or (communications_editorial_item_id is not null and (select public.is_communications_staff()))
  )
);

create policy "Communications members read canonical private media"
on storage.objects for select to authenticated
using(
  bucket_id='communications-editorial-private'
  and (select public.is_communications_staff())
);

create policy "Communications members upload canonical private media"
on storage.objects for insert to authenticated
with check (
  bucket_id='communications-editorial-private'
  and (select public.is_communications_staff())
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy "Uploader may clean up unreviewed canonical private media"
on storage.objects for delete to authenticated
using (
  bucket_id='communications-editorial-private'
  and (select public.is_communications_staff())
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (
    select 1 from public.editorial_assets asset
    where asset.bucket_name='communications-editorial-private'
      and asset.storage_path=storage.objects.name and asset.rights_status='cleared'
  )
);

-- Route rights decisions to the *correct* editorial authority and audit ledger.
create or replace function public.review_editorial_asset(
  p_id uuid,p_decision text,p_note text default ''
)
returns public.editorial_assets
language plpgsql security definer set search_path = ''
as $$
declare asset public.editorial_assets;
begin
  if (select auth.uid()) is null then
    raise exception 'Signed-in editorial rights reviewer required' using errcode='42501';
  end if;
  if p_decision not in ('cleared','rejected') then
    raise exception 'Invalid media-rights decision' using errcode='22023';
  end if;
  select * into asset from public.editorial_assets where id=p_id for update;
  if not found or asset.rights_status <> 'pending' then
    raise exception 'Media asset is not awaiting rights review' using errcode='23514';
  end if;
  if (
    (asset.communications_editorial_item_id is not null and not (select public.is_communications_approver()))
    or (asset.editorial_item_id is not null and not (select public.can_approve_editorial()))
  ) then
    raise exception 'Independent department rights reviewer permission required' using errcode='42501';
  end if;
  if asset.uploaded_by=(select auth.uid()) then
    raise exception 'The uploader cannot approve their own media rights' using errcode='42501';
  end if;
  if p_decision='cleared' then
    if asset.license_type='unknown' then
      raise exception 'Document a verifiable legal rights basis' using errcode='23514';
    end if;
    if asset.license_type in ('licensed','permission') and asset.rights_document_id is null then
      raise exception 'Licensed or permitted use requires supporting document evidence' using errcode='23514';
    end if;
    if asset.content_type like 'image/%' and length(btrim(asset.alt_text))=0 then
      raise exception 'Alt text is required for accessible image publication' using errcode='23514';
    end if;
    if length(btrim(asset.attribution))=0 then
      raise exception 'Creator and source attribution are required' using errcode='23514';
    end if;
  elsif length(btrim(coalesce(p_note,'')))<5 then
    raise exception 'A rights rejection must be explained' using errcode='23514';
  end if;

  update public.editorial_assets set
    rights_status=p_decision,rights_note=left(coalesce(p_note,''),1000),
    reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
  where id=p_id returning * into asset;

  if asset.communications_editorial_item_id is not null then
    insert into public.communications_events(
      entity_type,entity_id,event_type,actor_user_id,event_metadata
    ) values (
      'editorial_item',asset.communications_editorial_item_id,
      'private_media_rights_'||p_decision,(select auth.uid()),
      jsonb_build_object('asset_id',asset.id,'source','canonical_communications',
        'note',left(coalesce(p_note,''),1000))
    );
  else
    insert into public.editorial_events(
      editorial_item_id,actor_id,action,detail
    ) values (
      asset.editorial_item_id,(select auth.uid()),'media_rights_'||p_decision,
      jsonb_build_object('asset_id',asset.id,'note',left(coalesce(p_note,''),1000))
    );
  end if;
  return asset;
end;
$$;

revoke all on function public.review_editorial_asset(uuid,text,text) from public,anon;
grant execute on function public.review_editorial_asset(uuid,text,text) to authenticated;

comment on column public.editorial_assets.communications_editorial_item_id is
 'A private asset may belong to an original Communications story OR standalone editorial draft, never both.';
