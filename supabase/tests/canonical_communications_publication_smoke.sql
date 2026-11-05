-- Safe, read-only assertions after the canonical Communications publication migration.
do $$
declare actual integer;
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='editorial_publications'
      and column_name='communications_editorial_item_id'
  ) then
    raise exception 'Canonical source linkage is missing';
  end if;
  if not coalesce((
    select relrowsecurity from pg_class where oid='public.editorial_publications'::regclass
  ),false) then
    raise exception 'Public snapshots require RLS';
  end if;
  if has_table_privilege('anon','public.editorial_publications','INSERT')
     or has_table_privilege('authenticated','public.editorial_publications','INSERT')
     or has_table_privilege('authenticated','public.editorial_publications','UPDATE') then
    raise exception 'Public snapshots must be published and withdrawn by RPC only';
  end if;
  if not has_table_privilege('anon','public.editorial_publications','SELECT') then
    raise exception 'Public snapshots must be readable';
  end if;
  if has_function_privilege('anon','public.publish_communications_editorial_native(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.withdraw_communications_editorial_native(uuid,text)','EXECUTE') then
    raise exception 'Anonymous users must never publish or withdraw a story';
  end if;
  if not has_function_privilege('authenticated','public.publish_communications_editorial_native(uuid,text)','EXECUTE') then
    raise exception 'Authenticated publisher endpoint is not exposed';
  end if;
  select count(*) into actual from public.editorial_publications
    where num_nonnulls(editorial_item_id,communications_editorial_item_id)<>1;
  if actual<>0 then
    raise exception 'Public snapshots have ambiguous source ownership';
  end if;
  if (select count(*) from public.editorial_publications
    where communications_editorial_item_id is not null)<>0 then
    raise notice 'Existing canonical public editions are preserved';
  end if;
end $$;

do $$
begin
  perform public.publish_communications_editorial_native(gen_random_uuid(),'permission-probe');
  raise exception 'An anonymous-context publisher unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Communications final publisher authorization required%' then raise; end if;
end $$;

do $$
begin
  perform public.withdraw_communications_editorial_native(gen_random_uuid(),'Documented reason for testing');
  raise exception 'An anonymous-context withdrawal unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Communications final publisher authorization required%' then raise; end if;
end $$;

select 'canonical_communications_publication_security_passed' as result;
