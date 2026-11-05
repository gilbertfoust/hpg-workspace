-- Non-destructive private-media permissions verification.
do $$
declare bucket_private boolean;
begin
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='editorial_assets'
      and column_name='communications_editorial_item_id') then
    raise exception 'Canonical editorial asset relationship not installed';
  end if;
  select not b.public into bucket_private from storage.buckets b
    where b.id='communications-editorial-private';
  if bucket_private is distinct from true then
    raise exception 'Canonical Communications media bucket is not private';
  end if;
  if not coalesce((select c.relrowsecurity from pg_class c
    where c.oid='public.editorial_assets'::regclass),false) then
    raise exception 'Editorial asset metadata RLS must stay enabled';
  end if;
  if has_table_privilege('anon','public.editorial_assets','SELECT')
    or has_table_privilege('anon','public.editorial_assets','INSERT') then
    raise exception 'Anonymous readers can access private media metadata';
  end if;
  if has_column_privilege('authenticated','public.editorial_assets','rights_status','UPDATE')
    or has_column_privilege('authenticated','public.editorial_assets','reviewed_by','UPDATE') then
    raise exception 'Media reviewers could be bypassed through direct updates';
  end if;
  if not has_column_privilege('authenticated','public.editorial_assets','communications_editorial_item_id','INSERT') then
    raise exception 'Canonical communications staff cannot register media references';
  end if;
  if not exists(select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename='objects'
      and p.policyname='Communications members read canonical private media'
      and p.cmd='SELECT') then
    raise exception 'Private media object download policy missing';
  end if;
  if not exists(select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename='objects'
      and p.policyname='Communications members upload canonical private media'
      and p.cmd='INSERT') then
    raise exception 'Private media object upload policy missing';
  end if;
end $$;

do $$
begin
  perform public.review_editorial_asset(gen_random_uuid(),'cleared','');
  raise exception 'Unauthenticated media reviewer unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Signed-in editorial rights reviewer required%'
    then raise; end if;
end $$;

select 'canonical_editorial_media_security_passed' as result;
