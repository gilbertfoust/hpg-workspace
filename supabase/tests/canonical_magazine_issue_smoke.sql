-- Non-destructive canonical HPG magazine checks. Run after migration.
do $$
declare violations integer;
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='editorial_publications'
      and column_name='communications_publication_id'
  ) then raise exception 'Canonical issue source reference is missing'; end if;
  if not coalesce((select c.relrowsecurity from pg_class c
    where c.oid='public.editorial_publications'::regclass),false) then
    raise exception 'Public snapshots must have row-level security'; end if;
  if has_table_privilege('anon','public.editorial_publications','INSERT')
    or has_table_privilege('authenticated','public.editorial_publications','INSERT')
    or has_table_privilege('authenticated','public.editorial_publications','UPDATE') then
    raise exception 'Public snapshots must be published and withdrawn by guarded RPC only'; end if;
  if has_function_privilege('anon','public.publish_communications_issue_native(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.withdraw_communications_issue_native(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.get_communications_issue_preview(uuid)','EXECUTE') then
    raise exception 'Magazine preview/release/withdrawal is exposed anonymously'; end if;
  if not has_function_privilege('authenticated','public.get_communications_issue_preview(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.publish_communications_issue_native(uuid,text)','EXECUTE') then
    raise exception 'Authenticated magazine RPC is unavailable'; end if;
  select count(*) into violations from public.editorial_publications where
    num_nonnulls(editorial_item_id,communications_editorial_item_id,communications_publication_id)<>1;
  if violations <> 0 then
    raise exception 'Public snapshots have ambiguous editorial ownership'; end if;
end $$;

do $$
begin
  perform public.publish_communications_issue_native(gen_random_uuid(),'unauthorized-test-issue');
  raise exception 'Unauthenticated issue publisher unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Communications magazine publishing permission required%'
    then raise; end if;
end $$;

do $$
begin
  perform public.get_communications_issue_preview(gen_random_uuid());
  raise exception 'Unauthenticated magazine viewer unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Communications staff access required%'
    then raise; end if;
end $$;

do $$
begin
  perform public.withdraw_communications_issue_native(gen_random_uuid(),'Documented reason for this access test');
  raise exception 'Unauthenticated issue withdrawal unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%Communications magazine publishing permission required%'
    then raise; end if;
end $$;

select 'canonical_magazine_release_security_passed' as result;
