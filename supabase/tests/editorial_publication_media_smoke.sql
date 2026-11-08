-- Execute on disposable DB after migration replay; do not create production editions.
do $$
declare t text;
begin
  foreach t in array array['editorial_publications','editorial_assets'] loop
    if not coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t),false) then
      raise exception 'RLS must be enabled for %',t;
    end if;
  end loop;

  if has_table_privilege('anon','public.editorial_assets','SELECT') then
    raise exception 'Private media metadata is exposed to anonymous readers';
  end if;
  if not has_table_privilege('anon','public.editorial_publications','SELECT') then
    raise exception 'Public editions are not readable';
  end if;
  if has_table_privilege('anon','public.editorial_publications','INSERT') or
     has_table_privilege('authenticated','public.editorial_publications','INSERT') then
    raise exception 'A direct public publication insert is allowed';
  end if;
  if has_table_privilege('authenticated','public.editorial_assets','DELETE') then
    raise exception 'Editorial media records can be deleted directly';
  end if;
  if has_column_privilege('authenticated','public.editorial_assets','rights_status','UPDATE') then
    raise exception 'Rights clearance cannot be client-editable';
  end if;
  if has_function_privilege('anon','public.publish_editorial_native(uuid,text)','EXECUTE') or
     has_function_privilege('anon','public.withdraw_editorial_native(uuid,text)','EXECUTE') then
    raise exception 'Anonymous publishing or withdrawing is permitted';
  end if;
  if (select b.public from storage.buckets b where b.id='editorial-media-private') is distinct from false then
    raise exception 'Editorial media bucket must stay private';
  end if;
end $$;

do $$
begin
  perform public.publish_editorial_native(gen_random_uuid(),'unauthorized-example');
  raise exception 'An anonymous publisher unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Editorial publisher permission required%' then raise; end if;
end $$;

do $$
begin
  perform public.review_editorial_asset(gen_random_uuid(),'cleared','');
  raise exception 'An anonymous reviewer unexpectedly succeeded';
exception when insufficient_privilege then
  null;
end $$;

select 'editorial_publication_security_passed' as result;
